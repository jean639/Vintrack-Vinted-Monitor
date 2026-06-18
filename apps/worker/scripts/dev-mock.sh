#!/usr/bin/env sh
set -eu

export VINTED_FETCH_MODE="${VINTED_FETCH_MODE:-mock}"
export VINTED_MOCK_SCENARIO="${VINTED_MOCK_SCENARIO:-new-items}"
export VINTED_MOCK_DROP_INTERVAL_MS="${VINTED_MOCK_DROP_INTERVAL_MS:-3000}"

echo "Starting Vintrack worker with mock Vinted data"
echo "Scenario: ${VINTED_MOCK_SCENARIO}"
echo "Drop interval: ${VINTED_MOCK_DROP_INTERVAL_MS}ms"

go run ./cmd
