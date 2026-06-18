package scraper

import (
	"context"
	"testing"
	"time"
)

func TestMockCatalogFetcher_GeneratesNewItemsOnInterval(t *testing.T) {
	t.Setenv("VINTED_MOCK_DROP_INTERVAL_MS", "1")

	fetcher, err := NewMockCatalogFetcher("new-items")
	if err != nil {
		t.Fatalf("NewMockCatalogFetcher() error = %v", err)
	}

	ctx := context.Background()

	first, status, err := fetcher.FetchCatalog(ctx, nil, "https://example.test/api", "www.vinted.de")
	if err != nil {
		t.Fatalf("first FetchCatalog() error = %v", err)
	}
	if status != 200 {
		t.Fatalf("first status = %d, want 200", status)
	}
	if len(first) != 2 {
		t.Fatalf("first len = %d, want 2", len(first))
	}

	time.Sleep(2 * time.Millisecond)

	second, _, err := fetcher.FetchCatalog(ctx, nil, "https://example.test/api", "www.vinted.de")
	if err != nil {
		t.Fatalf("second FetchCatalog() error = %v", err)
	}
	if len(second) != 3 {
		t.Fatalf("second len = %d, want 3", len(second))
	}
	if second[0].ID == 900001 || second[0].ID == 900002 {
		t.Fatalf("first streamed item ID = %d, want generated ID", second[0].ID)
	}
	if second[0].Photo.Url == "" || second[0].Photo.Url[:13] != "/mock-images/" {
		t.Fatalf("generated image URL = %q, want /mock-images path", second[0].Photo.Url)
	}
}

func TestMockCatalogFetcher_StaticScenarioRepeatsLastStep(t *testing.T) {
	fetcher, err := NewMockCatalogFetcher("anti-keywords")
	if err != nil {
		t.Fatalf("NewMockCatalogFetcher() error = %v", err)
	}

	ctx := context.Background()
	_, _, err = fetcher.FetchCatalog(ctx, nil, "https://example.test/api", "www.vinted.de")
	if err != nil {
		t.Fatalf("first FetchCatalog() error = %v", err)
	}
	second, _, err := fetcher.FetchCatalog(ctx, nil, "https://example.test/api", "www.vinted.de")
	if err != nil {
		t.Fatalf("second FetchCatalog() error = %v", err)
	}
	third, _, err := fetcher.FetchCatalog(ctx, nil, "https://example.test/api", "www.vinted.de")
	if err != nil {
		t.Fatalf("third FetchCatalog() error = %v", err)
	}
	if len(second) != len(third) || second[0].ID != third[0].ID {
		t.Fatalf("static scenario should repeat last step")
	}
}

func TestMockCatalogFetcher_RateLimitedScenario(t *testing.T) {
	fetcher, err := NewMockCatalogFetcher("rate-limited")
	if err != nil {
		t.Fatalf("NewMockCatalogFetcher() error = %v", err)
	}

	_, status, err := fetcher.FetchCatalog(context.Background(), nil, "https://example.test/api", "www.vinted.de")
	if err != nil {
		t.Fatalf("FetchCatalog() error = %v", err)
	}
	if status != 429 {
		t.Fatalf("status = %d, want 429", status)
	}
}

func TestNewCatalogFetcherFromEnv_MockMode(t *testing.T) {
	t.Setenv("VINTED_FETCH_MODE", "mock")
	t.Setenv("VINTED_MOCK_SCENARIO", "empty")

	fetcher := NewCatalogFetcherFromEnv()
	if fetcher.RequiresNetwork() {
		t.Fatal("mock fetcher should not require network")
	}
	if fetcher.Name() != "mock:empty" {
		t.Fatalf("fetcher.Name() = %q, want mock:empty", fetcher.Name())
	}
}
