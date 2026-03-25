package scraper

import (
	"context"
	"log"
	"sync"

	"vintrack-worker/internal/database"
)

type Manager struct {
	store      *database.Store
	engine     *Engine
	running    map[int]context.CancelFunc
	monitorCfg map[int]string
	mu         sync.Mutex
}

func NewManager(store *database.Store, engine *Engine) *Manager {
	return &Manager{
		store:      store,
		engine:     engine,
		running:    make(map[int]context.CancelFunc),
		monitorCfg: make(map[int]string),
	}
}

func (m *Manager) Sync(ctx context.Context) {
	monitors, err := m.store.GetActiveMonitors()
	if err != nil {
		log.Printf("Error fetching monitors: %v", err)
		return
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	activeIDs := make(map[int]bool, len(monitors))

	for _, mon := range monitors {
		activeIDs[mon.ID] = true
		hash := monitorConfigFingerprint(mon)

		if cancelFn, exists := m.running[mon.ID]; exists {
			if oldHash, ok := m.monitorCfg[mon.ID]; ok && oldHash != hash {
				log.Printf("Config changed for monitor [%d], restarting...", mon.ID)
				cancelFn()
				delete(m.running, mon.ID)
			} else {
				continue
			}
		}

		mCtx, mCancel := context.WithCancel(ctx)
		m.running[mon.ID] = mCancel
		m.monitorCfg[mon.ID] = hash
		go m.engine.MonitorTask(mCtx, mon)
	}

	for id, cancelFn := range m.running {
		if !activeIDs[id] {
			log.Printf("Stopping monitor [%d] (removed/paused)", id)
			cancelFn()
			delete(m.running, id)
			delete(m.monitorCfg, id)
		}
	}
}

func (m *Manager) StopAll() {
	m.mu.Lock()
	defer m.mu.Unlock()

	for id, cancelFn := range m.running {
		cancelFn()
		delete(m.running, id)
		delete(m.monitorCfg, id)
	}
}
