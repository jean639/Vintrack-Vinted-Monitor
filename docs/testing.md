# Testing

Use the root runner for normal local validation:

```bash
sh scripts/test-all.sh
```

This runs:

- `go test ./...` in `apps/worker`
- `go test ./...` in `apps/vinted-service`
- `go test ./...` in `apps/id-scanner`
- `npm run lint` in `apps/control-center`
- `npm run build` in `apps/control-center`
- public Playwright e2e tests in `apps/control-center`

For faster frontend iteration without the production build:

```bash
sh scripts/test-all.sh --skip-build
```

To include the seeded dashboard/feed e2e test:

```bash
sh scripts/test-all.sh --dashboard
```

The dashboard mode automatically starts the required local services:

```bash
docker compose up -d postgres redis control-center-migrate
```

Use this only if you already started services yourself and do not want the runner to touch Docker:

```bash
sh scripts/test-all.sh --dashboard --no-start-services
```

## Individual Commands

Worker and service tests:

```bash
cd apps/worker && go test ./...
cd apps/vinted-service && go test ./...
cd apps/id-scanner && go test ./...
```

Control Center checks:

```bash
cd apps/control-center
npm run lint
npm run build
npm run test:e2e
```

Dashboard/feed e2e:

```bash
cd apps/control-center
npm run test:e2e:dashboard
```

Playwright UI/headed modes:

```bash
cd apps/control-center
npm run test:e2e:headed
npm run test:e2e:ui
```

## CI

GitHub Actions runs the same important checks on pull requests and pushes to `main`:

- Control Center:
  - `npm ci`
  - `npx prisma generate`
  - `npx prisma migrate deploy` against a Postgres service
  - `npm run lint`
  - `npm run build`
  - `npm run test:e2e`
  - `npm run test:e2e:dashboard`
- Go apps:
  - `go test ./...` in `apps/worker`
  - `go test ./...` in `apps/vinted-service`
  - `go test ./...` in `apps/id-scanner`

CI installs bundled Playwright Chromium with:

```bash
npx playwright install --with-deps chromium
```

Local runs use system Chrome by default. CI sets `PLAYWRIGHT_CHANNEL=bundled`.

## Current Coverage

Backend:

- Worker scraper/model/proxy/unit coverage via `go test ./...`.
- Vinted service API/session/client coverage via `go test ./...`.
- ID scanner compile/package coverage via `go test ./...`.

Frontend:

- Public landing page renders on desktop and mobile.
- Login page renders on desktop and mobile.
- Protected dashboard routes redirect unauthenticated users.
- Protected feed API returns `401` without auth.
- Mock Vinted image assets are served from `public/mock-images`.
- Seeded dashboard overview renders monitor summary and monitor card state.
- Seeded feed APIs return monitor summary and item metadata.
- Seeded `/feed` dashboard page renders listing metadata on desktop and mobile:
  title, brand, size, location, rating, price, total price, monitor name, and image.
- Item image preview opens and closes from an item card.

## Mock UI Development

For mock-worker UI development without real Vinted requests:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev-mock.yml up -d --build
```

See [mock-vinted-data.md](./mock-vinted-data.md) for mock worker scenarios and options.
