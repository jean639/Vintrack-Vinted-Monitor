package scraper

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"vintrack-worker/internal/database"
	"vintrack-worker/internal/discord"
	"vintrack-worker/internal/model"
	"vintrack-worker/internal/proxy"

	http "github.com/bogdanfinn/fhttp"
)

const maxAPIResponseBytes = 2 * 1024 * 1024 // 2 MB

type Engine struct {
	db           *database.Store
	serverProxy  *proxy.Manager
	enrichSeller bool
	poolSize     int
	pools        map[string]*ClientPool
	poolsMu      sync.RWMutex
	enrichers    map[string]*SellerEnricher
	enrichersMu  sync.RWMutex
}

func NewEngine(db *database.Store, pm *proxy.Manager) *Engine {
	enrich := os.Getenv("ENRICH_SELLER_INFO") != "false"
	poolSize := getEnvInt("CLIENT_POOL_SIZE", 5)
	log.Printf("Seller enrichment (region/rating): %v, client pool size: %d", enrich, poolSize)
	return &Engine{
		db:           db,
		serverProxy:  pm,
		enrichSeller: enrich,
		poolSize:     poolSize,
		pools:        make(map[string]*ClientPool),
		enrichers:    make(map[string]*SellerEnricher),
	}
}

func (e *Engine) GetOrCreateEnricher(pm *proxy.Manager, domain string, proxySource string) *SellerEnricher {
	key := fmt.Sprintf("%s:%s", domain, proxySource)

	e.enrichersMu.RLock()
	s, ok := e.enrichers[key]
	e.enrichersMu.RUnlock()

	if ok {
		return s
	}

	e.enrichersMu.Lock()
	defer e.enrichersMu.Unlock()

	if s, ok = e.enrichers[key]; ok {
		return s
	}

	log.Printf("Creating new seller enricher for %s (source: %s)", domain, proxySource)
	s = NewSellerEnricher(pm, e.db, domain, e.poolSize)
	e.enrichers[key] = s
	return s
}

func (e *Engine) GetOrCreatePool(pm *proxy.Manager, domain string, proxySource string) *ClientPool {
	key := fmt.Sprintf("%s:%s", domain, proxySource)

	e.poolsMu.RLock()
	pool, ok := e.pools[key]
	e.poolsMu.RUnlock()

	if ok {
		return pool
	}

	e.poolsMu.Lock()
	defer e.poolsMu.Unlock()

	// Double check
	if pool, ok = e.pools[key]; ok {
		return pool
	}

	log.Printf("Creating new client pool for %s (source: %s)", domain, proxySource)
	pool = NewClientPool(pm, domain, e.poolSize)
	e.pools[key] = pool
	return pool
}

func (e *Engine) getProxyManager(m model.Monitor) *proxy.Manager {
	if m.Proxies.Valid && m.Proxies.String != "" {
		return proxy.FromString(m.Proxies.String)
	}
	return e.serverProxy
}

