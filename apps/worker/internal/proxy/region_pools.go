package proxy

import "sync"

type RegionPools struct {
	mu    sync.RWMutex
	pools map[string]*Manager
}

func NewRegionPools() *RegionPools {
	return &RegionPools{pools: make(map[string]*Manager)}
}

func (p *RegionPools) Manager(region string) *Manager {
	p.mu.RLock()
	manager := p.pools[region]
	p.mu.RUnlock()
	if manager != nil {
		return manager
	}

	p.mu.Lock()
	defer p.mu.Unlock()
	if manager = p.pools[region]; manager != nil {
		return manager
	}
	manager = &Manager{}
	p.pools[region] = manager
	return manager
}

func (p *RegionPools) Replace(region string, raw string) bool {
	return p.Manager(region).ReplaceFromString(raw)
}

func (p *RegionPools) Version(region string) uint64 {
	return p.Manager(region).Version()
}
