package scraper

import (
	"context"
	"fmt"
	"time"

	"vintrack-worker/internal/model"
)

type FreeProxyValidationResult struct {
	LatencyMs  int
	StatusCode int
}

func ValidateFreeProxy(ctx context.Context, proxyURL string, region string, maxLatencyMs int) (FreeProxyValidationResult, error) {
	if maxLatencyMs <= 0 {
		maxLatencyMs = 2500
	}
	client, err := NewClient(proxyURL, nil)
	if err != nil {
		return FreeProxyValidationResult{}, err
	}

	start := time.Now()
	domain := model.RegionDomain(region)
	monitor := model.Monitor{Region: region}
	items, status, err := VintedCatalogFetcher{}.FetchCatalog(ctx, client, BuildVintedURL(monitor), domain)
	_ = items
	latencyMs := int(time.Since(start).Milliseconds())
	if err != nil {
		return FreeProxyValidationResult{LatencyMs: latencyMs, StatusCode: status}, err
	}
	if status != 200 {
		return FreeProxyValidationResult{LatencyMs: latencyMs, StatusCode: status}, fmt.Errorf("catalog returned %d", status)
	}
	if latencyMs > maxLatencyMs {
		return FreeProxyValidationResult{LatencyMs: latencyMs, StatusCode: status}, fmt.Errorf("catalog latency %dms exceeds %dms", latencyMs, maxLatencyMs)
	}
	return FreeProxyValidationResult{LatencyMs: latencyMs, StatusCode: status}, nil
}
