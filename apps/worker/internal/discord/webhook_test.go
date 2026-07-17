package discord

import (
	"strings"
	"testing"
	"time"

	"vintrack-worker/internal/model"
)

func TestBuildItemWebhookPayloadUsesStructuredEmbedAndGallery(t *testing.T) {
	foundAt := time.Unix(1_720_000_000, 0).UTC()
	item := model.Item{
		ID:          42,
		MonitorID:   7,
		Title:       "Nike Dunk Low",
		Brand:       "Nike",
		Price:       "85.00 EUR",
		TotalPrice:  "90.20 EUR",
		Size:        "42",
		Condition:   "Very good",
		URL:         "https://www.vinted.de/items/42",
		ImageURL:    "https://images.example/item.jpg",
		ExtraImages: []string{"https://images.example/extra.jpg"},
		Location:    "Germany",
		Rating:      "4.9 (120)",
		SellerLogin: "seller",
		SellerURL:   "https://www.vinted.de/member/5-seller",
		FoundAt:     foundAt,
	}

	payload := buildItemWebhookPayload(item, "Dunks", "free")
	embeds, ok := payload["embeds"].([]map[string]interface{})
	if !ok || len(embeds) != 2 {
		t.Fatalf("expected item embed and one gallery embed, got %#v", payload["embeds"])
	}

	embed := embeds[0]
	if embed["title"] != item.Title {
		t.Fatalf("expected title %q, got %#v", item.Title, embed["title"])
	}
	if embed["timestamp"] != foundAt.Format(time.RFC3339) {
		t.Fatalf("expected detection timestamp, got %#v", embed["timestamp"])
	}
	description, _ := embed["description"].(string)
	for _, expectedLink := range []string{item.URL, item.SellerURL, "/monitors/7"} {
		if !strings.Contains(description, expectedLink) {
			t.Fatalf("expected description to contain %q: %q", expectedLink, description)
		}
	}
	if _, ok := embed["image"]; !ok {
		t.Fatal("expected primary image in item embed")
	}
	fields, ok := embed["fields"].([]map[string]interface{})
	if !ok {
		t.Fatalf("expected structured item fields, got %#v", embed["fields"])
	}
	fieldsByName := make(map[string]interface{}, len(fields))
	for _, field := range fields {
		name, _ := field["name"].(string)
		fieldsByName[name] = field["value"]
	}
	if fieldsByName["Location"] != item.Location {
		t.Fatalf("expected location %q, got %#v", item.Location, fieldsByName["Location"])
	}
	if fieldsByName["Seller rating"] != item.Rating {
		t.Fatalf("expected rating %q, got %#v", item.Rating, fieldsByName["Seller rating"])
	}
	if _, ok := embeds[1]["fields"]; ok {
		t.Fatal("gallery embed must not duplicate item fields")
	}
	if _, ok := embeds[1]["image"]; !ok {
		t.Fatal("expected image in gallery embed")
	}
}

func TestBuildItemWebhookPayloadLimitsGalleryToThreeImages(t *testing.T) {
	payload := buildItemWebhookPayload(model.Item{
		URL:      "https://www.vinted.de/items/42",
		ImageURL: "https://images.example/main.jpg",
		ExtraImages: []string{
			"https://images.example/one.jpg",
			"https://images.example/two.jpg",
			"https://images.example/three.jpg",
		},
	}, "Monitor", "server")

	embeds := payload["embeds"].([]map[string]interface{})
	if len(embeds) != 3 {
		t.Fatalf("expected a maximum of three image embeds, got %d", len(embeds))
	}
}

func TestBuildFieldsProvidesStableCoreFields(t *testing.T) {
	fields := buildFields(model.Item{Price: "10.00 EUR"})
	if len(fields) != 3 {
		t.Fatalf("expected three core fields, got %d", len(fields))
	}
	if fields[1]["value"] != "Not specified" || fields[2]["value"] != "Not specified" {
		t.Fatalf("expected empty size and condition fallbacks, got %#v", fields)
	}
}