func (e *Engine) MonitorTask(ctx context.Context, m model.Monitor) {
	pm := e.getProxyManager(m)
	domain := model.RegionDomain(m.Region)

	proxySource := "server"
	if m.ProxyGroupName.Valid && m.ProxyGroupName.String != "" {
		proxySource = fmt.Sprintf("group:%s", m.ProxyGroupName.String)
	}

	if pm.Count() == 0 {
		log.Printf("[%d] ❌ ERROR: no valid proxies available (source: %s) — skipping monitor", m.ID, proxySource)
		e.db.UpdateMonitorHealth(model.MonitorHealth{
			MonitorID:       m.ID,
			ConsecutiveErrs: -1,
			LastError:       "no valid proxies available",
			UpdatedAt:       time.Now().UTC().Format(time.RFC3339),
		})
		if m.WebhookActive && m.DiscordWebhook.String != "" {
			discord.SendAutoStopWebhook(m.DiscordWebhook.String, m.Query, -1)
		}
		return
	}
	log.Printf("[%d] proxy source: %s (%d proxies)", m.ID, proxySource, pm.Count())

	pool := e.GetOrCreatePool(pm, domain, proxySource)
	log.Printf("[%d] using client pool: %d clients", m.ID, pool.Size())

	var enricher *SellerEnricher
	if e.enrichSeller {
		enricher = e.GetOrCreateEnricher(pm, domain, proxySource)
	}

	apiURL := BuildVintedURL(m)

	interval := getEnvInt("CHECK_INTERVAL_MS", 500)
	maxConsecutiveErrors := getEnvInt("MAX_CONSECUTIVE_ERRORS", 20)
	raceFetchers := getEnvInt("RACE_FETCHERS", 2)
	consecutiveErrors := 0
	checks := 0
	initialized := false
	var totalErrors int64

	log.Printf("[%d] started | query=%q | race=%d | url=%s", m.ID, m.Query, raceFetchers, apiURL)
	if m.WebhookActive && m.DiscordWebhook.String != "" {
		discord.SendStartupWebhook(m.DiscordWebhook.String, m.Query)
	}

	reportHealth := func(lastErr string) {
		h := model.MonitorHealth{
			MonitorID:       m.ID,
			TotalChecks:     int64(checks),
			TotalErrors:     totalErrors,
			ConsecutiveErrs: consecutiveErrors,
			UpdatedAt:       time.Now().UTC().Format(time.RFC3339),
		}
		if lastErr != "" {
			h.LastError = lastErr
		}
		e.db.UpdateMonitorHealth(h)
	}

	defer func() {
		e.db.ClearMonitorHealth(m.ID)
	}()

	intervalDuration := time.Duration(interval) * time.Millisecond

	for {
		cycleStart := time.Now()

		select {
		case <-ctx.Done():
			log.Printf("[%d] stopped gracefully", m.ID)
			return
		default:
		}

		checks++

		if checks%20 == 0 {
			if updated, err := e.db.GetMonitorByID(m.ID); err == nil {
				if updated.Status != "active" {
					log.Printf("[%d] paused via dashboard", m.ID)
					return
				}
				if monitorConfigFingerprint(updated) != monitorConfigFingerprint(m) {
					log.Printf("[%d] config changed, will be restarted by sync loop", m.ID)
					return
				}
				m.DiscordWebhook = updated.DiscordWebhook
				m.WebhookActive = updated.WebhookActive
				m.Status = updated.Status
			}
		}

		type fetchResult struct {
			items  []model.VintedItem
			status int
			err    error
			client *Client
		}

		clients := pool.RaceClients(raceFetchers)
		resultCh := make(chan fetchResult, len(clients))

		for _, c := range clients {
			go func(cl *Client) {
				items, status, err := e.fetchCatalog(ctx, cl, apiURL, domain)
				resultCh <- fetchResult{items, status, err, cl}
			}(c)
		}

		var items []model.VintedItem
		gotSuccess := false
		remaining := len(clients)

		timeout := time.NewTimer(3 * time.Second)
	collectLoop:
		for remaining > 0 {
			select {
			case r := <-resultCh:
				remaining--
				if r.err != nil {
					pool.Replace(r.client)
					if checks <= 3 || checks%5 == 0 {
						log.Printf("[%d] fetch error for %s via %s: %v", m.ID, domain, r.client.ProxyLabel(), r.err)
					}
					continue
				}
				if r.status == 200 && !gotSuccess {
					items = r.items
					gotSuccess = true
					if remaining > 0 {
						go func(ch chan fetchResult, n int, p *ClientPool) {
							drain := time.NewTimer(10 * time.Second)
							defer drain.Stop()
							for i := 0; i < n; i++ {
								select {
								case r := <-ch:
									if shouldReplaceClientForStatus(r.status) {
										r.client.ResetWarm(domain)
										p.Replace(r.client)
									}
								case <-drain.C:
									return
								}
							}
						}(resultCh, remaining, pool)
					}
					break collectLoop
				} else if shouldReplaceClientForStatus(r.status) {
					r.client.ResetWarm(domain)
					pool.Replace(r.client)
				} else if r.status != 0 && (checks <= 3 || checks%5 == 0) {
					log.Printf("[%d] fetch status for %s via %s: %d", m.ID, domain, r.client.ProxyLabel(), r.status)
				}
			case <-timeout.C:
				if remaining > 0 {
					go func(ch chan fetchResult, n int, p *ClientPool) {
						drain := time.NewTimer(10 * time.Second)
						defer drain.Stop()
						for i := 0; i < n; i++ {
							select {
							case r := <-ch:
								if shouldReplaceClientForStatus(r.status) {
									r.client.ResetWarm(domain)
									p.Replace(r.client)
								}
							case <-drain.C:
								return
							}
						}
					}(resultCh, remaining, pool)
				}
				break collectLoop
			}
		}
		if !timeout.Stop() {
			select {
			case <-timeout.C:
			default:
			}
		}

		if !gotSuccess {
			consecutiveErrors++
			totalErrors++
			if consecutiveErrors%5 == 0 {
				reportHealth("all fetchers failed")
				log.Printf("[%d] %d consecutive failures, backing off...", m.ID, consecutiveErrors)
				if consecutiveErrors == 15 || consecutiveErrors == 30 {
					if m.WebhookActive && m.DiscordWebhook.String != "" {
						discord.SendProxyWarningWebhook(m.DiscordWebhook.String, m.Query, consecutiveErrors)
					}
				}
			}
			if consecutiveErrors >= maxConsecutiveErrors {
				log.Printf("[%d] ❌ auto-stopping: %d consecutive errors", m.ID, consecutiveErrors)
				e.db.SetMonitorStatus(m.ID, "error")
				if m.WebhookActive && m.DiscordWebhook.String != "" {
					discord.SendAutoStopWebhook(m.DiscordWebhook.String, m.Query, consecutiveErrors)
				}
				return
			}
			backoff := time.Duration(300+consecutiveErrors*200) * time.Millisecond
			if backoff > 3*time.Second {
				backoff = 3 * time.Second
			}
			time.Sleep(backoff)
			continue
		}

		consecutiveErrors = 0
		if checks%5 == 0 || checks <= 3 {
			reportHealth("")
		}

		if len(items) == 0 {
			if !initialized {
				initialized = true
				log.Printf("[%d] initial scan completed with no items", m.ID)
			}
			if checks%10 == 0 {
				log.Printf("[%d] #%d | 0 items returned by Vinted", m.ID, checks)
			}
			if remaining := intervalDuration - time.Since(cycleStart); remaining > 0 {
				time.Sleep(remaining)
			}
			continue
		}

		ids := make([]int64, len(items))
		for i, item := range items {
			ids[i] = item.ID
		}

		newMap := e.db.BatchIsNew(m.ID, ids)

		processItems, seedItems := splitIncomingItems(items, newMap, initialized)

		if len(seedItems) > 0 {
			log.Printf("[%d] initial scan seeded %d items without notifications", m.ID, len(seedItems))

			seedIDs := make([]int64, len(seedItems))
			for i, item := range seedItems {
				seedIDs[i] = item.ID
			}
			e.db.MarkItemsSeen(m.ID, seedIDs)

			seedBuiltItems := e.buildItems(m, seedItems)
			go e.processItems(ctx, seedBuiltItems, seedItems, m.ID, m.DiscordWebhook.String, false, m.Query, proxySource, enricher, domain, m.AllowedCountries, false)

			initialized = true
			if remaining := intervalDuration - time.Since(cycleStart); remaining > 0 {
				time.Sleep(remaining)
			}
			continue
		}

		if len(processItems) == 0 {
			if !initialized {
				initialized = true
			}
			if remaining := intervalDuration - time.Since(cycleStart); remaining > 0 {
				time.Sleep(remaining)
			}
			continue
		}

		log.Printf("[%d] #%d | %d items | %d new | %dms", m.ID, checks, len(items), len(processItems), time.Since(cycleStart).Milliseconds())

		builtItems := e.buildItems(m, processItems)

		if e.enrichSeller {
			for i, vItem := range processItems {
				if info, ok := LookupCachedSellerInfo(e.db, vItem.User.ID); ok {
					builtItems[i].Location = info.Region
					builtItems[i].Rating = info.Rating
				}
			}
		}

		for _, item := range builtItems {
			log.Printf("[%d] NEW: %s (%s) [%s]", m.ID, item.Title, item.Price, item.Size)
		}

		newIDs := make([]int64, len(processItems))
		for i, item := range processItems {
			newIDs[i] = item.ID
		}
		e.db.MarkItemsSeen(m.ID, newIDs)
		initialized = true

		go e.processItems(ctx, builtItems, processItems, m.ID, m.DiscordWebhook.String, m.WebhookActive, m.Query, proxySource, enricher, domain, m.AllowedCountries, true)

		if remaining := intervalDuration - time.Since(cycleStart); remaining > 0 {
			time.Sleep(remaining)
		}
	}
}

