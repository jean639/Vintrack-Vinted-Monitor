package api

import (
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"vintrack-vinted/internal/session"
	"vintrack-vinted/internal/vinted"
)

type Server struct {
	sessions   *session.Manager
	listenAddr string
}

func NewServer(sessions *session.Manager, addr string) *Server {
	return &Server{sessions: sessions, listenAddr: addr}
}

func (s *Server) Start() error {
	mux := http.NewServeMux()

	mux.HandleFunc("POST /api/account/link", s.handleLink)
	mux.HandleFunc("POST /api/account/phone", s.handleUpdatePhoneNumber)
	mux.HandleFunc("DELETE /api/account/unlink", s.handleUnlink)
	mux.HandleFunc("GET /api/account/status", s.handleStatus)
	mux.HandleFunc("GET /api/account/info", s.handleInfo)

	mux.HandleFunc("POST /api/items/like", s.handleLike)
	mux.HandleFunc("POST /api/items/unlike", s.handleUnlike)
	mux.HandleFunc("POST /api/items/buy", s.handleOneClickBuy)
	mux.HandleFunc("POST /api/items/buy/warm", s.handleBuyWarm)
	mux.HandleFunc("GET /api/items/checkout-links", s.handleCheckoutLinks)
	mux.HandleFunc("GET /api/items/liked", s.handleLikedItems)
	mux.HandleFunc("GET /api/items/favorites", s.handleFavorites)
	mux.HandleFunc("GET /api/items/wardrobe", s.handleWardrobe)

	mux.HandleFunc("GET /api/messages/inbox", s.handleInbox)
	mux.HandleFunc("GET /api/notifications", s.handleNotifications)
	mux.HandleFunc("GET /api/messages/conversations/{id}", s.handleConversationReplies)
	mux.HandleFunc("POST /api/messages/send", s.handleSendMessage)
	mux.HandleFunc("POST /api/messages/reply", s.handleReplyToConversation)
	mux.HandleFunc("POST /api/offers/send", s.handleSendOffer)

	mux.HandleFunc("POST /api/account/refresh", s.handleRefreshToken)

	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, 200, map[string]string{"status": "ok"})
	})

	log.Printf("API server listening on %s", s.listenAddr)
	return http.ListenAndServe(s.listenAddr, s.withMiddleware(mux))
}

func (s *Server) withMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-User-ID")
		if r.Method == "OPTIONS" {
			w.WriteHeader(204)
			return
		}
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start).Round(time.Millisecond))
	})
}

func getUserID(r *http.Request) string {
	return r.Header.Get("X-User-ID")
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, msg string, status int) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func (s *Server) getSessionAndClient(r *http.Request, w http.ResponseWriter) (*session.VintedSession, *vinted.Client, bool) {
	userID := getUserID(r)
	if userID == "" {
		writeError(w, "unauthorized: missing X-User-ID header", 401)
		return nil, nil, false
	}

	sess, err := s.sessions.Get(userID)
	if err != nil {
		writeError(w, "session fetch error", 500)
		return nil, nil, false
	}
	if sess == nil {
		writeError(w, "no linked Vinted account", 404)
		return nil, nil, false
	}

	client, err := vinted.NewClient(sess)
	if err != nil {
		writeError(w, "failed to create Vinted client", 500)
		return nil, nil, false
	}

	if err := client.WarmUp(); err != nil {
		log.Printf("[session] warmup failed for user %s: %v", userID, err)
	} else {
		s.persistSessionIfChanged(sess, client.GetSession(), false)
	}

	if sess.Status != "active" {
		log.Printf("[session] session for user %s is %s, attempting recovery...", userID, sess.Status)

		if sess.RefreshToken != "" {
			log.Printf("[session] attempting token refresh for user %s...", userID)
			if err := client.RefreshAccessToken(); err != nil {
				log.Printf("[session] token refresh failed for user %s: %v", userID, err)
			} else {
				log.Printf("[session] token refresh succeeded for user %s", userID)
				updated := client.GetSession()
				updated.Status = "active"
				updated.LastCheck = time.Now().UTC().Format(time.RFC3339)
				_ = s.sessions.Store(*updated)
				sess = updated
				return sess, client, true
			}
		}

		if client.ValidateSession() {
			log.Printf("[session] re-validation succeeded for user %s, reactivating session", userID)
			sess.Status = "active"
			sess.LastCheck = time.Now().UTC().Format(time.RFC3339)
			_ = s.sessions.Store(*sess)
		} else {
			writeError(w, "Vinted session is "+sess.Status+", please re-link", 403)
			return nil, nil, false
		}
	}

	return sess, client, true
}

