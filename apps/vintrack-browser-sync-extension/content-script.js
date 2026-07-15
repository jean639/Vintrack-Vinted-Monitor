(function () {
  function isVintedHost(hostname) {
    return (
      hostname === "vinted.co.uk" ||
      hostname.endsWith(".vinted.co.uk") ||
      /(^|\.)vinted\./.test(hostname)
    );
  }

  function post(type, payload) {
    window.postMessage({ type, payload }, window.location.origin);
  }

  function ensurePageBridge() {
    if (!isVintedHost(window.location.hostname)) {
      return;
    }

    if (document.documentElement.dataset.vintrackPageBridge === "ready") {
      return;
    }

    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("page-bridge.js");
    script.async = false;
    script.dataset.vintrackPageBridge = "true";
    script.onload = () => {
      document.documentElement.dataset.vintrackPageBridge = "ready";
      script.remove();
    };

    (document.head || document.documentElement).appendChild(script);
  }

  function resolveVintrackTheme() {
    const classes = document.documentElement.classList;
    if (classes.contains("dark")) {
      return "dark";
    }
    if (classes.contains("light")) {
      return "light";
    }
    const darkPreference = window.matchMedia?.("(prefers-color-scheme: dark)");
    return darkPreference?.matches ? "dark" : "light";
  }

  function syncVintrackTheme() {
    if (isVintedHost(window.location.hostname)) {
      return;
    }

    chrome.runtime.sendMessage(
      {
        type: "VINTRACK_EXTENSION_SET_THEME",
        payload: {
          theme: resolveVintrackTheme(),
        },
      },
      () => {
        // The background script ignores non-Vintrack origins.
        void chrome.runtime.lastError;
      },
    );
  }

  function watchVintrackTheme() {
    if (isVintedHost(window.location.hostname)) {
      return;
    }

    if (document.documentElement.dataset.vintrackThemeBridge === "ready") {
      return;
    }
    document.documentElement.dataset.vintrackThemeBridge = "ready";

    const syncSoon = () => window.setTimeout(syncVintrackTheme, 0);
    syncSoon();

    document.addEventListener("DOMContentLoaded", syncSoon, { once: true });
    new MutationObserver(syncSoon).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    const darkPreference = window.matchMedia?.("(prefers-color-scheme: dark)");
    darkPreference?.addEventListener?.("change", syncSoon);
  }

  function waitForPageBridgeReady(timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      if (document.documentElement.dataset.vintrackPageBridge === "ready") {
        resolve();
        return;
      }

      const timeout = window.setTimeout(() => {
        window.removeEventListener("message", handleReady);
        reject(new Error("Vinted page bridge did not become ready"));
      }, timeoutMs);

      function handleReady(event) {
        if (
          event.source !== window ||
          event.data?.type !== "VINTRACK_PAGE_BRIDGE_READY"
        ) {
          return;
        }

        window.clearTimeout(timeout);
        window.removeEventListener("message", handleReady);
        document.documentElement.dataset.vintrackPageBridge = "ready";
        resolve();
      }

      window.addEventListener("message", handleReady);
    });
  }

  function requestPageBuy(payload) {
    return new Promise((resolve) => {
      const requestId = payload?.requestId || crypto.randomUUID();
      const timeout = window.setTimeout(() => {
        window.removeEventListener("message", handleResponse);
        resolve({
          ok: false,
          code: "page_bridge_timeout",
          error: "Vinted page bridge did not answer in time",
          requestId,
        });
      }, 30000);

      function handleResponse(event) {
        if (
          event.source !== window ||
          event.data?.type !== "VINTRACK_PAGE_BUY_RESPONSE" ||
          event.data.payload?.requestId !== requestId
        ) {
          return;
        }

        window.clearTimeout(timeout);
        window.removeEventListener("message", handleResponse);
        resolve(event.data.payload);
      }

      window.addEventListener("message", handleResponse);
      window.postMessage(
        {
          type: "VINTRACK_PAGE_BUY_REQUEST",
          payload: { ...payload, requestId },
        },
        window.location.origin,
      );
    });
  }

  function requestPageSessionRefresh(payload = {}) {
    return new Promise((resolve) => {
      const requestId = payload?.requestId || crypto.randomUUID();
      const timeout = window.setTimeout(() => {
        window.removeEventListener("message", handleResponse);
        resolve({
          ok: false,
          code: "page_bridge_timeout",
          error: "Vinted page bridge did not answer in time",
          requestId,
        });
      }, 30000);

      function handleResponse(event) {
        if (
          event.source !== window ||
          event.data?.type !== "VINTRACK_PAGE_SESSION_REFRESH_RESPONSE" ||
          event.data.payload?.requestId !== requestId
        ) {
          return;
        }

        window.clearTimeout(timeout);
        window.removeEventListener("message", handleResponse);
        resolve(event.data.payload);
      }

      window.addEventListener("message", handleResponse);
      window.postMessage(
        {
          type: "VINTRACK_PAGE_SESSION_REFRESH_REQUEST",
          payload: { ...payload, requestId },
        },
        window.location.origin,
      );
    });
  }

  ensurePageBridge();
  watchVintrackTheme();

  chrome.runtime.sendMessage(
    { type: "VINTRACK_EXTENSION_PING" },
    (response) => {
      if (chrome.runtime.lastError) {
        return;
      }
      post("VINTRACK_EXTENSION_READY", response || { installed: true });
    },
  );

  window.addEventListener("message", (event) => {
    if (event.source !== window || !event.data?.type) {
      return;
    }

    if (event.data.type === "VINTRACK_EXTENSION_PING") {
      chrome.runtime.sendMessage(
        { type: "VINTRACK_EXTENSION_PING" },
        (response) => {
          if (chrome.runtime.lastError) {
            return;
          }
          post("VINTRACK_EXTENSION_READY", response || { installed: true });
        },
      );
      return;
    }

    if (event.data.type === "VINTRACK_EXTENSION_CONNECT") {
      chrome.runtime.sendMessage(
        {
          type: "VINTRACK_EXTENSION_CONNECT",
          payload: event.data.payload,
        },
        (response) => {
          const runtimeError = chrome.runtime.lastError;
          post(
            "VINTRACK_EXTENSION_CONNECT_RESULT",
            runtimeError
              ? {
                  ok: false,
                  error: runtimeError.message || "Extension connection failed",
                }
              : response || {
                  ok: false,
                  error: "Extension connection returned no result",
                },
          );
          syncVintrackTheme();
        },
      );
      return;
    }

    if (event.data.type === "VINTRACK_EXTENSION_MANUAL_SYNC") {
      chrome.runtime.sendMessage(
        {
          type: "VINTRACK_EXTENSION_MANUAL_SYNC",
          payload: event.data.payload,
        },
        (response) => {
          const runtimeError = chrome.runtime.lastError;
          post(
            "VINTRACK_EXTENSION_MANUAL_SYNC_RESULT",
            runtimeError
              ? {
                  ok: false,
                  error: runtimeError.message || "Extension sync failed",
                }
              : response || {
                  ok: false,
                  error: "Extension sync returned no result",
                },
          );
        },
      );
      return;
    }

    if (event.data.type === "VINTRACK_EXTENSION_BUY") {
      chrome.runtime.sendMessage(
        {
          type: "VINTRACK_EXTENSION_BUY",
          payload: event.data.payload,
        },
        (response) => {
          post("VINTRACK_EXTENSION_BUY_RESULT", response || { ok: false });
        },
      );
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "VINTRACK_TAB_PING") {
      sendResponse({
        ok: true,
        isVintedPage: isVintedHost(window.location.hostname),
      });
      return false;
    }

    if (message?.type === "VINTRACK_RUN_BROWSER_BUY") {
      ensurePageBridge();
      waitForPageBridgeReady()
        .then(() => requestPageBuy(message.payload))
        .then((response) => sendResponse(response))
        .catch((error) =>
          sendResponse({
            ok: false,
            code: "page_bridge_error",
            error:
              error instanceof Error
                ? error.message
                : "Unknown page bridge error",
            requestId: message.payload?.requestId,
          }),
        );
      return true;
    }

    if (message?.type === "VINTRACK_REFRESH_BROWSER_SESSION") {
      ensurePageBridge();
      waitForPageBridgeReady()
        .then(() => requestPageSessionRefresh(message.payload))
        .then((response) => sendResponse(response))
        .catch((error) =>
          sendResponse({
            ok: false,
            code: "page_bridge_error",
            error:
              error instanceof Error
                ? error.message
                : "Unknown page bridge error",
            requestId: message.payload?.requestId,
          }),
        );
      return true;
    }

    return false;
  });
})();
