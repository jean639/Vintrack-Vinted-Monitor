package scraper

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"sync"
	"time"

	"vintrack-worker/internal/model"
)

//go:embed testdata/vinted/*.json
var mockCatalogFixtures embed.FS

type MockCatalogFetcher struct {
	scenario       string
	steps          []mockCatalogStep
	dropInterval   time.Duration
	nextDropAt     time.Time
	generatedItems []model.VintedItem
	counter        int64
	mu             sync.Mutex
	index          int
}

type mockCatalogStep struct {
	Status int                `json:"status,omitempty"`
	Items  []model.VintedItem `json:"items"`
}

func NewMockCatalogFetcher(scenario string) (*MockCatalogFetcher, error) {
	if scenario == "" {
		scenario = "new-items"
	}

	files, ok := mockCatalogScenarios()[scenario]
	if !ok {
		return nil, fmt.Errorf("unknown mock scenario %q", scenario)
	}

	steps := make([]mockCatalogStep, 0, len(files))
	for _, file := range files {
		raw, err := mockCatalogFixtures.ReadFile("testdata/vinted/" + file)
		if err != nil {
			return nil, fmt.Errorf("read fixture %s: %w", file, err)
		}

		var step mockCatalogStep
		if err := json.Unmarshal(raw, &step); err != nil {
			return nil, fmt.Errorf("decode fixture %s: %w", file, err)
		}
		if step.Status == 0 {
			step.Status = 200
		}
		steps = append(steps, step)
	}

	return &MockCatalogFetcher{
		scenario:     scenario,
		steps:        steps,
		dropInterval: mockDropIntervalFromEnv(),
		counter:      time.Now().UnixMilli(),
	}, nil
}

func (m *MockCatalogFetcher) Name() string {
	return "mock:" + m.scenario
}

func (m *MockCatalogFetcher) RequiresNetwork() bool {
	return false
}

