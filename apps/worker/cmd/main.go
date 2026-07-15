package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"

	"vintrack-worker/internal/cache"
	"vintrack-worker/internal/database"
	"vintrack-worker/internal/proxy"
	"vintrack-worker/internal/scraper"

	"github.com/joho/godotenv"
)

var freeProxyCheckRunning atomic.Bool

func main() {
	log.SetFlags(log.Ltime)
	log.Println("Vintrack Worker starting...")
	_ = godotenv.Load()

	// Initialize components
	redisCache, store, proxyManager, freeProxyPools := initComponents()
	defer redisCache.Close()
	defer store.Close()

	engine := scraper.NewEngine(store, proxyManager, freeProxyPools)
	mgr := scraper.NewManager(store, engine)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Initial sync
	mgr.Sync(ctx)
	go func() {
		importFreeProxies(ctx, store)
		checkFreeProxies(ctx, store)
		refreshFreeProxies(store, freeProxyPools)
	}()

	// Handle signals for graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)

	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	freeProxyHealthTicker := time.NewTicker(15 * time.Second)
	defer freeProxyHealthTicker.Stop()
	freeProxyImportTicker := time.NewTicker(5 * time.Minute)
	defer freeProxyImportTicker.Stop()

	log.Println("Worker running. Polling for monitor changes every 5s...")

	for {
		select {
		case <-sigChan:
			log.Println("Shutdown signal received, stopping all monitors...")
			cancel()
			mgr.StopAll()
			time.Sleep(time.Second)
			return
		case <-ticker.C:
			refreshServerProxies(store, proxyManager)
			refreshFreeProxies(store, freeProxyPools)
			mgr.Sync(ctx)
		case <-freeProxyHealthTicker.C:
			go checkFreeProxies(ctx, store)
		case <-freeProxyImportTicker.C:
			go importFreeProxies(ctx, store)
		}
	}
}

func initComponents() (*cache.RedisCache, *database.Store, *proxy.Manager, *proxy.RegionPools) {
	dbURL := mustEnv("DATABASE_URL")
	redisAddr := getEnv("REDIS_ADDR", "localhost:6379")
	proxyFile := getEnv("PROXY_FILE", "proxies.txt")

	redisCache, err := cache.NewRedisCache(redisAddr, os.Getenv("REDIS_PASSWORD"), 0)
	if err != nil {
		log.Fatalf("Redis: %v", err)
	}

	store, err := database.NewStore(dbURL, redisCache)
	if err != nil {
		log.Fatalf("PostgreSQL: %v", err)
	}

	proxyManager, err := proxy.Load(proxyFile)
	if err != nil {
		log.Printf("Proxies: %v (continuing without)", err)
		proxyManager = &proxy.Manager{}
	}
	refreshServerProxies(store, proxyManager)
	freeProxyPools := proxy.NewRegionPools()
	refreshFreeProxies(store, freeProxyPools)

	return redisCache, store, proxyManager, freeProxyPools
}

func refreshServerProxies(store *database.Store, proxyManager *proxy.Manager) {
	value, ok, err := store.GetSettingValue("server_proxies")
	if err != nil {
		log.Printf("server proxy setting refresh failed: %v", err)
		return
	}
	if ok {
		proxyManager.ReplaceFromString(value)
	}
}

func refreshFreeProxies(store *database.Store, freeProxyPools *proxy.RegionPools) {
	regions, err := freeProxyRegions(store)
	if err != nil {
		log.Printf("free proxy region refresh failed: %v", err)
		return
	}
	if !settingBool(store, "free_proxy_enabled", false) {
		for _, region := range regions {
			freeProxyPools.Replace(region, "")
		}
		return
	}
	for _, region := range regions {
		activeCount, err := store.CountActiveFreeProxies(region)
		if err != nil {
			log.Printf("free proxy active count failed for %s: %v", region, err)
			continue
		}
		minActive := settingInt(store, "free_proxy_min_active_per_region", 25)
		if activeCount < minActive {
			freeProxyPools.Replace(region, "")
			continue
		}
		proxies, err := store.GetActiveFreeProxies(region, settingInt(store, "free_proxy_max_pool_size", 500))
		if err != nil {
			log.Printf("free proxy refresh failed for %s: %v", region, err)
			continue
		}
		freeProxyPools.Replace(region, strings.Join(proxies, "\n"))
	}
}

