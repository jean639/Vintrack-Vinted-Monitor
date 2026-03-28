package scraper

import (
	"fmt"
	"io"
	"net/url"
	"strings"
	"sync"

	http "github.com/bogdanfinn/fhttp"
	tls_client "github.com/bogdanfinn/tls-client"
	"github.com/bogdanfinn/tls-client/profiles"
)

const chromeUA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

func acceptLanguageForDomain(domain string) string {
	switch {
	case strings.Contains(domain, "vinted.co.uk"):
		return "en-GB,en;q=0.9"
	case strings.Contains(domain, "vinted.ie"):
		return "en-IE,en;q=0.9"
	case strings.Contains(domain, "vinted.fr"):
		return "fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7"
	case strings.Contains(domain, "vinted.es"):
		return "es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7"
	case strings.Contains(domain, "vinted.it"):
		return "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7"
	case strings.Contains(domain, "vinted.nl"):
		return "nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7"
	case strings.Contains(domain, "vinted.pl"):
		return "pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7"
	case strings.Contains(domain, "vinted.pt"):
		return "pt-PT,pt;q=0.9,en-US;q=0.8,en;q=0.7"
	default:
		return "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7"
	}
}

func hostFromURL(rawURL string, fallback string) string {
	parsed, err := url.Parse(rawURL)
	if err != nil || parsed.Host == "" {
		return fallback
	}
	return parsed.Host
}

func newWarmupHeaders(domain string) http.Header {
	return http.Header{
		"User-Agent":      {chromeUA},
		"Accept":          {"text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"},
		"Accept-Language": {acceptLanguageForDomain(domain)},
	}
}

func newAPIHeaders(domain string) http.Header {
	return http.Header{
		"User-Agent":         {chromeUA},
		"Accept":             {"application/json, text/plain, */*"},
		"Accept-Language":    {acceptLanguageForDomain(domain)},
		"Cache-Control":      {"no-cache"},
		"Pragma":             {"no-cache"},
		"Sec-Ch-Ua":          {`"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"`},
		"Sec-Ch-Ua-Mobile":   {"?0"},
		"Sec-Ch-Ua-Platform": {`"macOS"`},
		"Sec-Fetch-Dest":     {"empty"},
		"Sec-Fetch-Mode":     {"cors"},
		"Sec-Fetch-Site":     {"same-origin"},
		"X-Requested-With":   {"XMLHttpRequest"},
		"Referer":            {fmt.Sprintf("https://%s/", domain)},
	}
}

type Client struct {
	HttpClient tls_client.HttpClient
	ProxyURL   string
	warmedMu   sync.Mutex
	warmed     map[string]bool
}

func NewClient(proxyURL string) (*Client, error) {
	options := []tls_client.HttpClientOption{
		tls_client.WithTimeoutSeconds(3),
		tls_client.WithClientProfile(profiles.Chrome_131),
		tls_client.WithNotFollowRedirects(),
		tls_client.WithCookieJar(tls_client.NewCookieJar()),
	}

	if proxyURL != "" {
		options = append(options, tls_client.WithProxyUrl(proxyURL))
	}

	httpClient, err := tls_client.NewHttpClient(tls_client.NewNoopLogger(), options...)
	if err != nil {
		return nil, err
	}

	return &Client{HttpClient: httpClient, ProxyURL: proxyURL, warmed: make(map[string]bool)}, nil
}

func NewSellerClient(proxyURL string) (*Client, error) {
	options := []tls_client.HttpClientOption{
		tls_client.WithTimeoutSeconds(10),
		tls_client.WithClientProfile(profiles.Chrome_131),
		tls_client.WithNotFollowRedirects(),
		tls_client.WithCookieJar(tls_client.NewCookieJar()),
	}

	if proxyURL != "" {
		options = append(options, tls_client.WithProxyUrl(proxyURL))
	}

	httpClient, err := tls_client.NewHttpClient(tls_client.NewNoopLogger(), options...)
	if err != nil {
		return nil, err
	}

	return &Client{HttpClient: httpClient, ProxyURL: proxyURL, warmed: make(map[string]bool)}, nil
}

func (c *Client) ProxyLabel() string {
	if c == nil || c.ProxyURL == "" {
		return "direct"
	}

	parsed, err := url.Parse(c.ProxyURL)
	if err != nil || parsed.Host == "" {
		return c.ProxyURL
	}

	return parsed.Scheme + "://" + parsed.Host
}

func (c *Client) WarmUp() error {
	return c.WarmUpRegion("www.vinted.de")
}

func (c *Client) WarmUpRegion(domain string) error {
	currentURL := fmt.Sprintf("https://%s/", domain)

	for redirects := 0; redirects < 3; redirects++ {
		currentDomain := hostFromURL(currentURL, domain)

		req, err := http.NewRequest("GET", currentURL, nil)
		if err != nil {
			return err
		}
		req.Header = newWarmupHeaders(currentDomain)

		resp, err := c.HttpClient.Do(req)
		if err != nil {
			return err
		}

		if resp.StatusCode >= 300 && resp.StatusCode < 400 {
			location := resp.Header.Get("Location")
			resp.Body.Close()
			if location == "" {
				return fmt.Errorf("warmup redirect without location for %s", currentDomain)
			}

			nextURL, err := resolveRedirectURL(currentURL, location)
			if err != nil {
				return fmt.Errorf("warmup redirect resolve: %w", err)
			}
			currentURL = nextURL
			continue
		}

		if resp.StatusCode != 200 {
			_, _ = io.Copy(io.Discard, resp.Body)
			resp.Body.Close()
			return fmt.Errorf("warmup %s returned %d", currentDomain, resp.StatusCode)
		}

		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 64*1024))
		resp.Body.Close()
		return nil
	}

	return fmt.Errorf("warmup too many redirects for %s", domain)
}

func (c *Client) EnsureWarm(domain string) error {
	c.warmedMu.Lock()
	if c.warmed[domain] {
		c.warmedMu.Unlock()
		return nil
	}
	c.warmedMu.Unlock()

	if err := c.WarmUpRegion(domain); err != nil {
		return err
	}

	c.warmedMu.Lock()
	c.warmed[domain] = true
	c.warmedMu.Unlock()
	return nil
}

func (c *Client) ResetWarm(domain string) {
	c.warmedMu.Lock()
	delete(c.warmed, domain)
	c.warmedMu.Unlock()
}
