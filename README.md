<p align="center">
  <img src="https://cdn-icons-png.flaticon.com/512/8266/8266540.png" width="90" alt="Vintrack" />
</p>

<h1 align="center">Vintrack</h1>

<p align="center">
  <b>Open-source Vinted monitoring platform for resellers.</b><br/>
  Real-time scraping · Instant Discord alerts · Proxy rotation · Account linking · Beautiful dashboard
</p>

<p align="center">
  <a href="#features"><img src="https://img.shields.io/badge/monitors-unlimited-22c55e?style=flat-square" alt="Monitors" /></a>
  <a href="#tech-stack"><img src="https://img.shields.io/badge/Next.js-16-000?style=flat-square&logo=next.js" alt="Next.js" /></a>
  <a href="#tech-stack"><img src="https://img.shields.io/badge/Go-1.25-00ADD8?style=flat-square&logo=go&logoColor=white" alt="Go" /></a>
  <a href="#tech-stack"><img src="https://img.shields.io/badge/PostgreSQL-15-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL" /></a>
  <a href="#tech-stack"><img src="https://img.shields.io/badge/Redis-7-DC382D?style=flat-square&logo=redis&logoColor=white" alt="Redis" /></a>
  <a href="#getting-started"><img src="https://img.shields.io/badge/deploy-one_command-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker" /></a>
</p>

<p align="center">
  <b>⭐ If you find Vintrack useful, please consider giving it a star on GitHub! It helps the project grow and reach more people. ⭐</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/topic-vinted-blue?style=flat-square" alt="Vinted" />
  <img src="https://img.shields.io/badge/topic-bot-blue?style=flat-square" alt="Bot" />
  <img src="https://img.shields.io/badge/topic-scraper-blue?style=flat-square" alt="Scraper" />
  <img src="https://img.shields.io/badge/topic-reselling-blue?style=flat-square" alt="Reselling" />
  <img src="https://img.shields.io/badge/topic-monitor-blue?style=flat-square" alt="Monitor" />
</p>

<p align="center">
  <a href="#live-demo">Live Demo</a> •
  <a href="#browser-extension">Browser Extension</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#features">Features</a> •
  <a href="#community--support">Community</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#screenshots">Screenshots</a> •
  <a href="#self-hosting">Self-Hosting</a> •
  <a href="#contributing">Contributing</a>
</p>

---

## Live Demo

You can test Vintrack live at:

