package scraper

import (
	"context"
	"fmt"
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
	"vintrack-worker/internal/telegram"
)

const (
	maxAPIResponseBytes = 2 * 1024 * 1024 // 2 MB
	defaultQueryDelayMS = 1500
	minQueryDelayMS     = 500
	maxQueryDelayMS     = 3600000
)

type Engine struct {
	db           *database.Store
	serverProxy  *proxy.Manager
	fetcher      CatalogFetcher
	enrichSeller bool
	poolSize     int
	pools        map[string]*ClientPool
	poolsMu      sync.RWMutex
	enrichers    map[string]*SellerEnricher
	enrichersMu  sync.RWMutex
}

func NewEngine(db *database.Store, pm *proxy.Manager) *Engine {
	fetcher := NewCatalogFetcherFromEnv()
	enrich := os.Getenv("ENRICH_SELLER_INFO") != "false"
	if !fetcher.RequiresNetwork() {
		enrich = false
	}
	poolSize := getEnvInt("CLIENT_POOL_SIZE", 5)
	log.Printf("Catalog fetch mode: %s, seller enrichment (region/rating): %v, client pool size: %d", fetcher.Name(), enrich, poolSize)
	return &Engine{
		db:           db,
		serverProxy:  pm,
		fetcher:      fetcher,
		enrichSeller: enrich,
		poolSize:     poolSize,
		pools:        make(map[string]*ClientPool),
		enrichers:    make(map[string]*SellerEnricher),
	}
}

func (e *Engine) ServerProxyVersion() uint64 {
	return e.serverProxy.Version()
}

func (e *Engine) GetOrCreateEnricher(pm *proxy.Manager, domain string, proxyKey string, trafficRecorder func(txBytes int64, rxBytes int64), proxyLabel string) *SellerEnricher {
	key := fmt.Sprintf("%s:%s", domain, proxyKey)

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

	log.Printf("Creating new seller enricher for %s (source: %s)", domain, proxyLabel)
	s = NewSellerEnricher(pm, e.db, domain, e.poolSize, trafficRecorder)
	e.enrichers[key] = s
	return s
}

