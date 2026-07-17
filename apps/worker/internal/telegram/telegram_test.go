package telegram

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"vintrack-worker/internal/model"
)

func withTelegramServer(t *testing.T, handler http.HandlerFunc) {
	t.Helper()

	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)

	oldBaseURL := apiBaseURL
	oldClient := httpClient
	oldRetryBackoff := retryBackoff
	oldToken, hadToken := os.LookupEnv("TELEGRAM_BOT_TOKEN")
	oldDashboardURL, hadDashboardURL := os.LookupEnv("DASHBOARD_URL")

	apiBaseURL = server.URL
	httpClient = server.Client()
	httpClient.Timeout = 2 * time.Second
	retryBackoff = 0
	os.Setenv("TELEGRAM_BOT_TOKEN", "test-token")
	os.Unsetenv("DASHBOARD_URL")

	t.Cleanup(func() {
		apiBaseURL = oldBaseURL
		httpClient = oldClient
		retryBackoff = oldRetryBackoff
		if hadToken {
			os.Setenv("TELEGRAM_BOT_TOKEN", oldToken)
		} else {
			os.Unsetenv("TELEGRAM_BOT_TOKEN")
		}
		if hadDashboardURL {
			os.Setenv("DASHBOARD_URL", oldDashboardURL)
		} else {
			os.Unsetenv("DASHBOARD_URL")
		}
	})
}

func TestSendItemUsesPhotoAndEscapesCaption(t *testing.T) {
	var payload map[string]interface{}
	withTelegramServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/bottest-token/sendPhoto" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatalf("decode payload: %v", err)
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"ok":true}`))
	})

	SendItem("-1001", model.Item{
		ID:        10,
		MonitorID: 7,
		Title:     "Nike <Dunk>",
		Brand:     "A&B",
		Price:     "12 EUR",
		Size:      "42",
		Condition: "New",
		URL:       "https://example.test/item?x=1&y=2",
		ImageURL:  "https://example.test/image.jpg",
	}, "monitor <one>", "server")

	if payload["chat_id"] != "-1001" {
		t.Fatalf("unexpected chat_id: %v", payload["chat_id"])
	}
	if payload["photo"] != "https://example.test/image.jpg" {
		t.Fatalf("unexpected photo: %v", payload["photo"])
	}
	caption, _ := payload["caption"].(string)
	if !strings.Contains(caption, "Nike &lt;Dunk&gt;") {
		t.Fatalf("caption did not escape title: %q", caption)
	}
	if strings.Contains(caption, "A&B") {
		t.Fatalf("caption did not escape brand: %q", caption)
	}
}

func TestSendItemFallsBackToMessageWhenPhotoFails(t *testing.T) {
	var calls []string
	withTelegramServer(t, func(w http.ResponseWriter, r *http.Request) {
		calls = append(calls, r.URL.Path)
		if r.URL.Path == "/bottest-token/sendPhoto" {
			http.Error(w, "bad photo", http.StatusBadRequest)
			return
		}
		if r.URL.Path != "/bottest-token/sendMessage" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"ok":true}`))
	})

	SendItem("-1001", model.Item{
		MonitorID: 7,
		Title:     "Item",
		Price:     "12 EUR",
		URL:       "https://example.test/item",
		ImageURL:  "https://example.test/image.jpg",
	}, "monitor", "server")

	if len(calls) != 2 {
		t.Fatalf("expected photo plus fallback message, got %v", calls)
	}
}

func TestSendItemRetriesPhotoTimeout(t *testing.T) {
	var calls int32
	var paths []string
	var pathsMu sync.Mutex
	withTelegramServer(t, func(w http.ResponseWriter, r *http.Request) {
		pathsMu.Lock()
		paths = append(paths, r.URL.Path)
		pathsMu.Unlock()
		if r.URL.Path != "/bottest-token/sendPhoto" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		if atomic.AddInt32(&calls, 1) == 1 {
			time.Sleep(50 * time.Millisecond)
			return
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"ok":true}`))
	})
	httpClient.Timeout = 10 * time.Millisecond

	SendItem("-1001", model.Item{
		MonitorID: 7,
		Title:     "Item",
		Price:     "12 EUR",
		URL:       "https://example.test/item",
		ImageURL:  "https://example.test/image.jpg",
	}, "monitor", "server")

	pathsMu.Lock()
	gotPaths := append([]string(nil), paths...)
	pathsMu.Unlock()
	if gotCalls := atomic.LoadInt32(&calls); gotCalls != 2 {
		t.Fatalf("expected timeout retry, got %d calls: %v", gotCalls, gotPaths)
	}
}

func TestSafeTelegramRequestErrorRedactsEndpoint(t *testing.T) {
	cause := fmt.Errorf("Post https://api.telegram.org/botsecret-token/sendPhoto: %w", errors.New("unexpected EOF"))
	err := safeTelegramRequestError(cause)
	if strings.Contains(err.Error(), "secret-token") {
		t.Fatalf("safe error exposed token: %q", err.Error())
	}
	if err.Error() != "telegram request failed" {
		t.Fatalf("safe error = %q", err.Error())
	}
}

func TestSendItemSkipsInvalidDashboardButton(t *testing.T) {
	var payload map[string]interface{}
	withTelegramServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/bottest-token/sendMessage" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatalf("decode payload: %v", err)
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"ok":true}`))
	})

	SendItem("-1001", model.Item{
		MonitorID: 7,
		Title:     "Item",
		Price:     "12 EUR",
		URL:       "https://example.test/item",
	}, "monitor", "server")

	keyboard := payload["reply_markup"].(map[string]interface{})
	rows := keyboard["inline_keyboard"].([]interface{})
	buttons := rows[0].([]interface{})
	if len(buttons) != 1 {
		t.Fatalf("expected only vinted button when dashboard URL is local, got %d", len(buttons))
	}
	button := buttons[0].(map[string]interface{})
	if button["text"] != "View on Vinted" {
		t.Fatalf("unexpected button: %v", button)
	}
}

func TestSendItemIncludesPublicDashboardButton(t *testing.T) {
	var payload map[string]interface{}
	withTelegramServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/bottest-token/sendMessage" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatalf("decode payload: %v", err)
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"ok":true}`))
	})
	os.Setenv("DASHBOARD_URL", "https://dashboard.example.test")

	SendItem("-1001", model.Item{
		MonitorID: 7,
		Title:     "Item",
		Price:     "12 EUR",
		URL:       "https://example.test/item",
	}, "monitor", "server")

	keyboard := payload["reply_markup"].(map[string]interface{})
	rows := keyboard["inline_keyboard"].([]interface{})
	buttons := rows[0].([]interface{})
	if len(buttons) != 2 {
		t.Fatalf("expected vinted and dashboard buttons, got %d", len(buttons))
	}
	button := buttons[1].(map[string]interface{})
	if button["url"] != "https://dashboard.example.test/monitors/7" {
		t.Fatalf("unexpected dashboard url: %v", button)
	}
}

func TestSendRetriesTelegramRateLimit(t *testing.T) {
	var calls int32
	withTelegramServer(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/bottest-token/sendMessage" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		if atomic.AddInt32(&calls, 1) == 1 {
			w.WriteHeader(http.StatusTooManyRequests)
			w.Write([]byte(`{"ok":false,"parameters":{"retry_after":0}}`))
			return
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"ok":true}`))
	})

	SendStartup("-1001", "monitor")

	if calls != 2 {
		t.Fatalf("expected retry after 429, got %d calls", calls)
	}
}