type linkRequest struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	CookieHeader string `json:"cookie_header"`
	UserAgent    string `json:"user_agent"`
	PhoneNumber  string `json:"phone_number"`
	Domain       string `json:"domain"`
}

func (s *Server) handleLink(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		writeError(w, "unauthorized", 401)
		return
	}

	var req linkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, "invalid request body", 400)
		return
	}

	if req.AccessToken == "" {
		writeError(w, "access_token is required", 400)
		return
	}
	if req.Domain == "" {
		writeError(w, "domain is required", 400)
		return
	}

	sess := session.VintedSession{
		UserID:       userID,
		AccessToken:  req.AccessToken,
		RefreshToken: req.RefreshToken,
		CookieHeader: strings.TrimSpace(req.CookieHeader),
		UserAgent:    strings.TrimSpace(req.UserAgent),
		PhoneNumber:  strings.TrimSpace(req.PhoneNumber),
		Domain:       req.Domain,
		Status:       "active",
		LinkedAt:     time.Now().UTC().Format(time.RFC3339),
		LastCheck:    time.Now().UTC().Format(time.RFC3339),
	}

	client, err := vinted.NewClient(&sess)
	if err != nil {
		writeError(w, "failed to create client: "+err.Error(), 500)
		return
	}

	if err := client.WarmUp(); err != nil {
		log.Printf("[link] warmup warning for user %s: %v", userID, err)
	}

	info, err := client.GetAccountInfo()
	if err != nil {
		writeError(w, "invalid token: "+err.Error(), 401)
		return
	}

	linkedSession := client.GetSession()
	linkedSession.VintedUserID = info.ID
	linkedSession.VintedName = info.Login

	if err := s.sessions.Store(*linkedSession); err != nil {
		writeError(w, "failed to save session", 500)
		return
	}

	log.Printf("[account] linked user %s -> @%s (ID: %d) on %s", userID, info.Login, info.ID, req.Domain)

	writeJSON(w, 200, map[string]interface{}{
		"linked":              true,
		"vinted_name":         info.Login,
		"vinted_id":           info.ID,
		"domain":              req.Domain,
		"has_browser_session": linkedSession.CookieHeader != "",
		"has_phone_number":    linkedSession.PhoneNumber != "",
	})
}

type updatePhoneNumberRequest struct {
	PhoneNumber string `json:"phone_number"`
}

func (s *Server) handleUpdatePhoneNumber(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		writeError(w, "unauthorized", 401)
		return
	}

	sess, err := s.sessions.Get(userID)
	if err != nil {
		writeError(w, "session fetch error", 500)
		return
	}
	if sess == nil {
		writeError(w, "no linked Vinted account", 404)
		return
	}

	var req updatePhoneNumberRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, "invalid request body", 400)
		return
	}

	sess.PhoneNumber = strings.TrimSpace(req.PhoneNumber)
	sess.LastCheck = time.Now().UTC().Format(time.RFC3339)
	if err := s.sessions.Store(*sess); err != nil {
		writeError(w, "failed to save phone number", 500)
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"has_phone_number": sess.PhoneNumber != "",
		"last_check":       sess.LastCheck,
	})
}