func (e *Engine) fetchCatalog(ctx context.Context, client *Client, apiURL string, domain string) ([]model.VintedItem, int, error) {
	reqURL := apiURL + "&_=" + strconv.FormatInt(time.Now().UnixMilli(), 10)

	if err := client.EnsureWarm(domain); err != nil {
		return nil, 0, fmt.Errorf("warmup %s via %s: %w", domain, client.ProxyLabel(), err)
	}

	for redirects := 0; redirects < 3; redirects++ {
		currentDomain := hostFromURL(reqURL, domain)

		req, err := http.NewRequestWithContext(ctx, "GET", reqURL, nil)
		if err != nil {
			return nil, 0, err
		}
		req.Header = newAPIHeaders(currentDomain)

		resp, err := client.HttpClient.Do(req)
		if err != nil {
			return nil, 0, err
		}

		if resp.StatusCode >= 300 && resp.StatusCode < 400 {
			location := resp.Header.Get("Location")
			resp.Body.Close()
			if location == "" {
				return nil, resp.StatusCode, nil
			}

			nextURL, err := resolveRedirectURL(reqURL, location)
			if err != nil {
				return nil, 0, err
			}
			reqURL = nextURL
			continue
		}

		if resp.StatusCode != 200 {
			_, _ = io.Copy(io.Discard, resp.Body)
			resp.Body.Close()
			return nil, resp.StatusCode, nil
		}

		limitedReader := io.LimitReader(resp.Body, maxAPIResponseBytes)
		var data model.VintedResponse
		if err := json.NewDecoder(limitedReader).Decode(&data); err != nil {
			resp.Body.Close()
			return nil, 0, fmt.Errorf("json decode: %w", err)
		}
		resp.Body.Close()
		return data.Items, 200, nil
	}

	return nil, 0, nil
}