func (m *MockCatalogFetcher) FetchCatalog(ctx context.Context, client *Client, apiURL string, domain string) ([]model.VintedItem, int, error) {
	select {
	case <-ctx.Done():
		return nil, 0, ctx.Err()
	default:
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	if m.scenario == "new-items" {
		return m.fetchGeneratedStreamLocked(), 200, nil
	}

	idx := m.index
	if idx >= len(m.steps) {
		idx = len(m.steps) - 1
	}
	m.index++

	step := m.steps[idx]
	items := make([]model.VintedItem, len(step.Items))
	copy(items, step.Items)
	return items, step.Status, nil
}

func mockCatalogScenarios() map[string][]string {
	return map[string][]string{
		"empty":         {"empty.json"},
		"initial-seed":  {"initial.json"},
		"new-items":     {"initial.json"},
		"anti-keywords": {"initial.json", "anti-keywords.json"},
		"rate-limited":  {"rate-limited.json", "initial.json", "new-drop.json"},
	}
}

func (m *MockCatalogFetcher) fetchGeneratedStreamLocked() []model.VintedItem {
	now := time.Now()
	if m.index == 0 {
		m.index++
		m.nextDropAt = now.Add(m.dropInterval)
		return cloneVintedItems(m.steps[0].Items)
	}

	if !now.Before(m.nextDropAt) {
		m.generatedItems = append([]model.VintedItem{m.newGeneratedItem()}, m.generatedItems...)
		m.nextDropAt = now.Add(m.dropInterval)
	}
	m.index++

	items := make([]model.VintedItem, 0, len(m.generatedItems)+len(m.steps[0].Items))
	items = append(items, m.generatedItems...)
	items = append(items, m.steps[0].Items...)
	if len(items) > 20 {
		items = items[:20]
	}
	return cloneVintedItems(items)
}

func (m *MockCatalogFetcher) newGeneratedItem() model.VintedItem {
	m.counter++
	template := mockGeneratedTemplates()[int(m.counter)%len(mockGeneratedTemplates())]
	id := m.counter
	imageIndex := int(id%6) + 1

	template.ID = id
	template.Url = fmt.Sprintf("/items/%d-%s", id, template.Url)
	template.Photo.Url = fmt.Sprintf("/mock-images/vinted-%d.svg", imageIndex)
	template.Photos = []model.VintedPhoto{
		{Url: template.Photo.Url},
		{Url: fmt.Sprintf("/mock-images/vinted-%d.svg", (imageIndex%6)+1)},
		{Url: fmt.Sprintf("/mock-images/vinted-%d.svg", ((imageIndex+1)%6)+1)},
	}
	template.User.ID = 80000 + id%10000
	return template
}

func mockDropIntervalFromEnv() time.Duration {
	value := os.Getenv("VINTED_MOCK_DROP_INTERVAL_MS")
	if value == "" {
		return 5 * time.Second
	}

	ms, err := strconv.Atoi(value)
	if err != nil || ms < 1 {
		return 5 * time.Second
	}
	return time.Duration(ms) * time.Millisecond
}

func cloneVintedItems(items []model.VintedItem) []model.VintedItem {
	cloned := make([]model.VintedItem, len(items))
	copy(cloned, items)
	return cloned
}

func mockGeneratedTemplates() []model.VintedItem {
	return []model.VintedItem{
		{
			Title:       "Nike Dunk Low Retro",
			Description: "Dev mock drop",
			Price:       model.VintedPrice{Amount: "19.00", Currency: "EUR"},
			Url:         "nike-dunk-low-retro",
			SizeTitle:   "42",
			Size:        "42",
			BrandTitle:  "Nike",
			Condition:   "Sehr gut",
			User:        model.VintedUser{Login: "mock_stream_one"},
		},
		{
			Title:       "Adidas Campus 00s",
			Description: "Dev mock drop",
			Price:       model.VintedPrice{Amount: "21.00", Currency: "EUR"},
			Url:         "adidas-campus-00s",
			SizeTitle:   "43",
			Size:        "43",
			BrandTitle:  "Adidas",
			Condition:   "Gut",
			User:        model.VintedUser{Login: "mock_stream_two"},
		},
		{
			Title:          "New Balance 2002R",
			Description:    "Dev mock drop",
			Price:          model.VintedPrice{Amount: "22.00", Currency: "EUR"},
			TotalItemPrice: &model.VintedPrice{Amount: "27.49", Currency: "EUR"},
			Url:            "new-balance-2002r",
			SizeTitle:      "44",
			Size:           "44",
			BrandTitle:     "New Balance",
			Condition:      "Neu mit Etikett",
			User:           model.VintedUser{Login: "mock_stream_three"},
		},
		{
			Title:       "Carhartt Detroit Jacket",
			Description: "Dev mock drop",
			Price:       model.VintedPrice{Amount: "18.00", Currency: "EUR"},
			Url:         "carhartt-detroit-jacket",
			SizeTitle:   "L",
			Size:        "L",
			BrandTitle:  "Carhartt",
			Condition:   "Gut",
			User:        model.VintedUser{Login: "mock_stream_four"},
		},
		{
			Title:          "Stone Island Hoodie",
			Description:    "Dev mock drop",
			Price:          model.VintedPrice{Amount: "20.00", Currency: "EUR"},
			TotalItemPrice: &model.VintedPrice{Amount: "25.49", Currency: "EUR"},
			Url:            "stone-island-hoodie",
			SizeTitle:      "M",
			Size:           "M",
			BrandTitle:     "Stone Island",
			Condition:      "Sehr gut",
			User:           model.VintedUser{Login: "mock_stream_five"},
		},
		{
			Title:       "Levi's 501 Denim",
			Description: "Dev mock drop",
			Price:       model.VintedPrice{Amount: "16.00", Currency: "EUR"},
			Url:         "levis-501-denim",
			SizeTitle:   "W32",
			Size:        "W32",
			BrandTitle:  "Levi's",
			Condition:   "Zufriedenstellend",
			User:        model.VintedUser{Login: "mock_stream_six"},
		},
	}
}