func checkFreeProxies(ctx context.Context, store *database.Store) {
	if !freeProxyCheckRunning.CompareAndSwap(false, true) {
		return
	}
	defer freeProxyCheckRunning.Store(false)

	if !settingBool(store, "free_proxy_enabled", false) {
		return
	}
	regions, err := freeProxyRegions(store)
	if err != nil {
		log.Printf("free proxy health region load failed: %v", err)
		return
	}
	if err := store.EnsureFreeProxyHealthRows(regions, settingInt(store, "free_proxy_max_pool_size", 500)); err != nil {
		log.Printf("free proxy health row sync failed: %v", err)
		return
	}
	regionBatches := make([][]database.FreeProxyCandidate, 0, len(regions))
	perRegionBatch := settingInt(store, "FREE_PROXY_HEALTH_BATCH_PER_REGION", 100)
	bootstrapBatch := settingInt(store, "FREE_PROXY_BOOTSTRAP_BATCH_PER_REGION", 500)
	minActive := settingInt(store, "free_proxy_min_active_per_region", 25)
	for _, region := range regions {
		batchSize := perRegionBatch
		activeCount, err := store.CountActiveFreeProxies(region)
		if err != nil {
			log.Printf("free proxy active count failed for %s: %v", region, err)
		} else if activeCount < minActive {
			batchSize = bootstrapBatch
		}
		regionProxies, err := store.GetFreeProxiesDueForCheck([]string{region}, batchSize)
		if err != nil {
			log.Printf("free proxy health load failed for %s: %v", region, err)
			continue
		}
		regionBatches = append(regionBatches, regionProxies)
	}
	proxies := interleaveFreeProxyCandidates(regionBatches)
	if len(proxies) == 0 {
		return
	}
	threshold := settingInt(store, "free_proxy_failure_threshold", 3)
	quarantineMinutes := settingInt(store, "free_proxy_quarantine_minutes", 30)
	maxLatencyMs := settingInt(store, "free_proxy_max_latency_ms", 2500)
	concurrency := settingInt(store, "FREE_PROXY_HEALTH_CONCURRENCY", 100)
	if concurrency < 1 {
		concurrency = 1
	}
	sem := make(chan struct{}, concurrency)
	var wg sync.WaitGroup
	var passed atomic.Int64
	var failed atomic.Int64
	startedAt := time.Now()
	for _, candidate := range proxies {
		candidate := candidate
		wg.Add(1)
		sem <- struct{}{}
		go func() {
			defer wg.Done()
			defer func() { <-sem }()
			select {
			case <-ctx.Done():
				return
			default:
			}
			result, err := scraper.ValidateFreeProxy(ctx, candidate.ProxyURL, candidate.Region, maxLatencyMs)
			if err != nil {
				failed.Add(1)
				store.RecordFreeProxyFailure(candidate.ProxyURL, candidate.Region, result.StatusCode, err.Error(), threshold, quarantineMinutes)
				return
			}
			passed.Add(1)
			store.RecordFreeProxySuccess(candidate.ProxyURL, candidate.Region, result.LatencyMs)
		}()
	}
	wg.Wait()
	store.DisableGloballyDeadFreeProxies()
	log.Printf(
		"free proxy check completed: %d checked, %d passed, %d failed in %s",
		passed.Load()+failed.Load(),
		passed.Load(),
		failed.Load(),
		time.Since(startedAt).Round(time.Second),
	)
}

func interleaveFreeProxyCandidates(batches [][]database.FreeProxyCandidate) []database.FreeProxyCandidate {
	total := 0
	maxBatchSize := 0
	for _, batch := range batches {
		total += len(batch)
		if len(batch) > maxBatchSize {
			maxBatchSize = len(batch)
		}
	}

	candidates := make([]database.FreeProxyCandidate, 0, total)
	for index := 0; index < maxBatchSize; index++ {
		for _, batch := range batches {
			if index < len(batch) {
				candidates = append(candidates, batch[index])
			}
		}
	}
	return candidates
}

