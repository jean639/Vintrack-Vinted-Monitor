const STORAGE_KEYS = {
  token: "browserLinkToken",
  appOrigin: "vintrackAppOrigin",
  lastSyncAt: "vintrackLastSyncAt",
  lastSyncStatus: "vintrackLastSyncStatus",
  lastSyncError: "vintrackLastSyncError",
  syncedDomains: "vintrackSyncedDomains",
  checkoutLinks: "vintrackCheckoutLinks",
  theme: "vintrackTheme",
};
const PERIODIC_SYNC_ALARM = "vintrackPeriodicSync";
const PERIODIC_SYNC_MINUTES = 30;
const BUY_TAB_READY_TIMEOUT_MS = 20000;

function sanitizeDomain(domain) {
  return (domain || "").replace(/^\./, "").trim().toLowerCase();
}

function isVintedDomain(domain) {
  const normalized = sanitizeDomain(domain);
  return (
    normalized === "vinted.co.uk" ||
    normalized.endsWith(".vinted.co.uk") ||
    /(^|\.)vinted\./.test(normalized)
  );
}

function domainFromUrl(value) {
  try {
    return sanitizeDomain(new URL(value).hostname);
  } catch {
    return "";
  }
}

function itemUrlForDomain(itemUrl, domain, itemId) {
  const normalizedDomain = sanitizeDomain(domain);
  if (!itemUrl) {
    return `https://${normalizedDomain}/items/${itemId}`;
  }

  try {
    const parsed = new URL(itemUrl);
    parsed.protocol = "https:";
    parsed.hostname = normalizedDomain;
    return parsed.toString();
  } catch {
    return `https://${normalizedDomain}/items/${itemId}`;
  }
}

async function getConfig() {
  return chrome.storage.local.get(Object.values(STORAGE_KEYS));
}

async function clearLocalExtensionState() {
  for (const timer of syncTimers.values()) {
    clearTimeout(timer);
  }
  syncTimers.clear();
  await chrome.storage.local.remove(Object.values(STORAGE_KEYS));
}

async function getStoredCheckoutLinks() {
  const storage = await chrome.storage.local.get(STORAGE_KEYS.checkoutLinks);
  return Array.isArray(storage[STORAGE_KEYS.checkoutLinks]) ? storage[STORAGE_KEYS.checkoutLinks] : [];
}

async function storeCheckoutLink(entry) {
  if (!entry?.checkoutUrl) {
    return;
  }

  const links = await getStoredCheckoutLinks();
  const normalizedEntry = {
    itemId: Number(entry.itemId || 0),
    sellerId: Number(entry.sellerId || 0),
    transactionId: Number(entry.transactionId || 0),
    purchaseId: String(entry.purchaseId || "").trim(),
    checkoutUrl: String(entry.checkoutUrl || "").trim(),
    domain: sanitizeDomain(entry.domain),
    createdAt: new Date().toISOString(),
  };

  const nextLinks = [
    normalizedEntry,
    ...links.filter((link) => {
      const sameTransaction =
        normalizedEntry.transactionId &&
        Number(link?.transactionId || 0) === normalizedEntry.transactionId;
      const samePurchase =
        normalizedEntry.purchaseId &&
        String(link?.purchaseId || "").trim() === normalizedEntry.purchaseId;
      const sameItemSeller =
        normalizedEntry.itemId &&
        normalizedEntry.sellerId &&
        Number(link?.itemId || 0) === normalizedEntry.itemId &&
        Number(link?.sellerId || 0) === normalizedEntry.sellerId &&
        sanitizeDomain(link?.domain || "") === normalizedEntry.domain;
      return !(sameTransaction || samePurchase || sameItemSeller);
    }),
  ].slice(0, 20);

  await chrome.storage.local.set({ [STORAGE_KEYS.checkoutLinks]: nextLinks });
}