- **URL:** https://vintrack.jakobaio.dev
- **Login:** Anyone can sign up via Discord OAuth
- **Default role:** New accounts are assigned **Free**
- **Browser extension:** download the latest ZIP from the [GitHub releases](https://github.com/JakobAIOdev/Vintrack-Vinted-Monitor/releases/latest/download/vintrack-browser-sync-extension.zip)
- **Important:** Persistent server proxies are not guaranteed on the demo instance, so reliability may vary over time

---

## Why Vintrack?

Vinted doesn't have a proper notification system — you either refresh manually or miss the deal. Vintrack solves this by monitoring listings **every 1.5 seconds** and sending alerts to Discord **before anyone else** can see the item.

Built for resellers who need speed. Open-sourced for the community.

- **Sub-2s detection** — catch items faster than any other tool
- **Anti-detection** — TLS fingerprint rotation with proxy support
- **Granular filters** — price, size, category, brand, color, and country/region
- **Direct Interaction** — Like items, send offers, and message sellers from the dashboard
- **Browser session sync** — Chrome extension keeps linked Vinted sessions fresh without copying tokens manually
- **Experimental checkout tooling** — browser-assisted checkout link creation with checkout-link history
- **Full dashboard** — no CLI needed, everything from the browser
- **One-command deploy** — `docker compose up` and you're live

---

## Features

### Real-Time Monitoring

Create unlimited monitors with custom search queries. Each monitor polls the Vinted API independently with configurable intervals (default: 1.5s). Results are deduplicated via Redis — you'll never see the same item twice.

### Advanced Filters

Fine-tune every monitor with:

- **Search query** — keyword-based filtering
- **Price range** — min/max price boundaries
- **Categories** — over 900+ Vinted categories supported
- **Brands** — filter by specific brands
- **Colors** — filter by item colors
- **Sizes** — clothing size filtering
- **Seller Origin** — filter by seller country (e.g. only show items from France or Italy)
- **Region** — choose the Vinted market per monitor (e.g. `vinted.de`, `vinted.hu`, `vinted.fr`)

### Vinted Account Linking & Interactions

Link your Vinted account directly in the dashboard to interact with listings without leaving Vintrack:

- **Like / Unlike items** — one-click like/unlike from the feed or monitor view
- **Send Offers** — make price offers directly to sellers (with built-in 60% minimum price validation)
- **Message Sellers** — start a conversation or ask questions instantly
- **Browser-assisted checkout** — Vintrack opens the native Vinted checkout flow in your browser and stores checkout links for recovery
- **Multi-Image Preview** — view extra images and high-res gallery directly in the dashboard
- **Account management** — link/unlink with region selection (12 EU markets)
- **Browser Sync Extension** — automatically refreshes the linked session when you log in to Vinted in the same browser
- **Status monitoring** — see your linked account status, username, and domain at a glance

The recommended linking flow is the browser extension. Install it once, sign in to Vinted in the same browser, then connect it from the Vintrack Account page. Manual token linking still exists as a fallback, but normal users should not need it.

### Browser Extension

The extension is the easiest way to use linked Vinted accounts on the live demo and in self-hosted installs.

- Download: [vintrack-browser-sync-extension.zip](https://github.com/JakobAIOdev/Vintrack-Vinted-Monitor/releases/latest/download/vintrack-browser-sync-extension.zip)
- Source: `apps/vintrack-browser-sync-extension`
- Install in Chrome: open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select the extracted extension folder
- Connect in Vintrack: open **Account**, click **Download Extension** if needed, then **Link With Installed Extension**
- What it syncs: `access_token_web`, `refresh_token_web`, Vinted domain, browser user agent, and the Vintrack light/dark theme
- What it does not sync: the full cookie header or full cookie jar

For distribution, the recommended path is to attach a versioned ZIP named `vintrack-browser-sync-extension.zip` to every GitHub release. The live demo and documentation can always point to `/releases/latest/download/vintrack-browser-sync-extension.zip`, so users do not need to browse the repo.

### Experimental Buy Disclaimer

Vintrack includes an experimental buy module for controlled checkout tests. It is intentionally separated from the normal monitoring workflow.

- The buy module is experimental and may break when Vinted changes authentication or checkout protection.
- Use a dedicated buy account for this module, not your main personal Vinted account.
- The browser-assisted checkout flow uses the shipping address and checkout context already stored on your linked Vinted account.
- Vintrack opens the native Vinted checkout link; the user chooses the payment method and completes payment manually.
- Vintrack does not replace or override your delivery address or payment method in this flow.
- The extension is strongly recommended, otherwise automatic session recovery may fail.
- Use experimental buy actions only if you understand that Vinted may reserve an item before payment is completed.

### Discord Notifications

Rich embed webhooks sent instantly when a new item is found:

- Item image, title, price (including fees), size, condition
- Seller region & rating (enriched via HTML scraping)
- Direct buy link + app deep link + dashboard link
- Per-webhook toggle — pause without deleting

### Live Feed

Server-Sent Events (SSE) stream items directly to the dashboard in real-time. See every new listing appear the moment it's detected — no manual refresh needed.

### Proxy System

Two-tier proxy architecture designed for scale:

- **Server proxies** — shared pool for premium users
- **User proxy groups** — BYOP (Bring Your Own Proxies) for free users
- Automatic rotation with `tls-client` TLS fingerprint spoofing
- Input validation — garbage lines are silently skipped
- Supports `http://`, `https://`, `socks4://`, `socks5://`, and `host:port:user:pass` formats
- Note: `vinted.co.uk` does not support IPv6 proxies. Use IPv4 proxies for UK monitors.

### Multi-User & Roles

Built-in role system with Discord OAuth:
| Role | Server Proxies | Own Proxies | Admin Panel |
|------|:-:|:-:|:-:|
| **Free** | ❌ | ✅ | ❌ |
| **Premium** | ✅ | ✅ | ❌ |
| **Admin** | ✅ | ✅ | ✅ |

---

## Community & Support

Need help, want to exchange setups with other users, or report a bug?

- Join the Vintrack Discord server: https://discord.gg/WbEpEjaWjP
- Use the server for community support, feature feedback, setup questions, and bug reports
- For reproducible code issues, GitHub issues and PRs are still welcome

---

## Screenshots

<p align="center">
  <img src="docs/screenshots/preview.gif" width="720" alt="Preview" />
</p>

<p align="center">
  <img src="docs/screenshots/overview.webp" width="49%" alt="Dashboard" />
  <img src="docs/screenshots/live-feed.webp" width="49%" alt="Live Feed" />
</p>
<p align="center">
  <img src="docs/screenshots/create-monitor.webp" width="49%" alt="Create Monitor" />
  <img src="docs/screenshots/user-management.webp" width="49%" alt="Admin Panel" />
</p>
<p align="center">
  <img src="docs/screenshots/send-message.webp" width="49%" alt="Send Message Dialog" />
  <img src="docs/screenshots/send-offer.webp" width="49%" alt="Send Offer Dialog" />
</p>
<p align="center">
  <img src="docs/screenshots/account.webp" width="49%" alt="Account Page" />
  <img src="docs/screenshots/discord-embed.webp" width="49%" alt="Discord Alert" />
</p>

---

## Architecture

```
                         ┌──────────────────┐
                         │     Internet     │
                         └────────┬─────────┘
                                  │
                         ┌────────▼─────────┐
                         │      Caddy       │
                         │  (Auto HTTPS)    │
                         └────────┬─────────┘
                                  │
                    ┌─────────────▼──────────────┐
                    │      Control Center        │
                    │  Next.js 16 · React 19     │
                    │  Prisma · NextAuth · SSE   │
                    └──┬──────────┬──────────┬───┘
                       │          │          │
          ┌────────────▼──┐  ┌────▼────────┐ │
          │  PostgreSQL   │  │    Redis    │ │
          │   (Storage)   │  │(Cache+Dedup)│ │
          └────────────▲──┘  └──▲────────▲─┘ │
                       │        │        │   │
              ┌────────┴────────┴──┐  ┌──┴───▼──────────┐
              │     Go Worker      │  │ Vinted Service  │
              │ tls-client · proxy │  │ Account linking │
              │  rotation · scrape │  │ Likes · Offers  │
              └──────┬──────────┬──┘  └────────┬────────┘
                     │          │              │
            ┌────────▼──┐  ┌───▼───────┐  ┌───▼────────┐
            │ Vinted API │ │  Discord  │  │ Vinted API │
            │ (Proxied)  │ │(Webhooks) │  │  (Authed)  │
            └────────────  └───────────┘  └────────────┘
```

**Data flow:**

1. User creates a monitor via the dashboard
2. Go Worker detects the new monitor within 5s and starts a goroutine
3. Goroutine polls Vinted API through rotating proxies
4. New items are deduplicated via Redis, stored in PostgreSQL, published via SSE
5. Discord webhooks fire immediately for configured monitors
6. Users with a linked Vinted account can like items, send offers, and message sellers directly via the Vinted Service

---

## Tech Stack

| Layer              | Technology                                      | Purpose                        |
| ------------------ | ----------------------------------------------- | ------------------------------ |
| **Frontend**       | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui | Dashboard & UI                 |
| **Backend**        | Next.js Server Actions, API Routes              | API & auth                     |
| **Worker**         | Go 1.25, tls-client, goroutines                 | High-perf scraping             |
| **Vinted Service** | Go 1.25, TLS client, Redis sessions             | Account linking & item actions |
| **Database**       | PostgreSQL 15 + Prisma ORM                      | Persistent storage             |
| **Cache**          | Redis 7                                         | Deduplication & SSE pub/sub    |
| **Auth**           | NextAuth.js v5 (Discord OAuth2)                 | Authentication                 |
| **Proxy**          | tls-client with SOCKS4/5 & HTTP(S)              | Anti-detection                 |
| **Reverse Proxy**  | Caddy 2                                         | Auto HTTPS via Let's Encrypt   |
| **Deployment**     | Docker Compose                                  | One-command orchestration      |

---

## Getting Started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & Docker Compose v2
- [Discord Developer App](https://discord.com/developers/applications) (for OAuth2 login)
- Proxies (residential recommended)

### Proxy Recommendation (Referral)

If you need proxies, I currently recommend **Webshare Proxy Server** as the better option. Webshare also offers a small amount of free proxies, which can be enough for short initial tests.

- Referral link: https://www.webshare.io/?referral_code=qhu9q567qrqp
- You can check your proxies here to see whether they work with Vinted: https://proxy6.net/checker

### Quick Start

```bash
# 1. Clone
git clone https://github.com/JakobAIOdev/Vintrack-Vinted-Monitor
cd vintrack

# 2. Configure
cp .env.example .env
# Edit .env with your Discord OAuth credentials

# 3. Add proxies
nano apps/worker/proxies.txt
# One proxy per line: http://user:pass@host:port

# 4. Launch
docker compose up -d --build

# 5. Open dashboard
open http://localhost:3000
```

### Environment Variables

Create a `.env` file in the project root:

```env
# Required — generate with: openssl rand -base64 32
AUTH_SECRET=your-random-secret

# Required — from Discord Developer Portal
AUTH_DISCORD_ID=your-discord-client-id
AUTH_DISCORD_SECRET=your-discord-client-secret
```

### Proxy Formats

Vintrack accepts multiple proxy formats (one per line in `apps/worker/proxies.txt`):

```
http://user:pass@host:port
socks5://user:pass@host:port
host:port:user:pass
host:port
```

Invalid lines are automatically skipped with a warning in logs.

---

## Roadmap

- [x] Vinted Account Linking
- [x] Like / Unlike items
- [x] Send offers to sellers
- [x] Send messages to sellers
- [ ] One-click buy
- [ ] Auto-buy with price rules
- [ ] Auto Chat Module
- [ ] Price history tracking & charts
- [ ] Saved searches / favorites
- [ ] Rate limiting per user
- [ ] API tokens for external integrations
- [ ] Mobile app (React Native)

---

## Contributing

Contributions are welcome! Here's how:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please make sure to:

- Follow existing code style
- Test your changes with `docker compose up --build`
- Update documentation if needed

---

## Acknowledgements

- [vinted-dataset](https://github.com/teddy-vltn/vinted-dataset) by [@teddy-vltn](https://github.com/teddy-vltn) — Categories, brands, and sizes data used in the filter system

---

## License

This project is licensed under the [MIT License](LICENSE).

---

<p align="center">
  <sub>Built with ❤️ for the reselling community</sub><br/>
  <sub>If Vintrack helped you catch a deal, consider giving it a ⭐</sub>
</p>