func importFreeProxies(ctx context.Context, store *database.Store) {
	if !settingBool(store, "free_proxy_enabled", false) || !settingBool(store, "free_proxy_auto_import_enabled", false) {
		return
	}
	importURL, ok, err := store.GetSettingValue("free_proxy_import_url")
	if err != nil {
		log.Printf("free proxy import setting failed: %v", err)
		return
	}
	if !ok || strings.TrimSpace(importURL) == "" {
		importURL = "https://raw.githubusercontent.com/iplocate/free-proxy-list/main/all-proxies.txt"
	}

	added := 0
	maxImport := settingInt(store, "free_proxy_max_pool_size", 5000)
	importURLs := freeProxyImportURLs(store, importURL)
	if len(importURLs) == 0 {
		return
	}
	perSourceLimit := (maxImport + len(importURLs) - 1) / len(importURLs)
	seenProxies := make(map[string]bool, maxImport)
	for _, sourceURL := range importURLs {
		if added >= maxImport {
			break
		}
		body, err := fetchFreeProxyList(ctx, sourceURL)
		if err != nil {
			log.Printf("free proxy import skipped %s: %v", sourceURL, err)
			continue
		}
		source := freeProxySource(store, sourceURL)
		defaultScheme := defaultSchemeForImportURL(sourceURL)
		sourceAdded := 0
		for _, line := range strings.Split(string(body), "\n") {
			if added >= maxImport || sourceAdded >= perSourceLimit {
				break
			}
			proxyURL, protocol, host, port, ok := normalizeFreeProxyLine(line, defaultScheme)
			if !ok || seenProxies[proxyURL] {
				continue
			}
			if err := store.UpsertFreeProxy(proxyURL, protocol, host, port, source); err == nil {
				seenProxies[proxyURL] = true
				added++
				sourceAdded++
			}
		}
	}
	if added > 0 {
		log.Printf("free proxy import upserted %d proxies", added)
	}
}

func fetchFreeProxyList(ctx context.Context, importURL string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, importURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "text/plain,*/*")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("status %d", resp.StatusCode)
	}
	return io.ReadAll(io.LimitReader(resp.Body, 2*1024*1024))
}

func normalizeFreeProxyLine(line string, defaultScheme string) (string, string, string, int, bool) {
	line = strings.TrimSpace(line)
	if line == "" {
		return "", "", "", 0, false
	}
	if defaultScheme == "" {
		defaultScheme = "http"
	}
	if !strings.HasPrefix(line, "http://") && !strings.HasPrefix(line, "https://") && !strings.HasPrefix(line, "socks4://") && !strings.HasPrefix(line, "socks5://") {
		line = defaultScheme + "://" + line
	}
	parsed, err := url.Parse(line)
	if err != nil {
		return "", "", "", 0, false
	}
	port, err := strconv.Atoi(parsed.Port())
	if err != nil || port < 1 || port > 65535 || parsed.Hostname() == "" {
		return "", "", "", 0, false
	}
	scheme := parsed.Scheme
	if scheme != "http" && scheme != "https" && scheme != "socks4" && scheme != "socks5" {
		return "", "", "", 0, false
	}
	return parsed.String(), scheme, parsed.Hostname(), port, true
}

func freeProxyRegions(store *database.Store) ([]string, error) {
	activeRegions, err := store.GetActiveFreeProxyRegions()
	if err != nil {
		return nil, err
	}
	starterRegions := strings.Split(settingString(store, "free_proxy_starter_regions", "de,fr,it,es,nl,be,at"), ",")
	seen := make(map[string]bool)
	regions := make([]string, 0, len(activeRegions)+len(starterRegions))
	for _, region := range append(starterRegions, activeRegions...) {
		region = strings.TrimSpace(strings.ToLower(region))
		if region == "" || seen[region] {
			continue
		}
		seen[region] = true
		regions = append(regions, region)
	}
	if len(regions) == 0 {
		regions = append(regions, "de")
	}
	return regions, nil
}

