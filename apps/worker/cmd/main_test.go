package main

import (
	"reflect"
	"testing"
	"time"

	"vintrack-worker/internal/database"
)

func TestFreeProxyValidationTimeout(t *testing.T) {
	tests := []struct {
		name         string
		maxLatencyMs int
		want         time.Duration
	}{
		{name: "default", maxLatencyMs: 0, want: 4 * time.Second},
		{name: "normal", maxLatencyMs: 2500, want: 4 * time.Second},
		{name: "custom", maxLatencyMs: 4000, want: 5500 * time.Millisecond},
		{name: "capped", maxLatencyMs: 15000, want: 8 * time.Second},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := freeProxyValidationTimeout(test.maxLatencyMs); got != test.want {
				t.Fatalf("freeProxyValidationTimeout(%d) = %s, want %s", test.maxLatencyMs, got, test.want)
			}
		})
	}
}

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

func TestInterleaveFreeProxyImportCandidatesRedistributesUnusedQuota(t *testing.T) {
	sources := [][]freeProxyImportCandidate{
		{
			{ProxyURL: "http://country-1:80", Source: "iplocate:de"},
		},
		{
			{ProxyURL: "http://global-1:80", Source: "iplocate"},
			{ProxyURL: "http://global-2:80", Source: "iplocate"},
			{ProxyURL: "http://global-3:80", Source: "iplocate"},
		},
	}

	got := interleaveFreeProxyImportCandidates(sources, 4)
	want := []freeProxyImportCandidate{
		{ProxyURL: "http://country-1:80", Source: "iplocate:de"},
		{ProxyURL: "http://global-1:80", Source: "iplocate"},
		{ProxyURL: "http://global-2:80", Source: "iplocate"},
		{ProxyURL: "http://global-3:80", Source: "iplocate"},
	}

	if !reflect.DeepEqual(got, want) {
		t.Fatalf("interleaveFreeProxyImportCandidates() = %#v, want %#v", got, want)
	}
}

func TestInterleaveFreeProxyImportCandidatesKeepsFirstSourceAttribution(t *testing.T) {
	sources := [][]freeProxyImportCandidate{
		{
			{ProxyURL: "http://shared:80", Source: "iplocate:de"},
			{ProxyURL: "http://country-2:80", Source: "iplocate:de"},
		},
		{
			{ProxyURL: "http://shared:80", Source: "iplocate"},
			{ProxyURL: "http://global-2:80", Source: "iplocate"},
		},
	}

	got := interleaveFreeProxyImportCandidates(sources, 3)
	want := []freeProxyImportCandidate{
		{ProxyURL: "http://shared:80", Source: "iplocate:de"},
		{ProxyURL: "http://global-2:80", Source: "iplocate"},
		{ProxyURL: "http://country-2:80", Source: "iplocate:de"},
	}

	if !reflect.DeepEqual(got, want) {
		t.Fatalf("interleaveFreeProxyImportCandidates() = %#v, want %#v", got, want)
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