func (s *Server) handleUnlink(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		writeError(w, "unauthorized", 401)
		return
	}

	if err := s.sessions.Delete(userID); err != nil {
		writeError(w, "failed to unlink", 500)
		return
	}
	_ = s.sessions.DeleteLikes(userID)
	_ = s.sessions.DeleteCheckoutLinks(userID)

	log.Printf("[account] unlinked user %s", userID)
	writeJSON(w, 200, map[string]string{"status": "unlinked"})
}

func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		writeError(w, "unauthorized", 401)
		return
	}

	sess, err := s.sessions.Get(userID)
	if err != nil {
		writeError(w, "error fetching session", 500)
		return
	}

	if sess == nil {
		writeJSON(w, 200, map[string]interface{}{"linked": false})
		return
	}

	writeJSON(w, 200, map[string]interface{}{
		"linked":              true,
		"status":              sess.Status,
		"vinted_name":         sess.VintedName,
		"vinted_id":           sess.VintedUserID,
		"domain":              sess.Domain,
		"linked_at":           sess.LinkedAt,
		"last_check":          sess.LastCheck,
		"has_browser_session": sess.CookieHeader != "",
		"has_phone_number":    sess.PhoneNumber != "",
	})
}

func (s *Server) handleInfo(w http.ResponseWriter, r *http.Request) {
	_, client, ok := s.getSessionAndClient(r, w)
	if !ok {
		return
	}

	info, err := client.GetAccountInfo()
	if err != nil {
		writeError(w, "failed to fetch account: "+err.Error(), 502)
		return
	}

	writeJSON(w, 200, info)
}

type itemRequest struct {
	ItemID int64 `json:"item_id"`
}

func (s *Server) handleLike(w http.ResponseWriter, r *http.Request) {
	sess, client, ok := s.getSessionAndClient(r, w)
	if !ok {
		return
	}

	var req itemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ItemID == 0 {
		writeError(w, "item_id is required", 400)
		return
	}

	if err := client.LikeItem(req.ItemID); err != nil {
		writeError(w, "like failed: "+err.Error(), 502)
		return
	}

	s.persistIfRefreshed(sess, client)

	userID := getUserID(r)
	_ = s.sessions.AddLike(userID, req.ItemID)

	writeJSON(w, 200, map[string]interface{}{"status": "liked", "item_id": req.ItemID})
}

func (s *Server) handleUnlike(w http.ResponseWriter, r *http.Request) {
	sess, client, ok := s.getSessionAndClient(r, w)
	if !ok {
		return
	}

	var req itemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.ItemID == 0 {
		writeError(w, "item_id is required", 400)
		return
	}

	if err := client.UnlikeItem(req.ItemID); err != nil {
		writeError(w, "unlike failed: "+err.Error(), 502)
		return
	}

	s.persistIfRefreshed(sess, client)

	userID := getUserID(r)
	_ = s.sessions.RemoveLike(userID, req.ItemID)

	writeJSON(w, 200, map[string]interface{}{"status": "unliked", "item_id": req.ItemID})
}

type oneClickBuyRequest struct {
	ItemID               int64                  `json:"item_id"`
	SellerID             int64                  `json:"seller_id"`
	IncogniaRequestToken string                 `json:"incognia_request_token"`
	PickupType           int                    `json:"pickup_type"`
	BrowserInfo          vinted.BrowserInfo     `json:"browser_info"`
	PaymentMethod        map[string]interface{} `json:"payment_method"`
	PhoneNumber          string                 `json:"phone_number"`
}

