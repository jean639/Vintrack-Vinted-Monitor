package scraper

import (
	"testing"
	"time"

	"vintrack-worker/internal/proxy"
)

func TestClassifyPreindexResponseRequiresIdentityRedirect(t *testing.T) {
	tests := []struct {
		name     string
		status   int
		location string
		want     string
		wantSlug string
	}{
		{name: "canonical redirect", status: 307, location: "https://www.vinted.de/items/123-blue-shirt?referrer=catalog", want: "hit", wantSlug: "blue-shirt"},
		{name: "relative redirect", status: 302, location: "/items/123-blue-shirt", want: "hit", wantSlug: "blue-shirt"},
		{name: "different id", status: 307, location: "/items/124-blue-shirt", want: "unexpected"},
		{name: "challenge page", status: 200, want: "unexpected"},
		{name: "not created", status: 404, want: "miss"},
		{name: "rate limited", status: 429, want: "blocked"},
		{name: "upstream failure", status: 503, want: "error"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			outcome, slug := classifyPreindexResponse(tt.status, tt.location, 123)
			if outcome != tt.want || slug != tt.wantSlug {
				t.Fatalf("classifyPreindexResponse() = (%q, %q), want (%q, %q)", outcome, slug, tt.want, tt.wantSlug)
			}
		})
	}
}

func TestNextPreindexSampleID(t *testing.T) {
	tests := []struct {
		seed   int64
		stride int64
	}{
		{seed: 9415840881, stride: 100},
		{seed: 200, stride: 100},
		{seed: -1, stride: 100},
		{seed: 42, stride: 0},
	}
	for _, tt := range tests {
		got := nextPreindexSampleID(tt.seed, tt.stride)
		if got <= max(tt.seed, 0) {
			t.Errorf("nextPreindexSampleID(%d, %d) = %d, want a greater ID", tt.seed, tt.stride, got)
		}
	}
}

func TestNextPreindexSampleIDVariesResidueAcrossBlocks(t *testing.T) {
	residues := make(map[int64]bool)
	next := int64(9_000_000_000)
	for range 20 {
		next = nextPreindexSampleID(next, 100)
		residues[next%100] = true
	}
	if len(residues) < 10 {
		t.Fatalf("only %d distinct residues across 20 blocks", len(residues))
	}
}

func TestPreindexBlockBackoffIsCapped(t *testing.T) {
	tests := []struct {
		consecutive int
		want        time.Duration
	}{
		{consecutive: 0, want: 0},
		{consecutive: 1, want: 0},
		{consecutive: 2, want: time.Second},
		{consecutive: 5, want: 8 * time.Second},
		{consecutive: 20, want: 60 * time.Second},
	}
	for _, tt := range tests {
		if got := preindexBlockBackoff(tt.consecutive); got != tt.want {
			t.Errorf("preindexBlockBackoff(%d) = %s, want %s", tt.consecutive, got, tt.want)
		}
	}
}

func TestClientPoolRoundRobinSkipsCoolingSessions(t *testing.T) {
	first := &Client{ProxyURL: "first"}
	second := &Client{ProxyURL: "second"}
	third := &Client{ProxyURL: "third"}
	pool := &ClientPool{states: []*clientState{
		{client: first},
		{client: second, cooldownUntil: time.Now().Add(time.Minute)},
		{client: third},
	}}

	if got := pool.AcquireRoundRobin(); got != first {
		t.Fatalf("first AcquireRoundRobin() = %v, want first", got)
	}
	pool.Report(first, 200, 10*time.Millisecond, nil)
	if got := pool.AcquireRoundRobin(); got != third {
		t.Fatalf("second AcquireRoundRobin() = %v, want third", got)
	}
}

func TestClientPoolUsesScannerRequestTimeout(t *testing.T) {
	pm := proxy.FromString("http://127.0.0.1:8080")
	pool := NewClientPoolWithTimeout(pm, "www.vinted.de", 1, nil, 2*time.Second)
	if pool.requestTimeout != 2*time.Second {
		t.Fatalf("request timeout = %s, want 2s", pool.requestTimeout)
	}
}

func TestClampPreindexProxyOffsetKeepsRoomForPool(t *testing.T) {
	tests := []struct {
		proxyCount int
		poolSize   int
		configured int
		want       int
	}{
		{proxyCount: 90, poolSize: 8, configured: 32, want: 32},
		{proxyCount: 25, poolSize: 8, configured: 32, want: 17},
		{proxyCount: 5, poolSize: 8, configured: 32, want: 0},
		{proxyCount: 90, poolSize: 8, configured: -1, want: 0},
	}
	for _, tt := range tests {
		if got := clampPreindexProxyOffset(tt.proxyCount, tt.poolSize, tt.configured); got != tt.want {
			t.Errorf("clampPreindexProxyOffset(%d, %d, %d) = %d, want %d", tt.proxyCount, tt.poolSize, tt.configured, got, tt.want)
		}
	}
}

func TestRecordPreindexCandidateAttemptAdvancesAfterLimit(t *testing.T) {
	attempts := 0
	for index := 1; index <= 10; index++ {
		var advance bool
		attempts, advance = recordPreindexCandidateAttempt("unexpected", attempts, 10)
		if advance != (index == 10) {
			t.Fatalf("attempt %d advance = %v", index, advance)
		}
	}
	if attempts != 0 {
		t.Fatalf("attempts after advance = %d, want 0", attempts)
	}
	if attempts, advance := recordPreindexCandidateAttempt("hit", 7, 10); attempts != 0 || advance {
		t.Fatalf("hit returned attempts=%d advance=%v", attempts, advance)
	}
}