func freeProxyImportURLs(store *database.Store, importURL string) []string {
	urls := make([]string, 0)
	if !strings.Contains(importURL, "raw.githubusercontent.com/iplocate/free-proxy-list/main") {
		return []string{importURL}
	}
	seen := make(map[string]bool)
	supportedCountries := map[string]bool{
		"ar": true, "bd": true, "br": true, "ca": true, "ch": true, "cn": true,
		"co": true, "cz": true, "de": true, "ec": true, "ee": true, "fi": true,
		"fr": true, "gb": true, "gh": true, "hk": true, "hu": true, "id": true,
		"in": true, "iq": true, "jp": true, "ke": true, "kh": true, "kr": true,
		"lv": true, "md": true, "me": true, "my": true, "nl": true, "pk": true,
		"ps": true, "ru": true, "se": true, "sg": true, "sy": true, "tr": true,
		"ua": true, "us": true, "uz": true, "ve": true, "vn": true, "za": true,
		"zw": true,
	}
	regions, err := freeProxyRegions(store)
	if err != nil {
		return []string{importURL}
	}
	for _, region := range regions {
		region = strings.ToLower(strings.TrimSpace(region))
		country := region
		if region == "uk" {
			country = "gb"
		}
		if !supportedCountries[country] {
			continue
		}
		countryURL := "https://raw.githubusercontent.com/iplocate/free-proxy-list/main/countries/" + strings.ToUpper(country) + "/proxies.txt"
		if seen[countryURL] {
			continue
		}
		seen[countryURL] = true
		urls = append(urls, countryURL)
	}
	if !seen[importURL] {
		urls = append(urls, importURL)
	}
	return urls
}

func freeProxySource(store *database.Store, importURL string) string {
	if region := iplocateCountryFromURL(importURL); region != "" {
		return "iplocate:" + region
	}
	if source := settingString(store, "free_proxy_import_source", ""); source != "" {
		if strings.HasPrefix(source, "iplocate") {
			return "iplocate"
		}
		if strings.HasPrefix(source, "proxyscrape") {
			return "proxyscrape"
		}
	}
	if strings.Contains(importURL, "iplocate/free-proxy-list") {
		return "iplocate"
	}
	if strings.Contains(importURL, "proxyscrape") {
		return "proxyscrape"
	}
	return "manual"
}

func iplocateCountryFromURL(importURL string) string {
	const marker = "/countries/"
	markerIndex := strings.Index(importURL, marker)
	if markerIndex < 0 {
		return ""
	}
	remainder := importURL[markerIndex+len(marker):]
	separatorIndex := strings.IndexByte(remainder, '/')
	if separatorIndex <= 0 {
		return ""
	}
	country := strings.ToLower(strings.TrimSpace(remainder[:separatorIndex]))
	if len(country) != 2 {
		return ""
	}
	if country == "gb" {
		return "uk"
	}
	return country
}

func defaultSchemeForImportURL(importURL string) string {
	switch {
	case strings.Contains(importURL, "/protocols/https"):
		return "https"
	case strings.Contains(importURL, "/protocols/socks4"):
		return "socks4"
	case strings.Contains(importURL, "/protocols/socks5"):
		return "socks5"
	default:
		return "http"
	}
}

func settingBool(store *database.Store, key string, fallback bool) bool {
	value, ok, err := store.GetSettingValue(key)
	if err != nil || !ok {
		return fallback
	}
	return strings.TrimSpace(value) == "true"
}

func settingString(store *database.Store, key string, fallback string) string {
	value, ok, err := store.GetSettingValue(key)
	if err != nil || !ok {
		return fallback
	}
	value = strings.TrimSpace(value)
	if value == "" {
		return fallback
	}
	return value
}

func settingInt(store *database.Store, key string, fallback int) int {
	if strings.ToUpper(key) == key {
		if value := strings.TrimSpace(os.Getenv(key)); value != "" {
			parsed, err := strconv.Atoi(value)
			if err == nil && parsed > 0 {
				return parsed
			}
		}
	}
	value, ok, err := store.GetSettingValue(key)
	if err != nil || !ok {
		return fallback
	}
	parsed, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}

func mustEnv(key string) string {
	val := os.Getenv(key)
	if val == "" {
		log.Fatalf("Required env var %s not set", key)
	}
	return val
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}
