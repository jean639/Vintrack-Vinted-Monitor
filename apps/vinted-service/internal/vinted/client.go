package vinted

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"vintrack-vinted/internal/session"

	http "github.com/bogdanfinn/fhttp"
	tls_client "github.com/bogdanfinn/tls-client"
	"github.com/bogdanfinn/tls-client/profiles"
)

type Client struct {
	httpClient tls_client.HttpClient
	session    *session.VintedSession
	csrfToken  string
	anonID     string
	warmedUp   bool
}

func NewClient(sess *session.VintedSession) (*Client, error) {
	jar := tls_client.NewCookieJar()

	options := []tls_client.HttpClientOption{
		tls_client.WithTimeoutSeconds(15),
		tls_client.WithClientProfile(profiles.Chrome_131),
		tls_client.WithCookieJar(jar),
	}

	httpClient, err := tls_client.NewHttpClient(tls_client.NewNoopLogger(), options...)
	if err != nil {
		return nil, fmt.Errorf("create tls client: %w", err)
	}

	return &Client{httpClient: httpClient, session: sess}, nil
}

func (c *Client) injectAuthCookie() {
	domainURL, _ := url.Parse(fmt.Sprintf("https://%s/", c.session.Domain))
	c.httpClient.SetCookies(domainURL, []*http.Cookie{
		{
			Name:  "access_token_web",
			Value: c.session.AccessToken,
			Path:  "/",
		},
	})
}

func (c *Client) apiHeaders() http.Header {
	now := time.Now().UnixMilli()
	h := http.Header{
		"User-Agent":         {"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"},
		"Accept":             {"application/json, text/plain, */*"},
		"Accept-Language":    {"de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7"},
		"Cache-Control":      {"no-cache"},
		"Pragma":             {"no-cache"},
		"Locale":             {c.locale()},
		"X-Platform":         {"web"},
		"X-Portal":           {c.portal()},
		"X-Debug-Info":       {"v4"},
		"X-Local-Time":       {strconv.FormatInt(now, 10)},
		"Origin":             {fmt.Sprintf("https://%s", c.session.Domain)},
		"Referer":            {fmt.Sprintf("https://%s/", c.session.Domain)},
		"Sec-Ch-Ua":          {`"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"`},
		"Sec-Ch-Ua-Mobile":   {"?0"},
		"Sec-Ch-Ua-Platform": {`"macOS"`},
		"Sec-Fetch-Dest":     {"empty"},
		"Sec-Fetch-Mode":     {"cors"},
		"Sec-Fetch-Site":     {"same-origin"},
	}
	if c.csrfToken != "" {
		h.Set("X-Csrf-Token", c.csrfToken)
	}
	if c.anonID != "" {
		h.Set("X-Anon-Id", c.anonID)
	}
	return h
}

func (c *Client) portal() string {
	switch {
	case strings.Contains(c.session.Domain, "vinted.de"):
		return "de"
	case strings.Contains(c.session.Domain, "vinted.fr"):
		return "fr"
	case strings.Contains(c.session.Domain, "vinted.es"):
		return "es"
	case strings.Contains(c.session.Domain, "vinted.it"):
		return "it"
	case strings.Contains(c.session.Domain, "vinted.nl"):
		return "nl"
	case strings.Contains(c.session.Domain, "vinted.pl"):
		return "pl"
	case strings.Contains(c.session.Domain, "vinted.co.uk"):
		return "uk"
	case strings.Contains(c.session.Domain, "vinted.com"):
		return "com"
	default:
		return "de"
	}
}

func (c *Client) apiHeadersWithBody() http.Header {
	h := c.apiHeaders()
	h.Set("Content-Type", "application/json")
	return h
}

func (c *Client) locale() string {
	switch {
	case strings.Contains(c.session.Domain, "vinted.de"):
		return "de-DE"
	case strings.Contains(c.session.Domain, "vinted.fr"):
		return "fr-FR"
	case strings.Contains(c.session.Domain, "vinted.es"):
		return "es-ES"
	case strings.Contains(c.session.Domain, "vinted.it"):
		return "it-IT"
	case strings.Contains(c.session.Domain, "vinted.nl"):
		return "nl-NL"
	case strings.Contains(c.session.Domain, "vinted.pl"):
		return "pl-PL"
	case strings.Contains(c.session.Domain, "vinted.co.uk"):
		return "en-GB"
	case strings.Contains(c.session.Domain, "vinted.com"):
		return "en-US"
	default:
		return "de-DE"
	}
}

func (c *Client) WarmUp() error {
	if c.warmedUp {
		return nil
	}

	u := fmt.Sprintf("https://%s/", c.session.Domain)
	req, _ := http.NewRequest("GET", u, nil)
	req.Header = http.Header{
		"User-Agent": {"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"},
		"Accept":     {"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"},
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("warmup: %w", err)
	}
	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()

	csrfPatterns := []*regexp.Regexp{
		regexp.MustCompile(`CSRF_TOKEN\\?":\s*\\?"([^"\\]+)`),
		regexp.MustCompile(`<meta\s+name="csrf-token"\s+content="([^"]+)"`),
		regexp.MustCompile(`<meta\s+content="([^"]+)"\s+name="csrf-token"`),
		regexp.MustCompile(`"csrfToken"\s*:\s*"([^"]+)"`),
		regexp.MustCompile(`"csrf_token"\s*:\s*"([^"]+)"`),
	}
	for _, re := range csrfPatterns {
		if m := re.FindSubmatch(body); len(m) > 1 {
			c.csrfToken = string(m[1])
			log.Printf("[vinted] extracted CSRF token: %s...", truncate(c.csrfToken, 20))
			break
		}
	}
	if c.csrfToken == "" {
		log.Printf("[vinted] WARNING: no CSRF token found in homepage HTML (body length: %d)", len(body))
	}

	domainURL, _ := url.Parse(fmt.Sprintf("https://%s/", c.session.Domain))
	for _, ck := range c.httpClient.GetCookies(domainURL) {
		if ck.Name == "anon_id" {
			c.anonID = ck.Value
			break
		}
	}

	c.injectAuthCookie()

	c.warmedUp = true
	log.Printf("[vinted] warmup done for %s, csrf=%v, anon_id=%v", c.session.Domain, c.csrfToken != "", c.anonID != "")
	return nil
}