func resolveRedirectURL(currentURL string, location string) (string, error) {
	base, err := url.Parse(currentURL)
	if err != nil {
		return "", err
	}

	next, err := url.Parse(location)
	if err != nil {
		return "", err
	}

	return base.ResolveReference(next).String(), nil
}

func (e *Engine) processItems(ctx context.Context, items []model.Item, vItems []model.VintedItem, monitorID int, webhook string, webhookActive bool, query string, ps string, enricher *SellerEnricher, dom string, allowedCountries *string, publish bool) {
	if e.enrichSeller && enricher != nil {
		sem := make(chan struct{}, 10)
		var wg sync.WaitGroup
		for i := range items {
			if items[i].Location != "" && items[i].Rating != "" {
				continue
			}
			select {
			case <-ctx.Done():
				return
			default:
			}

			wg.Add(1)
			go func(idx int, userID int64) {
				defer wg.Done()
				sem <- struct{}{}
				defer func() { <-sem }()

				info := enricher.FetchSellerInfo(userID)
				if info.Region != "" && info.Region != "NaN" {
					items[idx].Location = info.Region
					items[idx].Rating = info.Rating
				}
			}(i, vItems[i].User.ID)
		}
		wg.Wait()
	}

	if allowedCountries != nil && *allowedCountries != "" {
		allowedMap := make(map[string]bool)
		for _, a := range strings.Split(strings.ToLower(*allowedCountries), ",") {
			allowedMap[strings.TrimSpace(a)] = true
		}

		var filtered []model.Item
		for _, it := range items {
			if it.Location == "" {
				log.Printf("[%d] Item %d dropped: location unknown (enrichment failed)", monitorID, it.ID)
				continue
			}
			locLower := strings.ToLower(it.Location)
			matched := false
			for code := range allowedMap {
				if strings.Contains(locLower, code) {
					matched = true
					break
				}
			}
			if matched {
				filtered = append(filtered, it)
			} else {
				log.Printf("[%d] Item %d dropped: location %q not in %q", monitorID, it.ID, it.Location, *allowedCountries)
			}
		}
		items = filtered
	}

	if len(items) == 0 {
		return
	}

	if err := e.db.BatchSaveItems(items); err != nil {
		log.Printf("[%d] batch save error: %v", monitorID, err)
	}

	if !publish {
		return
	}

	for i := range items {
		if err := e.db.PublishItem(items[i]); err != nil {
			log.Printf("[%d] publish error: %v", monitorID, err)
		}

		if webhook != "" && webhookActive {
			select {
			case <-ctx.Done():
				return
			default:
			}
			discord.SendWebhook(webhook, items[i], query, ps)
		}
	}
}

