package scraper

import (
	"context"
	"log"
	"os"

	"vintrack-worker/internal/model"
)

type CatalogFetcher interface {
	FetchCatalog(ctx context.Context, client *Client, apiURL string, domain string) ([]model.VintedItem, int, error)
	RequiresNetwork() bool
	Name() string
}

func NewCatalogFetcherFromEnv() CatalogFetcher {
	mode := os.Getenv("VINTED_FETCH_MODE")
	if mode == "mock" {
		fetcher, err := NewMockCatalogFetcher(os.Getenv("VINTED_MOCK_SCENARIO"))
		if err != nil {
			log.Printf("mock catalog fetcher init failed: %v; falling back to live Vinted API", err)
			return VintedCatalogFetcher{}
		}
		return fetcher
	}

	return VintedCatalogFetcher{}
}
