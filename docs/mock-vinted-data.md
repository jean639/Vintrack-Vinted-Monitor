# Mock Vinted Data

Use the worker mock mode when you want frontend/live-feed test data without calling Vinted or using proxies.

For the Docker stack, run the mock override instead of starting a second local worker:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev-mock.yml up -d --build
```

Or, if the stack is already running:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev-mock.yml up -d --build worker
```

Check that the container is in mock mode:

```bash
docker logs -f vintrack_worker
```

You should see:

```text
Catalog fetch mode: mock:new-items
```

For a local non-Docker worker, use:

```bash
cd apps/worker
sh scripts/dev-mock.sh
```

Defaults:

```bash
VINTED_FETCH_MODE=mock
VINTED_MOCK_SCENARIO=new-items
VINTED_MOCK_DROP_INTERVAL_MS=3000
```

The `new-items` scenario seeds the monitor once, then generates a fresh item every `VINTED_MOCK_DROP_INTERVAL_MS`. Generated item IDs are based on the current time, so restarting the worker still creates new items that are not already marked as seen.

Available scenarios:

- `new-items`: continuous dev stream for dashboard/live-feed testing.
- `empty`: always returns no items.
- `initial-seed`: returns only the initial fixture.
- `anti-keywords`: returns items for anti-keyword checks.
- `rate-limited`: returns a 429 first, then normal fixture data.

Mock item images live in:

```text
apps/control-center/public/mock-images/
```

The worker stores image paths like `/mock-images/vinted-1.svg`, which the dashboard can render directly from the control-center public folder.