async function findStoredCheckoutLink(match) {
  const links = await getStoredCheckoutLinks();
  const normalizedDomain = sanitizeDomain(match?.domain || "");
  const transactionId = Number(match?.transactionId || 0);
  const itemId = Number(match?.itemId || 0);
  const sellerId = Number(match?.sellerId || 0);

  return (
    links.find((link) => transactionId && Number(link?.transactionId || 0) === transactionId) ||
    links.find(
      (link) =>
        itemId &&
        sellerId &&
        Number(link?.itemId || 0) === itemId &&
        Number(link?.sellerId || 0) === sellerId &&
        sanitizeDomain(link?.domain || "") === normalizedDomain
    ) ||
    null
  );
}

async function findExistingCheckoutTab(domain) {
  const normalizedDomain = sanitizeDomain(domain);
  const matchingTabs = await chrome.tabs.query({ url: [`https://${normalizedDomain}/checkout*`] });
  const existingTab = matchingTabs
    .filter((tab) => typeof tab.id === "number" && typeof tab.url === "string")
    .sort((a, b) => (b.id || 0) - (a.id || 0))[0];
  return existingTab || null;
}

function ensurePeriodicSyncAlarm() {
  chrome.alarms.create(PERIODIC_SYNC_ALARM, {
    periodInMinutes: PERIODIC_SYNC_MINUTES,
  });
}

async function persistSyncState(results) {
  const successfulDomains = results
    .filter((result) => result.ok && result.domain)
    .map((result) => result.domain);
  const failedResult = results.find((result) => !result.ok);

  await chrome.storage.local.set({
    [STORAGE_KEYS.lastSyncAt]: new Date().toISOString(),
    [STORAGE_KEYS.lastSyncStatus]:
      successfulDomains.length > 0 ? "ok" : failedResult ? "error" : "idle",
    [STORAGE_KEYS.lastSyncError]:
      typeof failedResult?.error === "string"
        ? failedResult.error
        : typeof failedResult?.reason === "string"
          ? failedResult.reason
          : "",
    [STORAGE_KEYS.syncedDomains]: successfulDomains,
  });
}

function formatRuntimeState(storage) {
  const theme =
    storage.vintrackTheme === "dark" || storage.vintrackTheme === "light"
      ? storage.vintrackTheme
      : "system";

  return {
    installed: true,
    configured: Boolean(storage.browserLinkToken && storage.vintrackAppOrigin),
    theme,
    syncedDomains: Array.isArray(storage.vintrackSyncedDomains)
      ? storage.vintrackSyncedDomains
      : [],
    lastSyncAt: typeof storage.vintrackLastSyncAt === "string"
      ? storage.vintrackLastSyncAt
      : "",
    lastSyncStatus: typeof storage.vintrackLastSyncStatus === "string"
      ? storage.vintrackLastSyncStatus
      : "idle",
    lastSyncError: typeof storage.vintrackLastSyncError === "string"
      ? storage.vintrackLastSyncError
      : "",
  };
}

async function syncDomain(domain) {
  const normalizedDomain = sanitizeDomain(domain);
  if (!isVintedDomain(normalizedDomain)) {
    return { ok: false, reason: "unsupported-domain" };
  }

  const { browserLinkToken, vintrackAppOrigin } = await getConfig();
  if (!browserLinkToken || !vintrackAppOrigin) {
    return { ok: false, reason: "not-configured" };
  }

  const accessCookie = await chrome.cookies.get({
    url: `https://${normalizedDomain}/`,
    name: "access_token_web",
  });
  const refreshCookie = await chrome.cookies.get({
    url: `https://${normalizedDomain}/`,
    name: "refresh_token_web",
  });

  if (!accessCookie?.value) {
    return { ok: false, reason: "missing-access-token" };
  }

  const response = await fetch(
    `${vintrackAppOrigin}/api/account/extension-sync/complete`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        link_token: browserLinkToken,
        access_token: accessCookie.value,
        refresh_token: refreshCookie?.value || "",
        domain: normalizedDomain,
        user_agent: navigator.userAgent,
      }),
    }
  );

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      typeof data.error === "string" ? data.error : `Sync failed (${response.status})`
    );
  }

  return { ok: true, domain: normalizedDomain };
}

