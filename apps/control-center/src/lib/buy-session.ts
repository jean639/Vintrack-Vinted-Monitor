"use client";

let warmPromise: Promise<void> | null = null;
let lastWarmedAt = 0;

const WARM_TTL_MS = 5 * 60 * 1000;

export function warmBuySession(force = false) {
    const now = Date.now();
    if (!force && lastWarmedAt > 0 && now - lastWarmedAt < WARM_TTL_MS) {
        return Promise.resolve();
    }
    if (!force && warmPromise) {
        return warmPromise;
    }

    warmPromise = fetch("/api/items/buy/warm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
    })
        .then(() => {
            lastWarmedAt = Date.now();
        })
        .catch(() => {})
        .finally(() => {
            warmPromise = null;
        });

    return warmPromise;
}