func splitIncomingItems(items []model.VintedItem, newMap map[int64]bool, initialized bool) ([]model.VintedItem, []model.VintedItem) {
	if !initialized {
		return nil, items
	}

	newItems := make([]model.VintedItem, 0, len(items))
	for _, item := range items {
		if newMap[item.ID] {
			newItems = append(newItems, item)
		}
	}

	return newItems, nil
}

func (e *Engine) buildItems(m model.Monitor, vItems []model.VintedItem) []model.Item {
	domain := model.RegionDomain(m.Region)
	items := make([]model.Item, len(vItems))

	for i, vItem := range vItems {
		itemURL := vItem.Url
		if !strings.HasPrefix(itemURL, "http") {
			itemURL = fmt.Sprintf("https://%s%s", domain, itemURL)
		}
		size := vItem.SizeTitle
		if size == "" {
			size = vItem.Size
		}
		totalPrice := ""
		if vItem.TotalItemPrice != nil {
			totalPrice = vItem.TotalItemPrice.Amount + " " + vItem.TotalItemPrice.Currency
		}

		var extraImages []string
		for idx, photo := range vItem.Photos {
			if idx == 0 {
				continue
			}
			if photo.Url != "" {
				extraImages = append(extraImages, photo.Url)
			}
		}

		items[i] = model.Item{
			ID:          vItem.ID,
			MonitorID:   m.ID,
			Title:       vItem.Title,
			Brand:       vItem.BrandTitle,
			Price:       vItem.Price.Amount + " " + vItem.Price.Currency,
			TotalPrice:  totalPrice,
			Size:        size,
			Condition:   vItem.Condition,
			URL:         itemURL,
			ImageURL:    vItem.Photo.Url,
			ExtraImages: extraImages,
			SellerID:    vItem.User.ID,
			FoundAt:     time.Now(),
		}
	}

	return items
}

func getEnvInt(key string, fallback int) int {
	if val, err := strconv.Atoi(os.Getenv(key)); err == nil {
		return val
	}
	return fallback
}