async function syncAllVintedDomains() {
  const cookies = await chrome.cookies.getAll({ name: "access_token_web" });
  const domains = [...new Set(cookies.map((cookie) => sanitizeDomain(cookie.domain)).filter(isVintedDomain))];
  const results = [];

  for (const domain of domains) {
    try {
      results.push(await syncDomain(domain));
    } catch (error) {
      results.push({
        ok: false,
        domain,
        error: error instanceof Error ? error.message : "unknown-error",
      });
    }
  }

  return results;
}

async function syncPreferredOrAllDomains(preferredDomain) {
  const normalizedPreferredDomain = sanitizeDomain(preferredDomain);
  if (normalizedPreferredDomain && isVintedDomain(normalizedPreferredDomain)) {
    try {
      return [await syncDomain(normalizedPreferredDomain)];
    } catch (error) {
      return [
        {
          ok: false,
          domain: normalizedPreferredDomain,
          error: error instanceof Error ? error.message : "unknown-error",
        },
      ];
    }
  }

  return syncAllVintedDomains();
}

async function syncAndPersistPreferredOrAllDomains(preferredDomain) {
  const results = await syncPreferredOrAllDomains(preferredDomain);
  await persistSyncState(results);
  return results;
}

async function syncAndPersistAllDomains() {
  const results = await syncAllVintedDomains();
  await persistSyncState(results);
  return results;
}

async function syncAndPersistDomain(domain) {
  let result;

  try {
    result = await syncDomain(domain);
  } catch (error) {
    result = {
      ok: false,
      domain: sanitizeDomain(domain),
      error: error instanceof Error ? error.message : "unknown-error",
    };
  }

  await persistSyncState([result]);
  if (!result.ok && result.error) {
    throw new Error(result.error);
  }

  return result;
}

function waitForTabLoad(tabId, timeoutMs = BUY_TAB_READY_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(handleUpdate);
      reject(new Error("Timed out waiting for Vinted tab to load"));
    }, timeoutMs);

    function handleUpdate(updatedTabId, changeInfo) {
      if (updatedTabId !== tabId || changeInfo.status !== "complete") {
        return;
      }

      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(handleUpdate);
      resolve();
    }

    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(handleUpdate);
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      if (tab?.status === "complete") {
        clearTimeout(timeout);
        resolve();
        return;
      }

      chrome.tabs.onUpdated.addListener(handleUpdate);
    });
  });
}

async function waitForTabBridge(tabId, timeoutMs = BUY_TAB_READY_TIMEOUT_MS) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, { type: "VINTRACK_TAB_PING" });
      if (response?.ok) {
        return;
      }
    } catch {
      // Wait for content script to attach to the tab.
    }

    await new Promise((resolve) => setTimeout(resolve, 350));
  }

  throw new Error("Vintrack extension bridge did not become ready on the Vinted tab");
}

async function ensureVintedBuyTab(targetUrl) {
  const target = new URL(targetUrl);
  const matchingTabs = await chrome.tabs.query({ url: [`https://${target.host}/*`] });
  const existingTab = matchingTabs.find((tab) => typeof tab.id === "number");

  if (existingTab?.id) {
    if (existingTab.url !== targetUrl) {
      await chrome.tabs.update(existingTab.id, { url: targetUrl, active: false });
      await waitForTabLoad(existingTab.id);
    }
    await waitForTabBridge(existingTab.id);
    return { tabId: existingTab.id, created: false };
  }

  const createdTab = await chrome.tabs.create({ url: targetUrl, active: false });
  if (typeof createdTab.id !== "number") {
    throw new Error("Failed to open Vinted tab for browser checkout");
  }

  await waitForTabLoad(createdTab.id);
  await waitForTabBridge(createdTab.id);
  return { tabId: createdTab.id, created: true };
}