func (s *Server) handleOneClickBuy(w http.ResponseWriter, r *http.Request) {
	sess, client, ok := s.getSessionAndClient(r, w)
	if !ok {
		return
	}

	var req oneClickBuyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, "invalid request body", 400)
		return
	}
	if req.ItemID == 0 {
		writeError(w, "item_id is required", 400)
		return
	}
	if req.SellerID == 0 {
		writeError(w, "seller_id is required", 400)
		return
	}

	result, err := client.OneClickBuy(req.ItemID, vinted.OneClickBuyOptions{
		SellerID:             req.SellerID,
		IncogniaRequestToken: strings.TrimSpace(req.IncogniaRequestToken),
		PickupType:           req.PickupType,
		BrowserInfo:          req.BrowserInfo,
		PaymentMethod:        req.PaymentMethod,
		PhoneNumber:          firstNonEmpty(strings.TrimSpace(req.PhoneNumber), sess.PhoneNumber),
	})
	if err != nil {
		var authErr *vinted.AuthError
		if errors.As(err, &authErr) {
			writeJSON(w, 401, map[string]interface{}{
				"error":        "one-click buy failed: " + authErr.Error(),
				"code":         "invalid_authentication_token",
				"step":         authErr.Step,
				"vinted_code":  authErr.VintedCode,
				"vinted_error": authErr.Message,
			})
			return
		}
		var paymentMissingErr *vinted.PaymentURLMissingError
		if errors.As(err, &paymentMissingErr) {
			s.storeCheckoutLink(getUserID(r), sess, session.CheckoutLink{
				ItemID:        req.ItemID,
				SellerID:      req.SellerID,
				TransactionID: paymentMissingErr.TransactionID,
				PurchaseID:    paymentMissingErr.PurchaseID,
				CheckoutURL:   paymentMissingErr.CheckoutURL,
				Domain:        sess.Domain,
				Status:        "payment_url_missing",
				CreatedAt:     time.Now().UTC().Format(time.RFC3339),
			})
			writeJSON(w, 409, map[string]interface{}{
				"error":        "one-click buy failed: " + paymentMissingErr.Error(),
				"code":         "payment_url_missing",
				"purchase_id":  paymentMissingErr.PurchaseID,
				"checkout_url": paymentMissingErr.CheckoutURL,
				"payment_raw":  paymentMissingErr.Raw,
			})
			return
		}
		var paymentStateErr *vinted.PaymentStateError
		if errors.As(err, &paymentStateErr) {
			writeJSON(w, 409, map[string]interface{}{
				"error":        "one-click buy failed: " + paymentStateErr.Error(),
				"code":         paymentStateErr.Code,
				"step":         paymentStateErr.Step,
				"vinted_code":  paymentStateErr.VintedCode,
				"vinted_error": paymentStateErr.Message,
				"payment_raw":  paymentStateErr.Raw,
			})
			return
		}
		var challengeErr *vinted.DataDomeChallengeError
		if errors.As(err, &challengeErr) {
			writeJSON(w, 409, map[string]interface{}{
				"error":       "one-click buy failed: " + challengeErr.Error(),
				"code":        "datadome_challenge",
				"step":        challengeErr.Step,
				"captcha_url": challengeErr.CaptchaURL,
			})
			return
		}
		writeError(w, "one-click buy failed: "+err.Error(), 502)
		return
	}

	s.storeCheckoutLink(getUserID(r), sess, session.CheckoutLink{
		ItemID:        result.ItemID,
		SellerID:      result.SellerID,
		TransactionID: result.TransactionID,
		PurchaseID:    result.PurchaseID,
		CheckoutURL:   result.CheckoutURL,
		PaymentURL:    result.PaymentURL,
		Domain:        sess.Domain,
		Status:        result.Status,
		CreatedAt:     time.Now().UTC().Format(time.RFC3339),
	})
	s.persistIfRefreshed(sess, client)
	writeJSON(w, 200, result)
}

func (s *Server) handleBuyWarm(w http.ResponseWriter, r *http.Request) {
	sess, client, ok := s.getSessionAndClient(r, w)
	if !ok {
		return
	}

	s.persistIfRefreshed(sess, client)
	writeJSON(w, 200, map[string]string{"status": "warmed"})
}

