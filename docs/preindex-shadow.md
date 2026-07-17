# Pre-index shadow scanner

The pre-index scanner is a bounded experiment for measuring whether Vinted item pages become reachable before the same items appear in catalog feeds. It is deliberately isolated from monitor alerts and from the latency-sensitive monitor process.

## What was observed

The endpoint check on 2026-07-16 found Cloudflare on the public site and the existing project already handles DataDome-protected catalog traffic. Anonymous catalog and item JSON requests returned `403`, while a bare page request shaped as `/items/{id}` behaved differently:

- an existing item returned a redirect to `/items/{id}-{slug}`;
- an unknown future ID returned `404`;
- adjacent IDs advanced quickly enough that exhaustive sequential probing would require an unacceptable request rate.

For that reason the implementation accepts only a redirect containing the exact probed ID as proof. A `200` HTML response is treated as unexpected because it may be an intermediary challenge page.

## Safety boundary

The scanner runs as `WORKER_ROLE=id-scanner` and:

- defaults to disabled and requires `ID_SCANNER_ENABLED=true`;
- uses only the shared healthy free-proxy pool in its own process and client pool;
- skips the first 32 ranked free proxies by default so canonical and hybrid traffic keep the highest-ranked exits;
- enforces at least 500 ms between probes, with a 500 ms default plus jitter;
- samples one deterministically varied ID per 100-ID block instead of using a fixed `00` suffix or enumerating all IDs;
- exponentially backs off up to 60 seconds on blocking;
- stores redirect timing and probe health only;
- never claims an item, fetches item JSON, enriches sellers, or queues an alert.

The current limit is intentionally conservative. Do not use this role for exhaustive ID enumeration.

## How the comparison works

On a verified redirect, the scanner stores `(region, item_id, first_seen_at)`. The normal hybrid/canonical pipeline continues unchanged. When the exact sampled ID later appears in a monitor during the experiment window, the stored telemetry can be evaluated internally for:

- **Pre-index coverage:** sampled IDs that also reached this monitor;
- **Pre-index wins:** matching samples seen before either catalog path;
- **Avg pre-index lead:** elapsed time from verified redirect to first catalog detection;
- **Probe health:** hit, miss, blocked, issue, and latency counts for the latest 500 regional probes.

Pre-index evidence is accumulated from the regional experiment start for up to 14 days. It is intentionally not shown in the end-user monitor-health dialog. Use it only for internal rollout decisions, and collect at least 25 matched IDs before evaluating the Phase 3 thresholds: 60% wins, 5 seconds median lead, and 98% canonical success.

With the default 100-ID stride, coverage is expected to be sparse. A handful of matches is not enough to activate alerts; collect the evidence target and compare the lead distribution first.

## Runtime controls

| Variable                         | Default | Purpose                                                        |
| -------------------------------- | ------: | -------------------------------------------------------------- |
| `ID_SCANNER_ENABLED`             | `false` | Enables the isolated shadow sampler.                           |
| `ID_SCANNER_REGION`              |    `de` | Vinted region/domain to sample.                                |
| `ID_SCANNER_STRIDE`              |   `100` | Distance between sampled item IDs.                             |
| `ID_SCANNER_INTERVAL_MS`         |   `500` | Base delay between probes; values below 500 are clamped.       |
| `ID_SCANNER_JITTER_MS`           |   `200` | Random delay added to each cycle.                              |
| `ID_SCANNER_TIMEOUT_MS`          |  `2000` | Per-probe deadline.                                            |
| `ID_SCANNER_POOL_SIZE`           |    `16` | Isolated free-proxy client sessions.                           |
| `ID_SCANNER_PROXY_OFFSET`        |    `32` | Leaves the first ranked proxies to production monitor traffic. |
| `ID_SCANNER_STUCK_SKIP_AFTER`    |    `10` | Non-hit attempts before skipping a sampled ID.                 |
| `ID_SCANNER_MAX_AHEAD`           | `10000` | Pauses when the target is too far above the latest catalog ID. |
| `PREINDEX_PROBE_RETENTION_HOURS` |    `48` | Raw probe-health retention.                                    |
| `PREINDEX_SAMPLE_RETENTION_DAYS` |    `14` | Verified redirect-sample retention.                            |

Start and inspect it with:

```sh
docker compose --profile preindex up -d --build id-scanner
docker compose logs --tail=100 id-scanner
```

The scanner can be stopped independently without affecting canonical or hybrid monitoring.