async function handleBrowserBuy(payload) {
  const itemId = Number(payload?.itemId || 0);
  const sellerId = Number(payload?.sellerId || 0);
  const requestId = String(payload?.requestId || crypto.randomUUID());
  const itemUrl = String(payload?.itemUrl || "").trim();
  const preferredDomain = sanitizeDomain(String(payload?.domain || "").trim());
  const itemDomain = domainFromUrl(itemUrl);
  const normalizedDomain = sanitizeDomain(preferredDomain || itemDomain);

  if (!itemId || !sellerId) {
    return {
      ok: false,
      code: "invalid_buy_payload",
      error: "Missing item or seller information",
      requestId,
    };
  }

  if (!normalizedDomain || !isVintedDomain(normalizedDomain)) {
    return {
      ok: false,
      code: "invalid_domain",
      error: "A valid Vinted domain is required for browser checkout",
      requestId,
    };
  }

  async function runCheckoutOnDomain(domain) {
    const checkoutDomain = sanitizeDomain(domain);
    const targetUrl = itemUrlForDomain(itemUrl, checkoutDomain, itemId);
    const { tabId, created } = await ensureVintedBuyTab(targetUrl);
    const result = await chrome.tabs.sendMessage(tabId, {
      type: "VINTRACK_RUN_BROWSER_BUY",
      payload: {
        requestId,
        itemId,
        sellerId,
        domain: checkoutDomain,
        itemUrl: targetUrl,
        phoneNumber: String(payload?.phoneNumber || "").trim(),
        incogniaRequestToken: String(payload?.incogniaRequestToken || "").trim(),
        browserInfo: payload?.browserInfo || {},
        paymentMethod: payload?.paymentMethod || {},
        pickupType: Number(payload?.pickupType || 1),
      },
    });

    return { result, tabId, created, domain: checkoutDomain };
  }

  let attempt = await runCheckoutOnDomain(normalizedDomain);
  let result = attempt.result;
  let tabId = attempt.tabId;
  let created = attempt.created;
  let checkoutDomain = attempt.domain;

  const fallbackDomain =
    itemDomain && itemDomain !== checkoutDomain && isVintedDomain(itemDomain) ? itemDomain : "";
  if (
    fallbackDomain &&
    result &&
    !result.ok &&
    !["datadome_challenge", "payment_already_processing"].includes(result.code)
  ) {
    if (created) {
      await chrome.tabs.remove(tabId).catch(() => {});
    }
    attempt = await runCheckoutOnDomain(fallbackDomain);
    result = attempt.result;
    tabId = attempt.tabId;
    created = attempt.created;
    checkoutDomain = attempt.domain;
  }

  if (result?.ok) {
    if (result.checkoutUrl) {
      await storeCheckoutLink({
        itemId,
        sellerId,
        transactionId: result.transactionId,
        purchaseId: result.purchaseId,
        checkoutUrl: result.checkoutUrl,
        domain: checkoutDomain,
      });
    }

    const nextUrl = result.paymentUrl || result.checkoutUrl;
    if (nextUrl) {
      await chrome.tabs.create({ url: nextUrl, active: true });
      if (created) {
        await chrome.tabs.remove(tabId).catch(() => {});
      }
      return { ...result, openedPayment: true };
    }
  }

  if (result?.code === "payment_already_processing") {
    const existingCheckoutTab = await findExistingCheckoutTab(checkoutDomain);
    if (existingCheckoutTab?.id) {
      await chrome.tabs.update(existingCheckoutTab.id, { active: true });
      if (created) {
        await chrome.tabs.remove(tabId).catch(() => {});
      }
      return {
        ok: true,
        checkoutUrl: existingCheckoutTab.url,
        openedPayment: true,
        transactionId: result.transactionId,
      };
    }

    const storedCheckout = await findStoredCheckoutLink({
      itemId,
      sellerId,
      transactionId: result.transactionId,
      domain: checkoutDomain,
    });
    if (storedCheckout?.checkoutUrl) {
      await chrome.tabs.create({ url: storedCheckout.checkoutUrl, active: true });
      if (created) {
        await chrome.tabs.remove(tabId).catch(() => {});
      }
      return {
        ok: true,
        checkoutUrl: storedCheckout.checkoutUrl,
        openedPayment: true,
        transactionId: storedCheckout.transactionId,
        purchaseId: storedCheckout.purchaseId,
      };
    }
  }

  if (result?.code === "datadome_challenge") {
    if (result.captchaUrl) {
      await chrome.tabs.update(tabId, {
        active: true,
        url: result.captchaUrl,
      });
    } else {
      await chrome.tabs.update(tabId, {
        active: true,
      });
    }
  }

  return result || {
    ok: false,
    code: "empty_buy_result",
    error: "Browser checkout did not return a result",
    requestId,
  };
}