func (c *Client) GetAccessToken() string {
	return c.session.AccessToken
}

type AccountInfo struct {
	ID          int64  `json:"id"`
	Login       string `json:"login"`
	PhotoURL    string `json:"photo_url"`
	ItemCount   int    `json:"item_count"`
	GivenRating string `json:"feedback_reputation"`
	CountryCode string `json:"country_title"`
}

type SellerInfo struct {
	Location string
	Rating   string
}

type sellerInfoCache struct {
	mu    sync.RWMutex
	cache map[int64]SellerInfo
}

var globalSellerCache = &sellerInfoCache{
	cache: make(map[int64]SellerInfo),
}

func (c *sellerInfoCache) Get(userID int64) (SellerInfo, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	info, ok := c.cache[userID]
	return info, ok
}

func (c *sellerInfoCache) Set(userID int64, info SellerInfo) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.cache[userID] = info
}

type VintedPrice struct {
	Amount   string `json:"amount"`
	Currency string `json:"currency_code"`
}

type VintedPhoto struct {
	Url string `json:"url"`
}

type VintedUser struct {
	ID    int64  `json:"id"`
	Login string `json:"login"`
}

type FavoritesPagination struct {
	CurrentPage   int         `json:"current_page"`
	TotalPages    int         `json:"total_pages"`
	TotalEntries  int         `json:"total_entries"`
	PerPage       int         `json:"per_page"`
	NextPageToken interface{} `json:"next_page_token,omitempty"`
}

type FavoritesItem struct {
	ID             int64         `json:"id"`
	Title          string        `json:"title"`
	Price          VintedPrice   `json:"price"`
	TotalItemPrice *VintedPrice  `json:"total_item_price,omitempty"`
	Url            string        `json:"url"`
	Photo          VintedPhoto   `json:"photo"`
	Photos         []VintedPhoto `json:"photos,omitempty"`
	SizeTitle      string        `json:"size_title"`
	BrandTitle     string        `json:"brand_title,omitempty"`
	Status         string        `json:"status"`
	User           VintedUser    `json:"user"`
	Location       string        `json:"location,omitempty"`
	Rating         string        `json:"rating,omitempty"`
}

type VintedItemDetailResponse struct {
	Item struct {
		ID             int64         `json:"id"`
		Photos         []VintedPhoto `json:"photos"`
		TotalItemPrice *VintedPrice  `json:"total_item_price"`
		User           struct {
			ID                 int64   `json:"id"`
			Login              string  `json:"login"`
			CountryTitle       string  `json:"country_title"`
			CountryCode        string  `json:"country_iso_code"`
			FeedbackCount      int     `json:"feedback_count"`
			FeedbackReputation float64 `json:"feedback_reputation"`
		} `json:"user"`
	} `json:"item"`
}

type FavoritesResponse struct {
	Items      []FavoritesItem     `json:"items"`
	Pagination FavoritesPagination `json:"pagination"`
}

type InboxUserPhoto struct {
	URL string `json:"url"`
}

type InboxUser struct {
	ID    int64           `json:"id"`
	Login string          `json:"login"`
	Photo *InboxUserPhoto `json:"photo,omitempty"`
}

type InboxItemPhoto struct {
	ID  int64  `json:"id"`
	URL string `json:"url"`
}

type InboxConversation struct {
	ID                   int64            `json:"id"`
	ItemCount            int              `json:"item_count"`
	IsDeletionRestricted bool             `json:"is_deletion_restricted"`
	Description          string           `json:"description"`
	Unread               bool             `json:"unread"`
	UpdatedAt            string           `json:"updated_at"`
	OppositeUser         InboxUser        `json:"opposite_user"`
	ItemPhotos           []InboxItemPhoto `json:"item_photos"`
}

type InboxResponse struct {
	Code            int                 `json:"code,omitempty"`
	Conversations   []InboxConversation `json:"conversations"`
	Pagination      FavoritesPagination `json:"pagination"`
	WebsocketUserID string              `json:"websocket_user_id,omitempty"`
}

type NotificationPhoto struct {
	URL string `json:"url"`
}

type NotificationEntry struct {
	ID            string             `json:"id"`
	Body          string             `json:"body"`
	EntryType     int                `json:"entry_type"`
	IsRead        bool               `json:"is_read"`
	Link          string             `json:"link"`
	URL           string             `json:"url,omitempty"`
	Photo         *NotificationPhoto `json:"photo,omitempty"`
	SmallPhotoURL string             `json:"small_photo_url,omitempty"`
	SubjectID     int64              `json:"subject_id,omitempty"`
	UpdatedAt     string             `json:"updated_at,omitempty"`
	UserID        int64              `json:"user_id,omitempty"`
}

type NotificationsResponse struct {
	Code          int                 `json:"code,omitempty"`
	Notifications []NotificationEntry `json:"notifications"`
	Pagination    FavoritesPagination `json:"pagination"`
}

type userWrapper struct {
	User AccountInfo `json:"user"`
}

func parseUserIDFromJWT(token string) (int64, string) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return 0, ""
	}
	payload := parts[1]
	switch len(payload) % 4 {
	case 2:
		payload += "=="
	case 3:
		payload += "="
	}
	decoded, err := base64.URLEncoding.DecodeString(payload)
	if err != nil {
		return 0, ""
	}
	var claims map[string]interface{}
	if err := json.Unmarshal(decoded, &claims); err != nil {
		return 0, ""
	}
	var userID int64
	if sub, ok := claims["sub"].(string); ok {
		userID, _ = strconv.ParseInt(sub, 10, 64)
	}
	return userID, fmt.Sprintf("%d", userID)
}

