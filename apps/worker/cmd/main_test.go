package main

import (
	"reflect"
	"testing"

	"vintrack-worker/internal/database"
)

func TestInterleaveFreeProxyCandidates(t *testing.T) {
	batches := [][]database.FreeProxyCandidate{
		{{ProxyURL: "de-1", Region: "de"}, {ProxyURL: "de-2", Region: "de"}},
		{{ProxyURL: "fr-1", Region: "fr"}},
		{{ProxyURL: "it-1", Region: "it"}, {ProxyURL: "it-2", Region: "it"}},
	}

	got := interleaveFreeProxyCandidates(batches)
	want := []database.FreeProxyCandidate{
		{ProxyURL: "de-1", Region: "de"},
		{ProxyURL: "fr-1", Region: "fr"},
		{ProxyURL: "it-1", Region: "it"},
		{ProxyURL: "de-2", Region: "de"},
		{ProxyURL: "it-2", Region: "it"},
	}

	if !reflect.DeepEqual(got, want) {
		t.Fatalf("interleaveFreeProxyCandidates() = %#v, want %#v", got, want)
	}
}

func TestIPLocateCountryFromURL(t *testing.T) {
	tests := map[string]string{
		"https://raw.githubusercontent.com/iplocate/free-proxy-list/main/countries/DE/proxies.txt": "de",
		"https://raw.githubusercontent.com/iplocate/free-proxy-list/main/countries/GB/proxies.txt": "uk",
		"https://raw.githubusercontent.com/iplocate/free-proxy-list/main/all-proxies.txt":          "",
		"https://example.test/countries/invalid":                                                   "",
	}

	for rawURL, want := range tests {
		if got := iplocateCountryFromURL(rawURL); got != want {
			t.Errorf("iplocateCountryFromURL(%q) = %q, want %q", rawURL, got, want)
		}
	}
}