func (s *Server) handleLikedItems(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		writeError(w, "unauthorized", 401)
		return
	}

	ids, err := s.sessions.GetLikes(userID)
	if err != nil {
		writeError(w, "failed to fetch likes", 500)
		return
	}

	writeJSON(w, 200, map[string]interface{}{"item_ids": ids})
}

func (s *Server) handleCheckoutLinks(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		writeError(w, "unauthorized", 401)
		return
	}

	links, err := s.sessions.GetCheckoutLinks(userID)
	if err != nil {
		writeError(w, "failed to fetch checkout links", 500)
		return
	}

	writeJSON(w, 200, map[string]interface{}{"links": links})
}

func (s *Server) handleFavorites(w http.ResponseWriter, r *http.Request) {
	sess, client, ok := s.getSessionAndClient(r, w)
	if !ok {
		return
	}

	page := r.URL.Query().Get("page")
	favs, err := client.GetFavourites(sess.VintedUserID, page)
	if err != nil {
		writeError(w, "failed to fetch favorites: "+err.Error(), 502)
		return
	}

	client.EnrichFavorites(favs)

	s.persistIfRefreshed(sess, client)
	writeJSON(w, 200, favs)
}

func (s *Server) handleWardrobe(w http.ResponseWriter, r *http.Request) {
	sess, client, ok := s.getSessionAndClient(r, w)
	if !ok {
		return
	}

	page := 1
	if raw := strings.TrimSpace(r.URL.Query().Get("page")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			page = parsed
		}
	}

	perPage := 20
	if raw := strings.TrimSpace(r.URL.Query().Get("per_page")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 && parsed <= 100 {
			perPage = parsed
		}
	}

	order := strings.TrimSpace(r.URL.Query().Get("order"))
	if order == "" {
		order = "relevance"
	}

	wardrobe, err := client.GetWardrobe(sess.VintedUserID, page, perPage, order)
	if err != nil {
		writeError(w, "failed to fetch wardrobe: "+err.Error(), 502)
		return
	}

	s.persistIfRefreshed(sess, client)
	writeJSON(w, 200, wardrobe)
}

func (s *Server) handleInbox(w http.ResponseWriter, r *http.Request) {
	sess, client, ok := s.getSessionAndClient(r, w)
	if !ok {
		return
	}

	page := 1
	if raw := strings.TrimSpace(r.URL.Query().Get("page")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			page = parsed
		}
	}

	perPage := 20
	if raw := strings.TrimSpace(r.URL.Query().Get("per_page")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 && parsed <= 100 {
			perPage = parsed
		}
	}

	inbox, err := client.GetInbox(page, perPage)
	if err != nil {
		writeError(w, "failed to fetch inbox: "+err.Error(), 502)
		return
	}

	s.persistIfRefreshed(sess, client)
	writeJSON(w, 200, inbox)
}

func (s *Server) handleNotifications(w http.ResponseWriter, r *http.Request) {
	sess, client, ok := s.getSessionAndClient(r, w)
	if !ok {
		return
	}

	page := 1
	if raw := strings.TrimSpace(r.URL.Query().Get("page")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			page = parsed
		}
	}

	perPage := 5
	if raw := strings.TrimSpace(r.URL.Query().Get("per_page")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 && parsed <= 50 {
			perPage = parsed
		}
	}

	notifications, err := client.GetNotifications(page, perPage)
	if err != nil {
		writeError(w, "failed to fetch notifications: "+err.Error(), 502)
		return
	}

	s.persistIfRefreshed(sess, client)
	writeJSON(w, 200, notifications)
}

