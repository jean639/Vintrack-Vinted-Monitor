package proxy

import "testing"

func TestRegionPoolsRetainClearsRemovedManagers(t *testing.T) {
	pools := NewRegionPools()
	removed := pools.Manager("fr")
	pools.Replace("de", "http://1.2.3.4:8080")
	pools.Replace("fr", "http://5.6.7.8:8080")

	pools.Retain([]string{"de"})

	if got := pools.Manager("de").Count(); got != 1 {
		t.Fatalf("retained pool count = %d, want 1", got)
	}
	if got := removed.Count(); got != 0 {
		t.Fatalf("removed manager count = %d, want 0", got)
	}
	if current := pools.Manager("fr"); current == removed {
		t.Fatal("removed region returned its stale manager")
	}
}