func (e *Engine) GetOrCreatePool(pm *proxy.Manager, domain string, proxyKey string, trafficRecorder func(txBytes int64, rxBytes int64), proxyLabel string) *ClientPool {
	key := fmt.Sprintf("%s:%s", domain, proxyKey)

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

	log.Printf("Creating new client pool for %s (source: %s)", domain, proxyLabel)
	pool = NewClientPool(pm, domain, e.poolSize, trafficRecorder)
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
	proxyKey := "server"
	var trafficRecorder func(txBytes int64, rxBytes int64)
	if m.ProxyGroupName.Valid && m.ProxyGroupName.String != "" {
		proxySource = fmt.Sprintf("group:%s", m.ProxyGroupName.String)
	}
	if m.ProxyGroupID != nil {
		groupID := *m.ProxyGroupID
		proxyKey = fmt.Sprintf("group:%d", groupID)
		trafficRecorder = func(txBytes int64, rxBytes int64) {
			e.db.RecordProxyGroupBandwidth(groupID, txBytes, rxBytes)
		}
	}

	if e.fetcher.RequiresNetwork() && pm.Count() == 0 {
		log.Printf("[%d] ❌ ERROR: no valid proxies available (source: %s) — skipping monitor", m.ID, proxySource)
		e.db.UpdateMonitorHealth(model.MonitorHealth{
			MonitorID:       m.ID,
			ConsecutiveErrs: -1,
			LastError:       "no valid proxies available",
			UpdatedAt:       time.Now().UTC().Format(time.RFC3339),
		})
		e.db.RecordMonitorRun(model.MonitorRun{
			MonitorID:    m.ID,
			Status:       "failed",
			ErrorMessage: "no valid proxies available",
			ProxySource:  proxySource,
			Region:       m.Region,
		})
		e.db.RecordMonitorEvent(model.MonitorEvent{
			MonitorID: m.ID,
			EventType: "proxy_unavailable",
			Severity:  "error",
			Message:   "No valid proxies available for monitor",
		})
		if m.WebhookActive && m.DiscordWebhook.String != "" {
			discord.SendAutoStopWebhook(m.DiscordWebhook.String, m.Name, -1)
		}
		if m.TelegramActive && m.TelegramChatID.String != "" {
			telegram.SendAutoStop(m.TelegramChatID.String, m.Name, -1)
		}
		return
	}

	var pool *ClientPool
	if e.fetcher.RequiresNetwork() {
		log.Printf("[%d] proxy source: %s (%d proxies)", m.ID, proxySource, pm.Count())
		pool = e.GetOrCreatePool(pm, domain, proxyKey, trafficRecorder, proxySource)
		log.Printf("[%d] using client pool: %d clients", m.ID, pool.Size())
	} else {
		proxySource = "mock"
		log.Printf("[%d] using mock catalog fetcher: %s", m.ID, e.fetcher.Name())
	}

	allowedCountries := m.AllowedCountries
	if !e.fetcher.RequiresNetwork() {
		allowedCountries = nil
	}

	var enricher *SellerEnricher
	if e.enrichSeller {
		enricher = e.GetOrCreateEnricher(pm, domain, proxyKey, trafficRecorder, proxySource)
	}

	apiURL := BuildVintedURL(m)

	interval := resolveQueryDelayMs(m.QueryDelayMs)
	maxConsecutiveErrors := getEnvInt("MAX_CONSECUTIVE_ERRORS", 20)
	raceFetchers := getEnvInt("RACE_FETCHERS", 2)
	consecutiveErrors := 0
	checks := 0
	initialized := false
	var totalErrors int64

	log.Printf("[%d] started | name=%q | query=%q | delay=%dms | race=%d | url=%s", m.ID, m.Name, m.Query, interval, raceFetchers, apiURL)
	webhookURL := m.DiscordWebhook.String
	webhookActive := m.WebhookActive
	if !e.fetcher.RequiresNetwork() && strings.TrimSpace(webhookURL) == "" {
		webhookURL = strings.TrimSpace(os.Getenv("VINTED_MOCK_DISCORD_WEBHOOK_URL"))
		webhookActive = webhookURL != ""
	}
	if webhookActive && webhookURL != "" {
		discord.SendStartupWebhook(webhookURL, m.Name)
	}
	if m.TelegramActive && m.TelegramChatID.String != "" {
		telegram.SendStartup(m.TelegramChatID.String, m.Name)
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

		if e.isProxyGroupBandwidthLimitReached(m) {
			log.Printf("[%d] proxy group limit reached for %s, pausing monitor", m.ID, proxySource)
			e.db.UpdateMonitorHealth(model.MonitorHealth{
				MonitorID:       m.ID,
				TotalChecks:     int64(checks),
				TotalErrors:     totalErrors,
				ConsecutiveErrs: consecutiveErrors,
				LastError:       "proxy group bandwidth limit reached",
				UpdatedAt:       time.Now().UTC().Format(time.RFC3339),
			})
			e.db.RecordMonitorEvent(model.MonitorEvent{
				MonitorID: m.ID,
				EventType: "bandwidth_limit_reached",
				Severity:  "warning",
				Message:   "Proxy group bandwidth limit reached; monitor was paused",
			})
			e.db.SetMonitorStatus(m.ID, "paused")
			return
		}

		if checks%20 == 0 {
			if updated, err := e.db.GetMonitorByID(m.ID); err == nil {
				if updated.Status != "active" {
					log.Printf("[%d] paused via dashboard", m.ID)
					return
				}
				if updated.ProxyGroupID == nil {
					updated.ServerProxyVersion = e.ServerProxyVersion()
				}
				if monitorConfigFingerprint(updated) != monitorConfigFingerprint(m) {
					log.Printf("[%d] config changed, will be restarted by sync loop", m.ID)
					return
				}
				m.DiscordWebhook = updated.DiscordWebhook
				m.WebhookActive = updated.WebhookActive
				webhookURL = m.DiscordWebhook.String
				webhookActive = m.WebhookActive
				if !e.fetcher.RequiresNetwork() && strings.TrimSpace(webhookURL) == "" {
					webhookURL = strings.TrimSpace(os.Getenv("VINTED_MOCK_DISCORD_WEBHOOK_URL"))
					webhookActive = webhookURL != ""
				}
				m.Status = updated.Status
				m.ProxyGroupLimitBytes = updated.ProxyGroupLimitBytes
				m.ProxyGroupRxBytes = updated.ProxyGroupRxBytes
				m.ProxyGroupTxBytes = updated.ProxyGroupTxBytes
				m.ProxyGroupResetAt = updated.ProxyGroupResetAt
			}
		}

		type fetchResult struct {
			items  []model.VintedItem
			status int
			err    error
			client *Client
		}

		var clients []*Client
		if pool != nil {
			clients = pool.RaceClients(raceFetchers)
		} else {
			clients = []*Client{nil}
		}
		resultCh := make(chan fetchResult, len(clients))

		for _, c := range clients {
			go func(cl *Client) {
				items, status, err := e.fetcher.FetchCatalog(ctx, cl, apiURL, domain)
				resultCh <- fetchResult{items, status, err, cl}
			}(c)
		}

		var items []model.VintedItem
		gotSuccess := false
		lastStatus := 0
		remaining := len(clients)

		timeout := time.NewTimer(3 * time.Second)
	collectLoop:
		for remaining > 0 {
			select {
			case r := <-resultCh:
				remaining--
				if r.status != 0 {
					lastStatus = r.status
				}
				if r.err != nil {
					if pool != nil && r.client != nil {
						pool.Replace(r.client)
					}
					if checks <= 3 || checks%5 == 0 {
						log.Printf("[%d] fetch error for %s via %s: %v", m.ID, domain, clientProxyLabel(r.client, proxySource), r.err)
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
									if r.client != nil && shouldReplaceClientForStatus(r.status) {
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
				} else if pool != nil && r.client != nil && shouldReplaceClientForStatus(r.status) {
					r.client.ResetWarm(domain)
					pool.Replace(r.client)
				} else if r.status != 0 && (checks <= 3 || checks%5 == 0) {
					log.Printf("[%d] fetch status for %s via %s: %d", m.ID, domain, clientProxyLabel(r.client, proxySource), r.status)
				}
			case <-timeout.C:
				if remaining > 0 {
					go func(ch chan fetchResult, n int, p *ClientPool) {
						drain := time.NewTimer(10 * time.Second)
						defer drain.Stop()
						for i := 0; i < n; i++ {
							select {
							case r := <-ch:
								if r.client != nil && shouldReplaceClientForStatus(r.status) {
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
			e.db.RecordMonitorRun(model.MonitorRun{
				MonitorID:    m.ID,
				Status:       "failed",
				StatusCode:   lastStatus,
				DurationMS:   int(time.Since(cycleStart).Milliseconds()),
				ErrorMessage: "all fetchers failed",
				ProxySource:  proxySource,
				Region:       m.Region,
			})
			consecutiveErrors++
			totalErrors++
			if consecutiveErrors%5 == 0 {
				reportHealth("all fetchers failed")
				log.Printf("[%d] %d consecutive failures, backing off...", m.ID, consecutiveErrors)
				if consecutiveErrors == 15 || consecutiveErrors == 30 {
					if m.WebhookActive && m.DiscordWebhook.String != "" {
						discord.SendProxyWarningWebhook(m.DiscordWebhook.String, m.Name, consecutiveErrors)
					}
					if m.TelegramActive && m.TelegramChatID.String != "" {
						telegram.SendProxyWarning(m.TelegramChatID.String, m.Name, consecutiveErrors)
					}
				}
			}
			if consecutiveErrors >= maxConsecutiveErrors {
				log.Printf("[%d] ❌ auto-stopping: %d consecutive errors", m.ID, consecutiveErrors)
				e.db.SetMonitorStatus(m.ID, "error")
				e.db.RecordMonitorEvent(model.MonitorEvent{
					MonitorID: m.ID,
					EventType: "auto_stopped",
					Severity:  "error",
					Message:   fmt.Sprintf("Monitor auto-stopped after %d consecutive fetch errors", consecutiveErrors),
				})
				if m.WebhookActive && m.DiscordWebhook.String != "" {
					discord.SendAutoStopWebhook(m.DiscordWebhook.String, m.Name, consecutiveErrors)
				}
				if m.TelegramActive && m.TelegramChatID.String != "" {
					telegram.SendAutoStop(m.TelegramChatID.String, m.Name, consecutiveErrors)
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
			e.db.RecordMonitorRun(model.MonitorRun{
				MonitorID:   m.ID,
				Status:      "success",
				StatusCode:  lastStatus,
				DurationMS:  int(time.Since(cycleStart).Milliseconds()),
				ItemCount:   0,
				ProxySource: proxySource,
				Region:      m.Region,
			})
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
			e.db.RecordMonitorRun(model.MonitorRun{
				MonitorID:   m.ID,
				Status:      "success",
				StatusCode:  lastStatus,
				DurationMS:  int(time.Since(cycleStart).Milliseconds()),
				ItemCount:   len(items),
				ProxySource: proxySource,
				Region:      m.Region,
			})

			seedIDs := make([]int64, len(seedItems))
			for i, item := range seedItems {
				seedIDs[i] = item.ID
			}
			e.db.MarkItemsSeen(m.ID, seedIDs)

			filteredSeedItems, antiBlockedSeedCount := filterAntiKeywordItems(seedItems, m.AntiKeywords)
			filteredSeedItems, sellerBlockedSeedCount := filterBannedSellerItems(filteredSeedItems, m.BannedSellerIDs)
			if antiBlockedSeedCount > 0 {
				log.Printf("[%d] initial scan skipped %d items due to anti keywords", m.ID, antiBlockedSeedCount)
			}
			if sellerBlockedSeedCount > 0 {
				log.Printf("[%d] initial scan skipped %d items due to seller bans", m.ID, sellerBlockedSeedCount)
			}
			if len(filteredSeedItems) > 0 {
				seedBuiltItems := e.buildItems(m, filteredSeedItems)
				go e.processItems(ctx, seedBuiltItems, filteredSeedItems, m.ID, m.UserID, m.DedupeMonitorAlerts, m.DiscordWebhook.String, false, m.TelegramChatID.String, false, m.Name, proxySource, enricher, domain, allowedCountries, false)
			}

			initialized = true
			if remaining := intervalDuration - time.Since(cycleStart); remaining > 0 {
				time.Sleep(remaining)
			}
			continue
		}

		if len(processItems) == 0 {
			e.db.RecordMonitorRun(model.MonitorRun{
				MonitorID:   m.ID,
				Status:      "success",
				StatusCode:  lastStatus,
				DurationMS:  int(time.Since(cycleStart).Milliseconds()),
				ItemCount:   len(items),
				ProxySource: proxySource,
				Region:      m.Region,
			})
			if !initialized {
				initialized = true
			}
			if remaining := intervalDuration - time.Since(cycleStart); remaining > 0 {
				time.Sleep(remaining)
			}
			continue
		}

		alertItems, antiBlockedCount := filterAntiKeywordItems(processItems, m.AntiKeywords)
		alertItems, sellerBlockedCount := filterBannedSellerItems(alertItems, m.BannedSellerIDs)
		if antiBlockedCount > 0 {
			log.Printf("[%d] skipped %d new items due to anti keywords", m.ID, antiBlockedCount)
		}
		if sellerBlockedCount > 0 {
			log.Printf("[%d] skipped %d new items due to seller bans", m.ID, sellerBlockedCount)
		}

		newIDs := make([]int64, len(processItems))
		for i, item := range processItems {
			newIDs[i] = item.ID
		}
		e.db.MarkItemsSeen(m.ID, newIDs)
		initialized = true

		if len(alertItems) == 0 {
			e.db.RecordMonitorRun(model.MonitorRun{
				MonitorID:    m.ID,
				Status:       "success",
				StatusCode:   lastStatus,
				DurationMS:   int(time.Since(cycleStart).Milliseconds()),
				ItemCount:    len(items),
				NewItemCount: len(processItems),
				ProxySource:  proxySource,
				Region:       m.Region,
			})
			if remaining := intervalDuration - time.Since(cycleStart); remaining > 0 {
				time.Sleep(remaining)
			}
			continue
		}

		log.Printf("[%d] #%d | %d items | %d new | %dms", m.ID, checks, len(items), len(alertItems), time.Since(cycleStart).Milliseconds())
		e.db.RecordMonitorRun(model.MonitorRun{
			MonitorID:    m.ID,
			Status:       "success",
			StatusCode:   lastStatus,
			DurationMS:   int(time.Since(cycleStart).Milliseconds()),
			ItemCount:    len(items),
			NewItemCount: len(alertItems),
			ProxySource:  proxySource,
			Region:       m.Region,
		})

		builtItems := e.buildItems(m, alertItems)

		if e.enrichSeller {
			for i, vItem := range alertItems {
				if info, ok := LookupCachedSellerInfo(e.db, vItem.User.ID); ok {
					builtItems[i].Location = info.Region
					builtItems[i].Rating = info.Rating
				}
			}
		}

		for _, item := range builtItems {
			log.Printf("[%d] NEW: %s (%s) [%s]", m.ID, item.Title, item.Price, item.Size)
		}

		go e.processItems(ctx, builtItems, alertItems, m.ID, m.UserID, m.DedupeMonitorAlerts, webhookURL, webhookActive, m.TelegramChatID.String, m.TelegramActive, m.Name, proxySource, enricher, domain, allowedCountries, true)

		if remaining := intervalDuration - time.Since(cycleStart); remaining > 0 {
			time.Sleep(remaining)
		}
	}
}

func (e *Engine) isProxyGroupBandwidthLimitReached(m model.Monitor) bool {
	if m.ProxyGroupID == nil || m.ProxyGroupLimitBytes == nil || *m.ProxyGroupLimitBytes <= 0 {
		return false
	}

	txBytes, rxBytes, ok := e.db.GetProxyGroupBandwidthUsage(*m.ProxyGroupID)
	if !ok {
		txBytes = m.ProxyGroupTxBytes
		rxBytes = m.ProxyGroupRxBytes
	}

	return txBytes+rxBytes >= *m.ProxyGroupLimitBytes
}

func clientProxyLabel(client *Client, fallback string) string {
	if client == nil {
		return fallback
	}
	return client.ProxyLabel()
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

func (e *Engine) processItems(ctx context.Context, items []model.Item, vItems []model.VintedItem, monitorID int, userID string, dedupeAlerts bool, webhook string, webhookActive bool, telegramChatID string, telegramActive bool, monitorName string, ps string, enricher *SellerEnricher, dom string, allowedCountries *string, publish bool) {
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

		hasActiveAlert := (webhook != "" && webhookActive) || (telegramChatID != "" && telegramActive)
		if hasActiveAlert && dedupeAlerts && !e.db.ClaimUserItemAlert(userID, items[i].ID) {
			log.Printf("[%d] alert skipped for item %d: already sent for user", monitorID, items[i].ID)
			e.db.RecordAlertEvent(model.AlertEvent{
				UserID:        userID,
				MonitorID:     monitorID,
				ItemID:        items[i].ID,
				Channel:       "all",
				Status:        "skipped",
				FailureReason: "duplicate_user_item_alert",
			})
			continue
		}

		if webhook != "" && webhookActive {
			select {
			case <-ctx.Done():
				return
			default:
			}
			if err := discord.SendWebhook(webhook, items[i], monitorName, ps); err != nil {
				e.db.RecordAlertEvent(model.AlertEvent{
					UserID:        userID,
					MonitorID:     monitorID,
					ItemID:        items[i].ID,
					Channel:       "discord",
					Status:        "failed",
					FailureReason: err.Error(),
				})
			} else {
				e.db.RecordAlertEvent(model.AlertEvent{
					UserID:    userID,
					MonitorID: monitorID,
					ItemID:    items[i].ID,
					Channel:   "discord",
					Status:    "sent",
				})
			}
		}
		if telegramChatID != "" && telegramActive {
			select {
			case <-ctx.Done():
				return
			default:
			}
			if err := telegram.SendItem(telegramChatID, items[i], monitorName, ps); err != nil {
				e.db.RecordAlertEvent(model.AlertEvent{
					UserID:        userID,
					MonitorID:     monitorID,
					ItemID:        items[i].ID,
					Channel:       "telegram",
					Status:        "failed",
					FailureReason: err.Error(),
				})
			} else {
				e.db.RecordAlertEvent(model.AlertEvent{
					UserID:    userID,
					MonitorID: monitorID,
					ItemID:    items[i].ID,
					Channel:   "telegram",
					Status:    "sent",
				})
			}
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

func filterAntiKeywordItems(items []model.VintedItem, rawKeywords *string) ([]model.VintedItem, int) {
	keywords := parseAntiKeywords(rawKeywords)
	if len(keywords) == 0 || len(items) == 0 {
		return items, 0
	}

	filtered := make([]model.VintedItem, 0, len(items))
	blocked := 0
	for _, item := range items {
		haystack := strings.ToLower(item.Title + "\n" + item.Description)
		matched := false
		for _, keyword := range keywords {
			if strings.Contains(haystack, keyword) {
				matched = true
				break
			}
		}
		if matched {
			blocked++
			continue
		}
		filtered = append(filtered, item)
	}

	return filtered, blocked
}

func filterBannedSellerItems(items []model.VintedItem, bannedSellerIDs []int64) ([]model.VintedItem, int) {
	if len(items) == 0 || len(bannedSellerIDs) == 0 {
		return items, 0
	}

	banned := make(map[int64]bool, len(bannedSellerIDs))
	for _, sellerID := range bannedSellerIDs {
		if sellerID != 0 {
			banned[sellerID] = true
		}
	}
	if len(banned) == 0 {
		return items, 0
	}

	filtered := make([]model.VintedItem, 0, len(items))
	blocked := 0
	for _, item := range items {
		if item.User.ID != 0 && banned[item.User.ID] {
			blocked++
			continue
		}
		filtered = append(filtered, item)
	}

	return filtered, blocked
}

func parseAntiKeywords(rawKeywords *string) []string {
	if rawKeywords == nil || strings.TrimSpace(*rawKeywords) == "" {
		return nil
	}

	split := strings.FieldsFunc(*rawKeywords, func(r rune) bool {
		return r == ',' || r == '\n' || r == '\r'
	})

	keywords := make([]string, 0, len(split))
	seen := make(map[string]bool, len(split))
	for _, part := range split {
		keyword := strings.ToLower(strings.TrimSpace(part))
		if keyword == "" || seen[keyword] {
			continue
		}
		seen[keyword] = true
		keywords = append(keywords, keyword)
	}
	return keywords
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
			SellerLogin: vItem.User.Login,
			SellerURL:   buildSellerProfileURL(domain, vItem.User.ID, vItem.User.Login),
			FoundAt:     time.Now(),
		}

		if e != nil && e.fetcher != nil && !e.fetcher.RequiresNetwork() {
			location, rating := mockSellerMetadata(vItem.User.ID, vItem.ID)
			items[i].Location = location
			items[i].Rating = rating
		}
	}

	return items
}

func buildSellerProfileURL(domain string, sellerID int64, sellerLogin string) string {
	if sellerID == 0 {
		return ""
	}
	sellerPath := fmt.Sprintf("%d", sellerID)
	if strings.TrimSpace(sellerLogin) != "" {
		sellerPath = fmt.Sprintf("%d-%s", sellerID, strings.TrimSpace(sellerLogin))
	}
	return fmt.Sprintf("https://%s/member/%s", domain, sellerPath)
}

func mockSellerMetadata(userID int64, itemID int64) (string, string) {
	locations := []string{
		"🇩🇪 DE",
		"🇫🇷 FR",
		"🇮🇹 IT",
		"🇳🇱 NL",
		"🇪🇸 ES",
		"🇦🇹 AT",
	}
	ratings := []string{
		"⭐ 5.0 (124)",
		"⭐ 4.9 (58)",
		"⭐ 4.8 (203)",
		"⭐ 4.7 (31)",
		"No rating",
	}

	location := locations[int((userID+itemID)%int64(len(locations)))]
	rating := ratings[int((userID+itemID)%int64(len(ratings)))]
	return location, rating
}

func getEnvInt(key string, fallback int) int {
	if val, err := strconv.Atoi(os.Getenv(key)); err == nil {
		return val
	}
	return fallback
}

func resolveQueryDelayMs(value int) int {
	if value == 0 {
		return clampQueryDelayMs(getEnvInt("CHECK_INTERVAL_MS", defaultQueryDelayMS))
	}

	return clampQueryDelayMs(value)
}

func clampQueryDelayMs(value int) int {
	if value < minQueryDelayMS {
		return minQueryDelayMS
	}
	if value > maxQueryDelayMS {
		return maxQueryDelayMS
	}
	return value
}
