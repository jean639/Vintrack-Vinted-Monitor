export type BrowserBuyPayload = {
  itemId: number;
  sellerId: number;
  itemUrl?: string;
  domain?: string;
  pickupType?: number;
  phoneNumber?: string;
  incogniaRequestToken?: string;
};

export type BrowserBuyResult =
  | {
      ok: true;
      paymentUrl?: string;
      checkoutUrl?: string;
      openedPayment?: boolean;
      purchaseId?: string;
      transactionId?: number;
    }
  | {
      ok: false;
      code?: string;
      error?: string;
      captchaUrl?: string;
    };

export async function runBrowserBuyViaExtension(
  payload: BrowserBuyPayload,
  timeoutMs = 30000
): Promise<BrowserBuyResult | null> {
  if (typeof window === "undefined") {
    return null;
  }

  const requestId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `vintrack-buy-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener("message", handleResponse);
      resolve(null);
    }, timeoutMs);

    function handleResponse(event: MessageEvent) {
      if (
        event.source !== window ||
        event.data?.type !== "VINTRACK_EXTENSION_BUY_RESULT" ||
        event.data.payload?.requestId !== requestId
      ) {
        return;
      }

      window.clearTimeout(timeout);
      window.removeEventListener("message", handleResponse);
      resolve(event.data.payload as BrowserBuyResult);
    }

    window.addEventListener("message", handleResponse);
    window.postMessage(
      {
        type: "VINTRACK_EXTENSION_BUY",
        payload: {
          ...payload,
          requestId,
        },
      },
      window.location.origin
    );
  });
}
