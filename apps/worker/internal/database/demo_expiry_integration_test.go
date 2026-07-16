package database

import (
	"database/sql"
	"fmt"
	"os"
	"testing"
	"time"
)

func TestPauseExpiredDemoMonitors(t *testing.T) {
	if os.Getenv("VINTRACK_DATABASE_INTEGRATION_TEST") != "true" {
		t.Skip("set VINTRACK_DATABASE_INTEGRATION_TEST=true to run")
	}

	db, err := sql.Open("postgres", os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Fatalf("open database: %v", err)
	}
	defer db.Close()
	if err := db.Ping(); err != nil {
		t.Fatalf("ping database: %v", err)
	}

	userID := fmt.Sprintf("demo-expiry-test-%d", time.Now().UnixNano())
	if _, err := db.Exec(`INSERT INTO "User" (id, role, monitor_onboarding_status) VALUES ($1, 'free', 'completed')`, userID); err != nil {
		t.Fatalf("create test user: %v", err)
	}
	defer db.Exec(`DELETE FROM "User" WHERE id = $1`, userID)

	insertMonitor := func(name string, expiresAt *time.Time) int {
		t.Helper()
		var id int
		err := db.QueryRow(`
			INSERT INTO monitors ("userId", name, query, status, demo_expires_at)
			VALUES ($1, $2, '', 'active', $3)
			RETURNING id`, userID, name, expiresAt).Scan(&id)
		if err != nil {
			t.Fatalf("create %s monitor: %v", name, err)
		}
		return id
	}

	expiredAt := time.Now().UTC().Add(-time.Minute)
	futureAt := time.Now().UTC().Add(time.Hour)
	expiredID := insertMonitor("Expired demo", &expiredAt)
	futureID := insertMonitor("Future demo", &futureAt)
	normalID := insertMonitor("Normal monitor", nil)

	store := &Store{db: db}
	expiredIDs, err := store.PauseExpiredDemoMonitors()
	if err != nil {
		t.Fatalf("pause expired demos: %v", err)
	}
	if len(expiredIDs) != 1 || expiredIDs[0] != expiredID {
		t.Fatalf("expired ids = %v, want [%d]", expiredIDs, expiredID)
	}

	for id, expected := range map[int]string{
		expiredID: "paused",
		futureID:  "active",
		normalID:  "active",
	} {
		var status string
		if err := db.QueryRow(`SELECT status FROM monitors WHERE id = $1`, id).Scan(&status); err != nil {
			t.Fatalf("read monitor %d: %v", id, err)
		}
		if status != expected {
			t.Errorf("monitor %d status = %q, want %q", id, status, expected)
		}
	}

	var eventCount int
	if err := db.QueryRow(`SELECT COUNT(*) FROM monitor_events WHERE monitor_id = $1 AND event_type = 'demo_auto_paused'`, expiredID).Scan(&eventCount); err != nil {
		t.Fatalf("read demo event: %v", err)
	}
	if eventCount != 1 {
		t.Fatalf("demo auto-pause events = %d, want 1", eventCount)
	}
}
