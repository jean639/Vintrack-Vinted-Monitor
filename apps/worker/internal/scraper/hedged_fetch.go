package scraper

import (
	"context"
	"fmt"
	"time"

	"vintrack-worker/internal/model"
)

type catalogFetchResult struct {
	items    []model.VintedItem
	status   int
	err      error
	client   *Client
	duration time.Duration
}

func (e *Engine) fetchCatalogHedged(ctx context.Context, pool *ClientPool, apiURL string, domain string) catalogFetchResult {
	hedgeDelay := time.Duration(getEnvInt("CATALOG_HEDGE_DELAY_MS", 250)) * time.Millisecond
	return e.fetchCatalogHedgedWithDelay(ctx, pool, apiURL, domain, hedgeDelay)
}

func (e *Engine) fetchCatalogHedgedWithDelay(ctx context.Context, pool *ClientPool, apiURL string, domain string, hedgeDelay time.Duration) catalogFetchResult {
	if pool == nil {
		startedAt := time.Now()
		items, status, err := e.fetcher.FetchCatalog(ctx, nil, apiURL, domain)
		return catalogFetchResult{items: items, status: status, err: err, duration: time.Since(startedAt)}
	}

	primary := pool.Acquire(nil)
	if primary == nil {
		return catalogFetchResult{err: fmt.Errorf("no healthy catalog client available")}
	}

	requestCtx, cancel := context.WithCancel(ctx)
	results := make(chan catalogFetchResult, 2)
	launch := func(client *Client) {
		go func() {
			startedAt := time.Now()
			items, status, err := e.fetcher.FetchCatalog(requestCtx, client, apiURL, domain)
			duration := time.Since(startedAt)
			pool.Report(client, status, duration, err)
			results <- catalogFetchResult{
				items: items, status: status, err: err, client: client, duration: duration,
			}
		}()
	}

	launch(primary)
	launched := 1
	completed := 0
	secondaryLaunched := false
	if hedgeDelay < 0 {
		hedgeDelay = 0
	}
	timer := time.NewTimer(hedgeDelay)
	defer timer.Stop()
	defer func() {
		if completed >= launched {
			cancel()
		}
	}()

	launchSecondary := func() bool {
		if secondaryLaunched {
			return false
		}
		secondaryLaunched = true
		secondary := pool.Acquire(primary)
		if secondary == nil {
			return false
		}
		launched++
		launch(secondary)
		return true
	}

	last := catalogFetchResult{}
	for completed < launched || !secondaryLaunched {
		select {
		case result := <-results:
			completed++
			last = result
			if result.err == nil && result.status == 200 {
				cancel()
				return result
			}
			if !secondaryLaunched {
				launchSecondary()
			}
			if completed >= launched && secondaryLaunched {
				cancel()
				return last
			}
		case <-timer.C:
			launchSecondary()
			if completed >= launched && secondaryLaunched {
				cancel()
				return last
			}
		case <-ctx.Done():
			cancel()
			if last.err == nil {
				last.err = ctx.Err()
			}
			return last
		}
	}

	cancel()
	return last
}