const syncTimers = new Map();

function scheduleSync(domain) {
  const normalizedDomain = sanitizeDomain(domain);
  if (!isVintedDomain(normalizedDomain)) {
    return;
  }

  const existingTimer = syncTimers.get(normalizedDomain);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timer = setTimeout(async () => {
    syncTimers.delete(normalizedDomain);
    try {
      await syncAndPersistDomain(normalizedDomain);
    } catch (error) {
      console.warn("[vintrack-extension] sync failed", normalizedDomain, error);
    }
  }, 800);

  syncTimers.set(normalizedDomain, timer);
}

chrome.cookies.onChanged.addListener(({ cookie }) => {
  if (!cookie || !["access_token_web", "refresh_token_web"].includes(cookie.name)) {
    return;
  }
  scheduleSync(cookie.domain);
});

chrome.runtime.onStartup.addListener(() => {
  ensurePeriodicSyncAlarm();
  void syncAndPersistAllDomains();
});

chrome.runtime.onInstalled.addListener(() => {
  ensurePeriodicSyncAlarm();
  void syncAndPersistAllDomains();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== PERIODIC_SYNC_ALARM) {
    return;
  }
  void syncAndPersistAllDomains();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message?.type === "VINTRACK_EXTENSION_PING") {
      const config = await getConfig();
      sendResponse({ ok: true, ...formatRuntimeState(config) });
      return;
    }

    if (message?.type === "VINTRACK_EXTENSION_CONNECT") {
      const token = String(message?.payload?.token || "").trim();
      const appOrigin = String(message?.payload?.appOrigin || "").trim();
      const preferredDomain = String(message?.payload?.preferredDomain || "").trim();
      if (!token || !appOrigin) {
        sendResponse({ ok: false, error: "Missing token or app origin" });
        return;
      }

      await chrome.storage.local.set({
        [STORAGE_KEYS.token]: token,
        [STORAGE_KEYS.appOrigin]: appOrigin,
      });
      ensurePeriodicSyncAlarm();

      const results = await syncAndPersistPreferredOrAllDomains(preferredDomain);
      const config = await getConfig();
      sendResponse({
        ok: true,
        ...formatRuntimeState(config),
        syncedDomains: results.filter((result) => result.ok).map((result) => result.domain),
        results,
      });
      return;
    }

    if (message?.type === "VINTRACK_EXTENSION_MANUAL_SYNC") {
      const preferredDomain = String(message?.payload?.preferredDomain || "").trim();
      const results = await syncAndPersistPreferredOrAllDomains(preferredDomain);
      const config = await getConfig();
      sendResponse({ ok: true, ...formatRuntimeState(config), results });
      return;
    }

    if (message?.type === "VINTRACK_EXTENSION_CLEAR_LOCAL_STATE") {
      await clearLocalExtensionState();
      const config = await getConfig();
      sendResponse({ ok: true, ...formatRuntimeState(config) });
      return;
    }

    if (message?.type === "VINTRACK_EXTENSION_SET_THEME") {
      const theme = String(message?.payload?.theme || "").trim();
      if (theme !== "dark" && theme !== "light") {
        sendResponse({ ok: false, error: "Unsupported theme" });
        return;
      }

      let senderOrigin = "";
      try {
        senderOrigin = sender?.url ? new URL(sender.url).origin : "";
      } catch {
        senderOrigin = "";
      }
      const config = await getConfig();
      if (!config.vintrackAppOrigin || senderOrigin !== config.vintrackAppOrigin) {
        sendResponse({ ok: false, ignored: true });
        return;
      }

      await chrome.storage.local.set({ [STORAGE_KEYS.theme]: theme });
      sendResponse({ ok: true, theme });
      return;
    }

    if (message?.type === "VINTRACK_EXTENSION_BUY") {
      const result = await handleBrowserBuy(message.payload);
      sendResponse(result);
      return;
    }

    sendResponse({ ok: false, error: "Unsupported message" });
  })().catch((error) => {
    sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  });

  return true;
});