func (s *Server) handleConversationReplies(w http.ResponseWriter, r *http.Request) {
	sess, client, ok := s.getSessionAndClient(r, w)
	if !ok {
		return
	}

	conversationID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || conversationID == 0 {
		writeError(w, "invalid conversation id", 400)
		return
	}

	page := 1
	if raw := strings.TrimSpace(r.URL.Query().Get("page")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 {
			page = parsed
		}
	}

	perPage := 100
	if raw := strings.TrimSpace(r.URL.Query().Get("per_page")); raw != "" {
		if parsed, err := strconv.Atoi(raw); err == nil && parsed > 0 && parsed <= 200 {
			perPage = parsed
		}
	}

	payload, err := client.GetConversationReplies(conversationID, page, perPage)
	if err != nil {
		writeError(w, "failed to fetch conversation replies: "+err.Error(), 502)
		return
	}

	payload["current_user_id"] = sess.VintedUserID

	s.persistIfRefreshed(sess, client)
	writeJSON(w, 200, payload)
}

func (s *Server) persistIfRefreshed(original *session.VintedSession, client *vinted.Client) {
	s.persistSessionIfChanged(original, client.GetSession(), true)
}

func (s *Server) persistSessionIfChanged(original *session.VintedSession, updated *session.VintedSession, markHealthy bool) {
	if original == nil || updated == nil {
		return
	}
	if !sessionChanged(original, updated) {
		return
	}

	if markHealthy {
		updated.Status = "active"
		updated.LastCheck = time.Now().UTC().Format(time.RFC3339)
	}

	if err := s.sessions.Store(*updated); err != nil {
		log.Printf("[server] failed to persist session for user %s: %v", updated.UserID, err)
		return
	}

	log.Printf("[server] persisted session update for user %s", updated.UserID)
}

func sessionChanged(original *session.VintedSession, updated *session.VintedSession) bool {
	return original.AccessToken != updated.AccessToken ||
		original.RefreshToken != updated.RefreshToken ||
		original.CookieHeader != updated.CookieHeader ||
		original.CsrfToken != updated.CsrfToken ||
		original.AnonID != updated.AnonID ||
		original.WarmedAt != updated.WarmedAt ||
		original.Status != updated.Status ||
		original.LastCheck != updated.LastCheck
}

func (s *Server) storeCheckoutLink(userID string, sess *session.VintedSession, link session.CheckoutLink) {
	if userID == "" || sess == nil {
		return
	}
	if strings.TrimSpace(link.CheckoutURL) == "" && strings.TrimSpace(link.PaymentURL) == "" {
		return
	}
	if link.Domain == "" {
		link.Domain = sess.Domain
	}
	if link.CreatedAt == "" {
		link.CreatedAt = time.Now().UTC().Format(time.RFC3339)
	}
	if err := s.sessions.AddCheckoutLink(userID, link); err != nil {
		log.Printf("[server] failed to store checkout link for user %s: %v", userID, err)
	}
}

type sendMessageRequest struct {
	ItemID   int64  `json:"item_id"`
	SellerID int64  `json:"seller_id"`
	Message  string `json:"message"`
}

type replyToConversationRequest struct {
	ConversationID int64  `json:"conversation_id"`
	Message        string `json:"message"`
}

func (s *Server) handleSendMessage(w http.ResponseWriter, r *http.Request) {
	sess, client, ok := s.getSessionAndClient(r, w)
	if !ok {
		return
	}

	var req sendMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, "invalid request body", 400)
		return
	}

	if req.ItemID == 0 {
		writeError(w, "item_id is required", 400)
		return
	}
	if req.SellerID == 0 {
		writeError(w, "seller_id is required", 400)
		return
	}
	msg := strings.TrimSpace(req.Message)
	if msg == "" {
		writeError(w, "message is required", 400)
		return
	}
	if len(msg) > 2000 {
		writeError(w, "message too long (max 2000 characters)", 400)
		return
	}

	if err := client.SendMessage(req.ItemID, req.SellerID, msg); err != nil {
		writeError(w, "send message failed: "+err.Error(), 502)
		return
	}

	s.persistIfRefreshed(sess, client)

	writeJSON(w, 200, map[string]interface{}{"status": "sent", "item_id": req.ItemID})
}

