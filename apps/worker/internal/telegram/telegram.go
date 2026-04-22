package telegram

import (
	"bytes"
	"encoding/json"
	"fmt"
	"html"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"vintrack-worker/internal/model"
)

var httpClient = &http.Client{Timeout: 5 * time.Second}
var apiBaseURL = "https://api.telegram.org"

type retryResponse struct {
	Parameters struct {
		RetryAfter int `json:"retry_after"`
	} `json:"parameters"`
}

func SendItem(chatID string, item model.Item, monitorName string, proxySource string) {
	if chatID == "" {
		return
	}

	if item.ImageURL != "" {
		payload := map[string]interface{}{
			"chat_id":    chatID,
			"photo":      item.ImageURL,
			"caption":    itemCaption(item, monitorName, proxySource),
			"parse_mode": "HTML",
		}
		if keyboard := itemKeyboard(item); keyboard != nil {
			payload["reply_markup"] = keyboard
		}

		if err := send("sendPhoto", payload); err == nil {
			return
		} else {
			log.Printf("telegram send photo error: %v", err)
		}
	}

	payload := map[string]interface{}{
		"chat_id":                  chatID,
		"text":                     itemCaption(item, monitorName, proxySource),
		"parse_mode":               "HTML",
		"disable_web_page_preview": false,
	}
	if keyboard := itemKeyboard(item); keyboard != nil {
		payload["reply_markup"] = keyboard
	}

	if err := send("sendMessage", payload); err != nil {
		log.Printf("telegram send item error: %v", err)
	}
}

func SendStartup(chatID string, monitorName string) {
	sendStatus(chatID, fmt.Sprintf("Vintrack: Monitor <b>%s</b> is starting. Initial scan is muted.", escape(monitorName)))
}

func SendProxyWarning(chatID string, monitorName string, consecutiveErrors int) {
	sendStatus(chatID, fmt.Sprintf("Vintrack: Monitor <b>%s</b> has <b>%d</b> consecutive proxy errors.", escape(monitorName), consecutiveErrors))
}

func SendAutoStop(chatID string, monitorName string, consecutiveErrors int) {
	sendStatus(chatID, fmt.Sprintf("Vintrack: Monitor <b>%s</b> was auto-stopped after <b>%d</b> consecutive proxy errors.", escape(monitorName), consecutiveErrors))
}

func sendStatus(chatID string, text string) {
	if chatID == "" {
		return
	}

	if err := send("sendMessage", map[string]interface{}{
		"chat_id":                  chatID,
		"text":                     text,
		"parse_mode":               "HTML",
		"disable_web_page_preview": true,
	}); err != nil {
		log.Printf("telegram status error: %v", err)
	}
}

func send(method string, payload map[string]interface{}) error {
	token := os.Getenv("TELEGRAM_BOT_TOKEN")
	if token == "" {
		return fmt.Errorf("TELEGRAM_BOT_TOKEN is not configured")
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	return postWithRetry(fmt.Sprintf("%s/bot%s/%s", strings.TrimRight(apiBaseURL, "/"), token, method), body)
}

func postWithRetry(endpoint string, body []byte) error {
	retryAfter, err := post(endpoint, body)
	if err != nil {
		return err
	}
	if retryAfter == nil {
		return nil
	}

	wait := time.Duration(*retryAfter) * time.Second
	if wait > 10*time.Second {
		wait = 10 * time.Second
	}
	time.Sleep(wait)

	retryAfter, err = post(endpoint, body)
	if err != nil {
		return err
	}
	if retryAfter != nil {
		return fmt.Errorf("telegram API rate limited after retry")
	}
	return nil
}

func post(endpoint string, body []byte) (*int, error) {
	resp, err := httpClient.Post(endpoint, "application/json", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
	if resp.StatusCode == http.StatusTooManyRequests {
		var retry retryResponse
		if err := json.Unmarshal(respBody, &retry); err == nil {
			return &retry.Parameters.RetryAfter, nil
		}
		fallback := 2
		return &fallback, nil
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("telegram API returned %d: %s", resp.StatusCode, string(respBody))
	}

	return nil, nil
}

func itemCaption(item model.Item, monitorName string, proxySource string) string {
	price := item.Price
	if item.TotalPrice != "" {
		price = fmt.Sprintf("%s (%s)", item.Price, item.TotalPrice)
	}

	lines := []string{
		"🔔 <b>New Vintrack Match</b>",
		fmt.Sprintf("<b>%s</b>", escape(item.Title)),
		"",
		fmt.Sprintf("💰 <b>%s</b>", escape(price)),
		fmt.Sprintf("🏷️ %s", escape(defaultValue(item.Brand, "No brand"))),
		fmt.Sprintf("📏 %s", escape(defaultValue(item.Size, "No size"))),
		fmt.Sprintf("✨ %s", escape(defaultValue(item.Condition, "No condition"))),
	}

	if item.Location != "" {
		lines = append(lines, fmt.Sprintf("📍 %s", escape(item.Location)))
	}
	if item.Rating != "" {
		lines = append(lines, fmt.Sprintf("⭐ %s", escape(item.Rating)))
	}

	lines = append(lines,
		"",
		fmt.Sprintf("📡 <b>%s</b>", escape(monitorName)),
		fmt.Sprintf("Vintrack • %s", escape(proxySource)),
	)

	return strings.Join(lines, "\n")
}

func itemKeyboard(item model.Item) map[string]interface{} {
	buttons := make([]map[string]string, 0, 2)
	if isTelegramButtonURL(item.URL) {
		buttons = append(buttons, map[string]string{"text": "View on Vinted", "url": item.URL})
	}
	if dashboardURL := dashboardItemURL(item); isTelegramButtonURL(dashboardURL) {
		buttons = append(buttons, map[string]string{"text": "Dashboard", "url": dashboardURL})
	}
	if len(buttons) == 0 {
		return nil
	}

	return map[string]interface{}{
		"inline_keyboard": [][]map[string]string{buttons},
	}
}

func dashboardItemURL(item model.Item) string {
	baseURL := os.Getenv("DASHBOARD_URL")
	if strings.TrimSpace(baseURL) == "" {
		baseURL = "http://localhost:3000"
	}
	return fmt.Sprintf("%s/monitors/%d", strings.TrimRight(baseURL, "/"), item.MonitorID)
}

func isTelegramButtonURL(rawURL string) bool {
	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return false
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return false
	}

	host := strings.ToLower(parsed.Hostname())
	return host != "localhost" && host != "127.0.0.1" && host != "::1"
}

func defaultValue(value string, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}

func escape(value string) string {
	return html.EscapeString(value)
}

func escapeAttr(value string) string {
	return html.EscapeString(value)
}
