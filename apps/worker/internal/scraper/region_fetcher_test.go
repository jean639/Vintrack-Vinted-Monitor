package scraper

import "testing"

func TestSellerInfoCache_SetAndGet(t *testing.T) {
	cache := &sellerInfoCache{
		cache: make(map[int64]sellerCacheEntry, 16),
	}

	info := SellerInfo{Region: "🇩🇪 DE", Rating: "⭐ 4.5 (10)"}
	cache.Set(123, info)

	got, ok := cache.Get(123)
	if !ok {
		t.Fatal("Expected cache hit for user 123")
	}
	if got.Region != info.Region {
		t.Errorf("Region = %q, want %q", got.Region, info.Region)
	}
	if got.Rating != info.Rating {
		t.Errorf("Rating = %q, want %q", got.Rating, info.Rating)
	}
}

func TestSellerInfoCache_Miss(t *testing.T) {
	cache := &sellerInfoCache{
		cache: make(map[int64]sellerCacheEntry, 16),
	}

	_, ok := cache.Get(999)
	if ok {
		t.Error("Expected cache miss for non-existent user")
	}
}

func TestSellerInfoCache_Overwrite(t *testing.T) {
	cache := &sellerInfoCache{
		cache: make(map[int64]sellerCacheEntry, 16),
	}

	cache.Set(1, SellerInfo{Region: "🇩🇪 DE"})
	cache.Set(1, SellerInfo{Region: "🇫🇷 FR"})

	got, _ := cache.Get(1)
	if got.Region != "🇫🇷 FR" {
		t.Errorf("Overwritten region = %q, want '🇫🇷 FR'", got.Region)
	}
}

func TestISOCountryMap_Coverage(t *testing.T) {
	expectedCodes := []string{"DE", "FR", "IT", "ES", "NL", "PL", "AT", "BE", "GB", "UK", "LU", "PT"}
	for _, code := range expectedCodes {
		if _, ok := isoCountryMap[code]; !ok {
			t.Errorf("isoCountryMap missing code %q", code)
		}
	}
}

func TestIsSellerInfoComplete(t *testing.T) {
	if isSellerInfoComplete(SellerInfo{Region: "🇩🇪 DE"}) {
		t.Fatal("expected incomplete info when rating is missing")
	}
	if !isSellerInfoComplete(SellerInfo{Region: "🇩🇪 DE", Rating: "⭐ 5.0 (1)"}) {
		t.Fatal("expected complete info when region and rating are present")
	}
}