func (s *Server) handleReplyToConversation(w http.ResponseWriter, r *http.Request) {
	sess, client, ok := s.getSessionAndClient(r, w)
	if !ok {
		return
	}

	var req replyToConversationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, "invalid request body", 400)
		return
	}

	if req.ConversationID == 0 {
		writeError(w, "conversation_id is required", 400)
		return
	}

	msg := strings.TrimSpace(req.Message)
	if msg == "" {
		writeError(w, "message is required", 400)
		return
	}
	if len(msg) > 2000 {
		writeError(w, "message too long (max 2000 characters)", 400)
		return
	}

	if err := client.ReplyToConversation(req.ConversationID, msg); err != nil {
		writeError(w, "send reply failed: "+err.Error(), 502)
		return
	}

	s.persistIfRefreshed(sess, client)

	writeJSON(w, 200, map[string]interface{}{"status": "sent", "conversation_id": req.ConversationID})
}

type sendOfferRequest struct {
	ItemID   int64  `json:"item_id"`
	SellerID int64  `json:"seller_id"`
	Price    string `json:"price"`
	Currency string `json:"currency"`
}

func (s *Server) handleSendOffer(w http.ResponseWriter, r *http.Request) {
	sess, client, ok := s.getSessionAndClient(r, w)
	if !ok {
		return
	}

	var req sendOfferRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, "invalid request body", 400)
		return
	}

	if req.ItemID == 0 {
		writeError(w, "item_id is required", 400)
		return
	}
	if req.SellerID == 0 {
		writeError(w, "seller_id is required", 400)
		return
	}
	if req.Price == "" {
		writeError(w, "price is required", 400)
		return
	}
	if req.Currency == "" {
		req.Currency = "EUR" // default
	}

	if err := client.SendOffer(req.ItemID, req.SellerID, req.Price, req.Currency); err != nil {
		writeError(w, err.Error(), 502)
		return
	}

	s.persistIfRefreshed(sess, client)

	writeJSON(w, 200, map[string]interface{}{"status": "sent", "item_id": req.ItemID, "price": req.Price})
}

func (s *Server) handleRefreshToken(w http.ResponseWriter, r *http.Request) {
	userID := getUserID(r)
	if userID == "" {
		writeError(w, "unauthorized", 401)
		return
	}

	sess, err := s.sessions.Get(userID)
	if err != nil {
		writeError(w, "session fetch error", 500)
		return
	}
	if sess == nil {
		writeError(w, "no linked Vinted account", 404)
		return
	}
	if sess.RefreshToken == "" {
		writeError(w, "no refresh token available — please re-link with a refresh token", 400)
		return
	}

	client, err := vinted.NewClient(sess)
	if err != nil {
		writeError(w, "failed to create client", 500)
		return
	}

	if err := client.WarmUp(); err != nil {
		log.Printf("[refresh] warmup warning for user %s: %v", userID, err)
	}

	if err := client.RefreshAccessToken(); err != nil {
		log.Printf("[refresh] token refresh failed for user %s: %v", userID, err)

		var body struct {
			RefreshToken string `json:"refresh_token"`
		}
		_ = json.NewDecoder(strings.NewReader("")).Decode(&body)

		writeError(w, "token refresh failed: "+err.Error(), 502)
		return
	}

	updated := client.GetSession()
	updated.Status = "active"
	updated.LastCheck = time.Now().UTC().Format(time.RFC3339)
	if err := s.sessions.Store(*updated); err != nil {
		writeError(w, "failed to save refreshed session", 500)
		return
	}

	log.Printf("[refresh] token refreshed for user %s (@%s)", userID, updated.VintedName)

	writeJSON(w, 200, map[string]interface{}{
		"status":      "refreshed",
		"vinted_name": updated.VintedName,
		"vinted_id":   updated.VintedUserID,
		"domain":      updated.Domain,
	})
}