func (c *Client) GetAccountInfo() (*AccountInfo, error) {
	if err := c.WarmUp(); err != nil {
		log.Printf("[vinted] warmup failed: %v", err)
	}

	jwtUserID, _ := parseUserIDFromJWT(c.session.AccessToken)

	if jwtUserID > 0 {
		userURL := fmt.Sprintf("https://%s/api/v2/users/%d", c.session.Domain, jwtUserID)
		req, err := http.NewRequest("GET", userURL, nil)
		if err == nil {
			req.Header = c.apiHeaders()
			resp, err := c.httpClient.Do(req)
			if err == nil {
				defer resp.Body.Close()
				body, _ := io.ReadAll(resp.Body)
				log.Printf("[vinted] GET /api/v2/users/%d -> %d (%.200s)", jwtUserID, resp.StatusCode, string(body))

				if resp.StatusCode == 200 {
					var wrapper userWrapper
					if err := json.Unmarshal(body, &wrapper); err == nil && wrapper.User.ID > 0 {
						return &wrapper.User, nil
					}
					var info AccountInfo
					if err := json.Unmarshal(body, &info); err == nil && info.ID > 0 {
						return &info, nil
					}
					var raw map[string]interface{}
					if err := json.Unmarshal(body, &raw); err == nil {
						if userMap, ok := raw["user"].(map[string]interface{}); ok {
							raw = userMap
						}
						login, _ := raw["login"].(string)
						photo, _ := raw["photo"].(map[string]interface{})
						photoURL := ""
						if photo != nil {
							photoURL, _ = photo["url"].(string)
						}
						return &AccountInfo{
							ID:       jwtUserID,
							Login:    login,
							PhotoURL: photoURL,
						}, nil
					}
				}

				if resp.StatusCode == 401 || resp.StatusCode == 403 {
					return nil, fmt.Errorf("authentication failed (HTTP %d)", resp.StatusCode)
				}
			}
		}
	}

	currentURL := fmt.Sprintf("https://%s/api/v2/users/current", c.session.Domain)
	req, err := http.NewRequest("GET", currentURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header = c.apiHeaders()

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch current user: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	log.Printf("[vinted] GET /api/v2/users/current -> %d (%.300s)", resp.StatusCode, string(body))

	if resp.StatusCode == 401 || resp.StatusCode == 403 {
		return nil, fmt.Errorf("authentication failed (HTTP %d)", resp.StatusCode)
	}

	if resp.StatusCode != 200 {
		if jwtUserID > 0 {
			log.Printf("[vinted] /users/current failed but JWT has user ID %d, using that", jwtUserID)
			return &AccountInfo{ID: jwtUserID, Login: fmt.Sprintf("user_%d", jwtUserID)}, nil
		}
		return nil, fmt.Errorf("unexpected status %d: %.200s", resp.StatusCode, string(body))
	}

	var wrapper userWrapper
	if err := json.Unmarshal(body, &wrapper); err == nil && wrapper.User.ID > 0 {
		return &wrapper.User, nil
	}
	var info AccountInfo
	if err := json.Unmarshal(body, &info); err == nil && info.ID > 0 {
		return &info, nil
	}

	if jwtUserID > 0 {
		log.Printf("[vinted] could not parse user response, using JWT ID %d", jwtUserID)
		return &AccountInfo{ID: jwtUserID, Login: fmt.Sprintf("user_%d", jwtUserID)}, nil
	}

	return nil, fmt.Errorf("could not extract user info from response: %.200s", string(body))
}

func (c *Client) ValidateSession() bool {
	info, err := c.GetAccountInfo()
	if err != nil {
		log.Printf("[validate] session check failed: %v", err)
		return false
	}
	return info.ID > 0
}

func (c *Client) LikeItem(itemID int64) error {
	err := c.doLike(itemID)
	if err != nil && strings.Contains(err.Error(), "HTTP 401") && c.session.RefreshToken != "" {
		log.Printf("[vinted] like got 401, attempting token refresh...")
		if refreshErr := c.RefreshAccessToken(); refreshErr != nil {
			log.Printf("[vinted] token refresh failed: %v", refreshErr)
			return err
		}
		return c.doLike(itemID)
	}
	return err
}

func (c *Client) doLike(itemID int64) error {
	if err := c.WarmUp(); err != nil {
		log.Printf("[vinted] warmup failed before like: %v", err)
	}

	toggleURL := fmt.Sprintf("https://%s/api/v2/user_favourites/toggle", c.session.Domain)
	payload := map[string]interface{}{
		"type":            "item",
		"user_favourites": []int64{itemID},
	}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequest("POST", toggleURL, strings.NewReader(string(body)))
	if err != nil {
		return fmt.Errorf("create like request: %w", err)
	}
	req.Header = c.apiHeadersWithBody()

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("like request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	bodyStr := strings.TrimSpace(string(respBody))

	log.Printf("[vinted] POST user_favourites/toggle (like) -> %d (%.300s)", resp.StatusCode, bodyStr)

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		log.Printf("[vinted] Liked item %d", itemID)
		return nil
	}

	return fmt.Errorf("like failed (HTTP %d): %s", resp.StatusCode, truncate(bodyStr, 300))
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func (c *Client) UnlikeItem(itemID int64) error {
	err := c.doUnlike(itemID)
	if err != nil && strings.Contains(err.Error(), "HTTP 401") && c.session.RefreshToken != "" {
		log.Printf("[vinted] unlike got 401, attempting token refresh...")
		if refreshErr := c.RefreshAccessToken(); refreshErr != nil {
			log.Printf("[vinted] token refresh failed: %v", refreshErr)
			return err
		}
		return c.doUnlike(itemID)
	}
	return err
}

func (c *Client) doUnlike(itemID int64) error {
	if err := c.WarmUp(); err != nil {
		log.Printf("[vinted] warmup failed before unlike: %v", err)
	}

	toggleURL := fmt.Sprintf("https://%s/api/v2/user_favourites/toggle", c.session.Domain)
	payload := map[string]interface{}{
		"type":            "item",
		"user_favourites": []int64{itemID},
	}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequest("POST", toggleURL, strings.NewReader(string(body)))
	if err != nil {
		return fmt.Errorf("create unlike request: %w", err)
	}
	req.Header = c.apiHeadersWithBody()

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("unlike request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	bodyStr := strings.TrimSpace(string(respBody))

	log.Printf("[vinted] POST user_favourites/toggle (unlike) -> %d (%.300s)", resp.StatusCode, bodyStr)

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return nil
	}

	return fmt.Errorf("unlike failed (HTTP %d): %s", resp.StatusCode, truncate(bodyStr, 300))
}

type BuyResponse struct {
	TransactionID int64  `json:"id"`
	Status        string `json:"status"`
	CheckoutURL   string `json:"checkout_url"`
}

func (c *Client) BuyItem(itemID int64) (*BuyResponse, error) {
	if err := c.WarmUp(); err != nil {
		log.Printf("[vinted] warmup failed before buy: %v", err)
	}

	buyURL := fmt.Sprintf("https://%s/api/v2/transactions", c.session.Domain)

	payload := map[string]interface{}{
		"item_id": itemID,
	}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequest("POST", buyURL, strings.NewReader(string(body)))
	if err != nil {
		return nil, fmt.Errorf("create buy request: %w", err)
	}
	req.Header = c.apiHeadersWithBody()

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("buy request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		var result BuyResponse
		json.Unmarshal(respBody, &result)
		return &result, nil
	}

	return nil, fmt.Errorf("buy failed (HTTP %d): %s", resp.StatusCode, truncate(string(respBody), 200))
}

func truncate(s string, maxLen int) string {
	if len(s) > maxLen {
		return s[:maxLen] + "..."
	}
	return s
}

func (c *Client) GetDomain() string {
	return c.session.Domain
}

func (c *Client) GetSession() *session.VintedSession {
	return c.session
}

func (c *Client) RefreshAccessToken() error {
	if c.session.RefreshToken == "" {
		return fmt.Errorf("no refresh token available")
	}

	domainURL, _ := url.Parse(fmt.Sprintf("https://%s/", c.session.Domain))

	c.httpClient.SetCookies(domainURL, []*http.Cookie{
		{Name: "access_token_web", Value: c.session.AccessToken, Path: "/"},
		{Name: "refresh_token_web", Value: c.session.RefreshToken, Path: "/"},
	})

	c.warmedUp = false
	if err := c.WarmUp(); err != nil {
		log.Printf("[vinted] warmup before refresh failed: %v (continuing anyway)", err)
	}

	c.httpClient.SetCookies(domainURL, []*http.Cookie{
		{Name: "refresh_token_web", Value: c.session.RefreshToken, Path: "/"},
	})

	refreshURL := fmt.Sprintf("https://%s/web/api/auth/refresh", c.session.Domain)

	req, err := http.NewRequest("POST", refreshURL, strings.NewReader(""))
	if err != nil {
		return fmt.Errorf("create refresh request: %w", err)
	}
	req.Header = http.Header{
		"User-Agent":         {"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"},
		"Accept":             {"application/json, text/plain, */*"},
		"Accept-Language":    {c.locale()},
		"Cache-Control":      {"no-cache"},
		"Pragma":             {"no-cache"},
		"Origin":             {fmt.Sprintf("https://%s", c.session.Domain)},
		"Referer":            {fmt.Sprintf("https://%s/session-refresh?ref_url=%%2F", c.session.Domain)},
		"Sec-Ch-Ua":          {`"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"`},
		"Sec-Ch-Ua-Mobile":   {"?0"},
		"Sec-Ch-Ua-Platform": {`"macOS"`},
		"Sec-Fetch-Dest":     {"empty"},
		"Sec-Fetch-Mode":     {"cors"},
		"Sec-Fetch-Site":     {"same-origin"},
	}
	if c.csrfToken != "" {
		req.Header.Set("X-Csrf-Token", c.csrfToken)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("refresh request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	log.Printf("[vinted] POST /web/api/auth/refresh -> %d (%.200s)", resp.StatusCode, string(body))

	if resp.StatusCode != 200 {
		return fmt.Errorf("refresh failed (HTTP %d): %s", resp.StatusCode, truncate(string(body), 200))
	}

	var newAccessToken, newRefreshToken string
	for _, cookie := range c.httpClient.GetCookies(domainURL) {
		switch cookie.Name {
		case "access_token_web":
			newAccessToken = cookie.Value
		case "refresh_token_web":
			newRefreshToken = cookie.Value
		}
	}

	if newAccessToken == "" {
		for _, cookie := range resp.Cookies() {
			switch cookie.Name {
			case "access_token_web":
				newAccessToken = cookie.Value
			case "refresh_token_web":
				newRefreshToken = cookie.Value
			}
		}
	}

	if newAccessToken == "" {
		return fmt.Errorf("refresh response did not contain new access token")
	}

	c.session.AccessToken = newAccessToken
	if newRefreshToken != "" {
		c.session.RefreshToken = newRefreshToken
	}

	c.injectAuthCookie()
	c.warmedUp = false

	log.Printf("[vinted] token refresh successful, new access token: %s...", truncate(newAccessToken, 20))
	return nil
}

func (c *Client) GetFavourites(vintedUserID int64, page string) (*FavoritesResponse, error) {
	favs, err := c.doGetFavourites(vintedUserID, page)
	if err != nil && (strings.Contains(err.Error(), "401") || strings.Contains(err.Error(), "403")) && c.session.RefreshToken != "" {
		log.Printf("[vinted] get favorites got %v, attempting token refresh...", err)
		if refreshErr := c.RefreshAccessToken(); refreshErr != nil {
			log.Printf("[vinted] token refresh failed: %v", refreshErr)
			return nil, err
		}
		return c.doGetFavourites(vintedUserID, page)
	}
	return favs, err
}

func (c *Client) doGetFavourites(vintedUserID int64, page string) (*FavoritesResponse, error) {
	if err := c.WarmUp(); err != nil {
		log.Printf("[vinted] warmup failed: %v", err)
	}

	u := fmt.Sprintf("https://%s/api/v2/users/%d/items/favourites", c.session.Domain, vintedUserID)
	if page != "" {
		u += "?page=" + page
	}

	req, err := http.NewRequest("GET", u, nil)
	if err != nil {
		return nil, fmt.Errorf("create favorites request: %w", err)
	}

	req.Header = c.apiHeaders()
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("do favorites request: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	log.Printf("[vinted] GET /api/v2/users/%d/items/favourites -> %d (%.200s)", vintedUserID, resp.StatusCode, string(body))

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("vinted error: %d %s", resp.StatusCode, string(body))
	}

	var favs FavoritesResponse
	if err := json.Unmarshal(body, &favs); err != nil {
		return nil, fmt.Errorf("unmarshal favorites: %w", err)
	}

	return &favs, nil
}

var isoCountryMap = map[string]string{
	"DE": "🇩🇪 DE", "FR": "🇫🇷 FR", "IT": "🇮🇹 IT", "ES": "🇪🇸 ES",
	"NL": "🇳🇱 NL", "PL": "🇵🇱 PL", "AT": "🇦🇹 AT", "BE": "🇧🇪 BE",
	"GB": "🇬🇧 UK", "UK": "🇬🇧 UK", "LU": "🇱🇺 LU", "PT": "🇵🇹 PT",
	"CZ": "🇨🇿 CZ", "SK": "🇸🇰 SK", "LT": "🇱🇹 LT", "SE": "🇸🇪 SE",
	"DK": "🇩🇰 DK", "RO": "🇷🇴 RO", "HU": "🇭🇺 HU", "HR": "🇭🇷 HR",
	"FI": "🇫🇮 FI", "IE": "🇮🇪 IE", "SI": "🇸🇮 SI", "EE": "🇪🇪 EE",
	"LV": "🇱🇻 LV", "GR": "🇬🇷 GR",
}

var countryMap = map[string]string{
	"DEUTSCHLAND": "🇩🇪 DE", "GERMANY": "🇩🇪 DE",
	"FRANCE": "🇫🇷 FR", "FRANKREICH": "🇫🇷 FR",
	"ITALIA": "🇮🇹 IT", "ITALY": "🇮🇹 IT", "ITALIEN": "🇮🇹 IT",
	"ESPAÑA": "🇪🇸 ES", "SPAIN": "🇪🇸 ES", "SPANIEN": "🇪🇸 ES",
	"NEDERLAND": "🇳🇱 NL", "NETHERLANDS": "🇳🇱 NL", "NIEDERLANDE": "🇳🇱 NL",
	"POLSKA": "🇵🇱 PL", "POLAND": "🇵🇱 PL", "POLEN": "🇵🇱 PL",
	"ÖSTERREICH": "🇦🇹 AT", "AUSTRIA": "🇦🇹 AT",
	"BELGIË": "🇧🇪 BE", "BELGIUM": "🇧🇪 BE", "BELGIEN": "🇧🇪 BE",
	"UNITED KINGDOM": "🇬🇧 UK", "GROSSBRITANNIEN": "🇬🇧 UK",
	"LUXEMBOURG": "🇱🇺 LU", "LUXEMBURG": "🇱🇺 LU",
	"PORTUGAL":        "🇵🇹 PT",
	"ČESKÁ REPUBLIKA": "🇨🇿 CZ", "TSCHECHIEN": "🇨🇿 CZ",
	"SLOVENSKO": "🇸🇰 SK", "SLOWAKEI": "🇸🇰 SK",
	"LIETUVA": "🇱🇹 LT", "LITAUEN": "🇱🇹 LT",
	"SVERIGE": "🇸🇪 SE", "SCHWEDEN": "🇸🇪 SE",
	"DANMARK": "🇩🇰 DK", "DÄNEMARK": "🇩🇰 DK",
	"ROMÂNIA": "🇷🇴 RO", "RUMÄNIEN": "🇷🇴 RO",
	"MAGYARORSZÁG": "🇭🇺 HU", "UNGARN": "🇭🇺 HU",
	"HRVATSKA": "🇭🇷 HR", "KROATIEN": "🇭🇷 HR",
	"SUOMI": "🇫🇮 FI", "FINLAND": "🇫🇮 FI", "FINNLAND": "🇫🇮 FI",
	"IRELAND": "🇮🇪 IE", "IRLAND": "🇮🇪 IE",
	"SLOVENIJA": "🇸🇮 SI", "SLOWENIEN": "🇸🇮 SI",
	"EESTI": "🇪🇪 EE", "ESTLAND": "🇪🇪 EE",
	"LATVIJA": "🇱🇻 LV", "LETTLAND": "🇱🇻 LV",
	"ΕΛΛΆΔΑ": "🇬🇷 GR", "GREECE": "🇬🇷 GR", "GRIECHENLAND": "🇬🇷 GR",
}

func (c *Client) GetItem(itemID int64) (*VintedItemDetailResponse, error) {
	u := fmt.Sprintf("https://%s/api/v2/items/%d?localization=%s", c.session.Domain, itemID, c.locale())
	req, err := http.NewRequest("GET", u, nil)
	if err != nil {
		return nil, err
	}

	req.Header = c.apiHeaders()
	req.Header.Set("Referer", fmt.Sprintf("https://%s/items/%d", c.session.Domain, itemID))

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("item detail error: %d (%.100s)", resp.StatusCode, string(body))
	}

	var detail VintedItemDetailResponse
	if err := json.Unmarshal(body, &detail); err != nil {
		var alt struct {
			ID     int64         `json:"id"`
			Photos []VintedPhoto `json:"photos"`
			User   struct {
				ID                 int64   `json:"id"`
				CountryCode        string  `json:"country_iso_code"`
				FeedbackCount      int     `json:"feedback_count"`
				FeedbackReputation float64 `json:"feedback_reputation"`
			} `json:"user"`
		}
		if err2 := json.Unmarshal(body, &alt); err2 == nil && alt.ID != 0 {
			detail.Item.ID = alt.ID
			detail.Item.Photos = alt.Photos
			detail.Item.User.ID = alt.User.ID
			detail.Item.User.CountryCode = alt.User.CountryCode
			detail.Item.User.FeedbackCount = alt.User.FeedbackCount
			detail.Item.User.FeedbackReputation = alt.User.FeedbackReputation
			return &detail, nil
		}
		return nil, fmt.Errorf("unmarshal item detail: %w", err)
	}

	if detail.Item.ID == 0 {
		detail.Item.ID = itemID
	}

	return &detail, nil
}

func (c *Client) GetSellerInfo(userID int64) (*SellerInfo, error) {
	if info, ok := globalSellerCache.Get(userID); ok {
		return &info, nil
	}

	u := fmt.Sprintf("https://%s/api/v2/users/%d?localization=%s", c.session.Domain, userID, c.locale())
	req, err := http.NewRequest("GET", u, nil)
	if err != nil {
		return nil, err
	}

	req.Header = c.apiHeaders()
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("user detail error: %d", resp.StatusCode)
	}

	var wrapper struct {
		User struct {
			CountryCode        string  `json:"country_iso_code"`
			CountryTitle       string  `json:"country_title"`
			FeedbackReputation float64 `json:"feedback_reputation"`
			FeedbackCount      int     `json:"feedback_count"`
		} `json:"user"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&wrapper); err != nil {
		return nil, err
	}

	info := SellerInfo{
		Location: "Unknown",
		Rating:   "No rating",
	}

	code := strings.ToUpper(wrapper.User.CountryCode)
	if flag, ok := isoCountryMap[code]; ok {
		info.Location = flag
	} else if wrapper.User.CountryTitle != "" {
		if flag, ok := countryMap[strings.ToUpper(wrapper.User.CountryTitle)]; ok {
			info.Location = flag
		}
	}

	if wrapper.User.FeedbackCount > 0 {
		r := wrapper.User.FeedbackReputation * 5.0
		info.Rating = fmt.Sprintf("⭐ %.1f (%d)", r, wrapper.User.FeedbackCount)
	}

	globalSellerCache.Set(userID, info)
	return &info, nil
}

func (c *Client) EnrichFavorites(favs *FavoritesResponse) {
	if favs == nil || len(favs.Items) == 0 {
		return
	}

	var wg sync.WaitGroup
	sem := make(chan struct{}, 5)

	log.Printf("[vinted] enriching %d favorites with seller info for user %d...", len(favs.Items), c.session.VintedUserID)

	for i := range favs.Items {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			item := &favs.Items[idx]

			sInfo, err := c.GetSellerInfo(item.User.ID)
			if err == nil {
				item.Location = sInfo.Location
				item.Rating = sInfo.Rating
			}
		}(i)
	}

	wg.Wait()
}

func (c *Client) SendMessage(itemID, sellerID int64, message string) error {
	err := c.doSendMessage(itemID, sellerID, message)
	if err != nil && strings.Contains(err.Error(), "HTTP 401") && c.session.RefreshToken != "" {
		log.Printf("[vinted] send message got 401, attempting token refresh...")
		if refreshErr := c.RefreshAccessToken(); refreshErr != nil {
			log.Printf("[vinted] token refresh failed: %v", refreshErr)
			return err
		}
		return c.doSendMessage(itemID, sellerID, message)
	}
	return err
}

func (c *Client) GetInbox(page, perPage int) (*InboxResponse, error) {
	inbox, err := c.doGetInbox(page, perPage)
	if err != nil && (strings.Contains(err.Error(), "401") || strings.Contains(err.Error(), "403")) && c.session.RefreshToken != "" {
		log.Printf("[vinted] get inbox got %v, attempting token refresh...", err)
		if refreshErr := c.RefreshAccessToken(); refreshErr != nil {
			log.Printf("[vinted] token refresh failed: %v", refreshErr)
			return nil, err
		}
		return c.doGetInbox(page, perPage)
	}
	return inbox, err
}

func (c *Client) GetNotifications(page, perPage int) (*NotificationsResponse, error) {
	notifications, err := c.doGetNotifications(page, perPage)
	if err != nil && (strings.Contains(err.Error(), "401") || strings.Contains(err.Error(), "403")) && c.session.RefreshToken != "" {
		log.Printf("[vinted] get notifications got %v, attempting token refresh...", err)
		if refreshErr := c.RefreshAccessToken(); refreshErr != nil {
			log.Printf("[vinted] token refresh failed: %v", refreshErr)
			return nil, err
		}
		return c.doGetNotifications(page, perPage)
	}
	return notifications, err
}

func (c *Client) doGetInbox(page, perPage int) (*InboxResponse, error) {
	if err := c.WarmUp(); err != nil {
		log.Printf("[vinted] warmup failed before get inbox: %v", err)
	}

	if page <= 0 {
		page = 1
	}
	if perPage <= 0 {
		perPage = 20
	}

	u := fmt.Sprintf("https://%s/api/v2/inbox?page=%d&per_page=%d", c.session.Domain, page, perPage)
	req, err := http.NewRequest("GET", u, nil)
	if err != nil {
		return nil, fmt.Errorf("create inbox request: %w", err)
	}
	req.Header = c.apiHeaders()
	req.Header.Set("Referer", fmt.Sprintf("https://%s/inbox", c.session.Domain))

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("inbox request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	log.Printf("[vinted] GET /api/v2/inbox?page=%d&per_page=%d -> %d (%.300s)", page, perPage, resp.StatusCode, string(body))

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, truncate(string(body), 300))
	}

	var inbox InboxResponse
	if err := json.Unmarshal(body, &inbox); err != nil {
		return nil, fmt.Errorf("parse inbox response: %w", err)
	}

	return &inbox, nil
}

func (c *Client) doGetNotifications(page, perPage int) (*NotificationsResponse, error) {
	if err := c.WarmUp(); err != nil {
		log.Printf("[vinted] warmup failed before get notifications: %v", err)
	}

	if page <= 0 {
		page = 1
	}
	if perPage <= 0 {
		perPage = 5
	}

	apiDomain := strings.TrimPrefix(c.session.Domain, "www.")
	u := fmt.Sprintf("https://api.%s/inbox-notifications/v1/notifications?page=%d&per_page=%d", apiDomain, page, perPage)
	req, err := http.NewRequest("GET", u, nil)
	if err != nil {
		return nil, fmt.Errorf("create notifications request: %w", err)
	}
	req.Header = c.apiHeaders()
	req.Header.Set("Referer", fmt.Sprintf("https://%s/", c.session.Domain))
	req.Header.Set("X-Next-App", "marketplace-web")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("notifications request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	log.Printf("[vinted] GET /inbox-notifications/v1/notifications?page=%d&per_page=%d -> %d (%.300s)", page, perPage, resp.StatusCode, string(body))

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, truncate(string(body), 300))
	}

	var notifications NotificationsResponse
	if err := json.Unmarshal(body, &notifications); err != nil {
		return nil, fmt.Errorf("parse notifications response: %w", err)
	}

	for i := range notifications.Notifications {
		notifications.Notifications[i].URL = c.notificationWebURL(notifications.Notifications[i].Link)
	}

	return &notifications, nil
}

func (c *Client) notificationWebURL(rawLink string) string {
	if rawLink == "" {
		return ""
	}
	if strings.HasPrefix(rawLink, "/") {
		return fmt.Sprintf("https://%s%s", c.session.Domain, rawLink)
	}
	if strings.HasPrefix(rawLink, "http://") || strings.HasPrefix(rawLink, "https://") {
		return rawLink
	}
	if !strings.Contains(rawLink, "://") {
		return rawLink
	}

	parsed, err := url.Parse(rawLink)
	if err != nil {
		return rawLink
	}

	portalDomain := c.session.Domain
	if portal := strings.TrimSpace(parsed.Query().Get("portal")); portal != "" {
		portalDomain = domainForPortal(portal)
	}

	switch parsed.Host {
	case "messaging":
		itemID := strings.TrimSpace(parsed.Query().Get("item_id"))
		if itemID != "" {
			return fmt.Sprintf("https://%s/items/%s", portalDomain, itemID)
		}
		return fmt.Sprintf("https://%s/inbox", portalDomain)
	case "item":
		itemID := strings.TrimSpace(parsed.Query().Get("item_id"))
		if itemID != "" {
			return fmt.Sprintf("https://%s/items/%s", portalDomain, itemID)
		}
	}

	return fmt.Sprintf("https://%s/", portalDomain)
}

func domainForPortal(portal string) string {
	switch strings.ToLower(strings.TrimSpace(portal)) {
	case "de":
		return "www.vinted.de"
	case "fr":
		return "www.vinted.fr"
	case "es":
		return "www.vinted.es"
	case "it":
		return "www.vinted.it"
	case "nl":
		return "www.vinted.nl"
	case "pl":
		return "www.vinted.pl"
	case "uk":
		return "www.vinted.co.uk"
	case "com":
		return "www.vinted.com"
	default:
		return "www.vinted.de"
	}
}

func (c *Client) GetConversationReplies(conversationID int64, page, perPage int) (map[string]interface{}, error) {
	data, err := c.doGetConversationReplies(conversationID, page, perPage)
	if err != nil && (strings.Contains(err.Error(), "401") || strings.Contains(err.Error(), "403")) && c.session.RefreshToken != "" {
		log.Printf("[vinted] get conversation replies got %v, attempting token refresh...", err)
		if refreshErr := c.RefreshAccessToken(); refreshErr != nil {
			log.Printf("[vinted] token refresh failed: %v", refreshErr)
			return nil, err
		}
		return c.doGetConversationReplies(conversationID, page, perPage)
	}
	return data, err
}

func (c *Client) doGetConversationReplies(conversationID int64, page, perPage int) (map[string]interface{}, error) {
	if err := c.WarmUp(); err != nil {
		log.Printf("[vinted] warmup failed before get conversation replies: %v", err)
	}
	return c.getConversationDetail(conversationID)
}

func (c *Client) getConversationDetail(conversationID int64) (map[string]interface{}, error) {
	u := fmt.Sprintf("https://%s/api/v2/conversations/%d", c.session.Domain, conversationID)
	req, err := http.NewRequest("GET", u, nil)
	if err != nil {
		return nil, fmt.Errorf("create conversation detail request: %w", err)
	}
	req.Header = c.apiHeaders()
	req.Header.Set("Referer", fmt.Sprintf("https://%s/inbox/%d", c.session.Domain, conversationID))

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("conversation detail request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	log.Printf("[vinted] GET /api/v2/conversations/%d -> %d (%.300s)", conversationID, resp.StatusCode, string(body))

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, truncate(string(body), 300))
	}

	var payload map[string]interface{}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("parse conversation detail response: %w", err)
	}

	return payload, nil
}

func (c *Client) ReplyToConversation(conversationID int64, message string) error {
	err := c.doReplyToConversation(conversationID, message)
	if err != nil && strings.Contains(err.Error(), "HTTP 401") && c.session.RefreshToken != "" {
		log.Printf("[vinted] reply to conversation got 401, attempting token refresh...")
		if refreshErr := c.RefreshAccessToken(); refreshErr != nil {
			log.Printf("[vinted] token refresh failed: %v", refreshErr)
			return err
		}
		return c.doReplyToConversation(conversationID, message)
	}
	return err
}

func (c *Client) doReplyToConversation(conversationID int64, message string) error {
	if err := c.WarmUp(); err != nil {
		log.Printf("[vinted] warmup failed before reply to conversation: %v", err)
	}

	replyURL := fmt.Sprintf("https://%s/api/v2/conversations/%d/replies", c.session.Domain, conversationID)
	replyPayload := map[string]interface{}{
		"reply": map[string]interface{}{
			"body":                                   message,
			"photo_temp_uuids":                       nil,
			"is_personal_data_sharing_check_skipped": false,
		},
	}
	replyBody, _ := json.Marshal(replyPayload)

	req, err := http.NewRequest("POST", replyURL, strings.NewReader(string(replyBody)))
	if err != nil {
		return fmt.Errorf("create conversation reply request: %w", err)
	}
	req.Header = c.apiHeadersWithBody()
	req.Header.Set("Referer", fmt.Sprintf("https://%s/inbox/%d", c.session.Domain, conversationID))

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("conversation reply request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	bodyStr := strings.TrimSpace(string(respBody))

	log.Printf("[vinted] POST /api/v2/conversations/%d/replies -> %d (%.300s)", conversationID, resp.StatusCode, bodyStr)

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return nil
	}

	return fmt.Errorf("send reply failed (HTTP %d): %s", resp.StatusCode, truncate(bodyStr, 300))
}

func (c *Client) doSendMessage(itemID, sellerID int64, message string) error {
	if err := c.WarmUp(); err != nil {
		log.Printf("[vinted] warmup failed before send message: %v", err)
	}

	convoURL := fmt.Sprintf("https://%s/api/v2/conversations", c.session.Domain)
	convoPayload := map[string]interface{}{
		"initiator":        "ask_seller",
		"item_id":          fmt.Sprintf("%d", itemID),
		"opposite_user_id": fmt.Sprintf("%d", sellerID),
	}
	convoBody, _ := json.Marshal(convoPayload)

	req, err := http.NewRequest("POST", convoURL, strings.NewReader(string(convoBody)))
	if err != nil {
		return fmt.Errorf("create conversation request: %w", err)
	}
	req.Header = c.apiHeadersWithBody()

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("conversation request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	bodyStr := strings.TrimSpace(string(respBody))

	log.Printf("[vinted] POST /api/v2/conversations -> %d (%.300s)", resp.StatusCode, bodyStr)

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("create conversation failed (HTTP %d): %s", resp.StatusCode, truncate(bodyStr, 300))
	}

	var convoResp struct {
		Conversation struct {
			ID int64 `json:"id"`
		} `json:"conversation"`
	}
	if err := json.Unmarshal(respBody, &convoResp); err != nil {
		return fmt.Errorf("parse conversation response: %w", err)
	}
	convoID := convoResp.Conversation.ID
	if convoID == 0 {
		var alt struct {
			ID int64 `json:"id"`
		}
		if err := json.Unmarshal(respBody, &alt); err == nil && alt.ID > 0 {
			convoID = alt.ID
		}
	}
	if convoID == 0 {
		return fmt.Errorf("could not extract conversation ID from response: %.200s", bodyStr)
	}

	log.Printf("[vinted] created conversation %d for item %d", convoID, itemID)

	replyURL := fmt.Sprintf("https://%s/api/v2/conversations/%d/replies", c.session.Domain, convoID)
	replyPayload := map[string]interface{}{
		"reply": map[string]interface{}{
			"body":                                   message,
			"photo_temp_uuids":                       nil,
			"is_personal_data_sharing_check_skipped": false,
		},
	}
	replyBody, _ := json.Marshal(replyPayload)

	req2, err := http.NewRequest("POST", replyURL, strings.NewReader(string(replyBody)))
	if err != nil {
		return fmt.Errorf("create reply request: %w", err)
	}
	req2.Header = c.apiHeadersWithBody()

	resp2, err := c.httpClient.Do(req2)
	if err != nil {
		return fmt.Errorf("reply request failed: %w", err)
	}
	defer resp2.Body.Close()

	respBody2, _ := io.ReadAll(resp2.Body)
	bodyStr2 := strings.TrimSpace(string(respBody2))

	log.Printf("[vinted] POST /api/v2/conversations/%d/replies -> %d (%.300s)", convoID, resp2.StatusCode, bodyStr2)

	if resp2.StatusCode >= 200 && resp2.StatusCode < 300 {
		log.Printf("[vinted] message sent to seller %d for item %d", sellerID, itemID)
		return nil
	}

	return fmt.Errorf("send reply failed (HTTP %d): %s", resp2.StatusCode, truncate(bodyStr2, 300))
}

func (c *Client) SendOffer(itemID, sellerID int64, price string, currency string) error {
	err := c.doSendOffer(itemID, sellerID, price, currency)
	if err != nil && strings.Contains(err.Error(), "HTTP 401") && c.session.RefreshToken != "" {
		log.Printf("[vinted] send offer got 401, attempting token refresh...")
		if refreshErr := c.RefreshAccessToken(); refreshErr != nil {
			log.Printf("[vinted] token refresh failed: %v", refreshErr)
			return err
		}
		return c.doSendOffer(itemID, sellerID, price, currency)
	}
	return err
}

func (c *Client) doSendOffer(itemID, sellerID int64, price string, currency string) error {
	if err := c.WarmUp(); err != nil {
		log.Printf("[vinted] warmup failed before send offer: %v", err)
	}

	convoURL := fmt.Sprintf("https://%s/api/v2/conversations", c.session.Domain)
	convoPayload := map[string]interface{}{
		"initiator":        "ask_seller",
		"item_id":          fmt.Sprintf("%d", itemID),
		"opposite_user_id": fmt.Sprintf("%d", sellerID),
	}
	body, _ := json.Marshal(convoPayload)

	req, err := http.NewRequest("POST", convoURL, strings.NewReader(string(body)))
	if err != nil {
		return fmt.Errorf("create conversation request: %w", err)
	}
	req.Header = c.apiHeadersWithBody()

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("conversation request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	bodyStr := strings.TrimSpace(string(respBody))

	log.Printf("[vinted] POST /api/v2/conversations (for offer context) -> %d (%.300s)", resp.StatusCode, bodyStr)

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("failed to get transaction/conversation context (HTTP %d): %s", resp.StatusCode, truncate(bodyStr, 300))
	}

	var convoResp struct {
		Conversation struct {
			Transaction struct {
				ID int64 `json:"id"`
			} `json:"transaction"`
		} `json:"conversation"`
	}

	if err := json.Unmarshal(respBody, &convoResp); err != nil {
		return fmt.Errorf("parse conversation response for tx id: %w", err)
	}

	txID := convoResp.Conversation.Transaction.ID
	if txID == 0 {
		return fmt.Errorf("could not extract transaction ID from conversation response: %.200s", bodyStr)
	}

	log.Printf("[vinted] found transaction ID %d for offer", txID)

	offerURL := fmt.Sprintf("https://%s/api/v2/transactions/%d/offer_requests", c.session.Domain, txID)
	offerPayload := map[string]interface{}{
		"offer_request": map[string]string{
			"price":    price,
			"currency": currency,
		},
	}
	offerBody, _ := json.Marshal(offerPayload)

	req2, err := http.NewRequest("POST", offerURL, strings.NewReader(string(offerBody)))
	if err != nil {
		return fmt.Errorf("create offer request: %w", err)
	}
	req2.Header = c.apiHeadersWithBody()

	resp2, err := c.httpClient.Do(req2)
	if err != nil {
		return fmt.Errorf("offer request failed: %w", err)
	}
	defer resp2.Body.Close()

	respBody2, _ := io.ReadAll(resp2.Body)
	bodyStr2 := strings.TrimSpace(string(respBody2))

	log.Printf("[vinted] POST /api/v2/transactions/%d/offer_requests -> %d (%.300s)", txID, resp2.StatusCode, bodyStr2)

	if resp2.StatusCode >= 200 && resp2.StatusCode < 300 {
		log.Printf("[vinted] offer sent for item %d (price: %s %s)", itemID, price, currency)
		return nil
	}

	var errResp struct {
		Message string `json:"message"`
		Code    int    `json:"code"`
	}
	if err := json.Unmarshal(respBody2, &errResp); err == nil && errResp.Message != "" {
		return fmt.Errorf("offer failed: %s", errResp.Message)
	}

	return fmt.Errorf("send offer failed (HTTP %d): %s", resp2.StatusCode, truncate(bodyStr2, 300))
}
