import type { HostApi } from "@prismatic-io/solis-react";

/**
 * Lets one click both create an instance and open an OAuth consent screen.
 *
 * Browsers only let a click open a window, and only before the click handler's
 * first `await`. Solis's `createConnection` opens its consent window as it
 * starts, so normally you call it straight from the click. A new integration
 * has nothing to call it on yet: its connection requirements belong to an
 * instance, and creating the instance takes a round trip.
 *
 * So the click opens a blank window right away, with `openConsentWindow()`.
 * When the instance and its requirements have loaded, the app calls `use()` on
 * that window, then `createConnection`. Solis hands the consent URL to the
 * `openExternalUrl` capability below, which sends the blank window there.
 *
 * Pass `preopenedConsentHost` as the provider's `host`. It's module-level
 * because a new `host` identity restarts the Solis session.
 */

/** The window the next consent screen opens in. */
let pending: Window | null = null;

const PLACEHOLDER = "Connecting…";

export const preopenedConsentHost: HostApi = {
  openExternalUrl(url) {
    const popup = pending;
    pending = null;
    if (popup && !popup.closed) {
      popup.location.href = url;
      return true;
    }
    // Nothing was opened for this consent screen, so this is outside a click
    // and the browser may block it. Solis then reports the popup as blocked.
    return window.open(url, "_blank") !== null;
  },
};

export interface ConsentWindow {
  /** Send the next consent screen Solis opens to this window. */
  use: () => void;
  /** Close the window, whether or not it was used. */
  close: () => void;
}

/**
 * Opens a blank window for a consent screen. Call it synchronously in a click
 * handler. Returns `null` when the browser blocked the window.
 */
export function openConsentWindow(): ConsentWindow | null {
  const popup = window.open("about:blank", "_blank");
  if (!popup) return null;
  try {
    // The provider's page shouldn't be able to reach back into this app.
    popup.opener = null;
    popup.document.title = PLACEHOLDER;
    popup.document.body.textContent = PLACEHOLDER;
  } catch {
    // Some browsers hand back a window whose document isn't ours yet.
  }
  return {
    use: () => {
      pending = popup;
    },
    close: () => {
      if (pending === popup) pending = null;
      try {
        popup.close();
      } catch {
        // Already gone.
      }
    },
  };
}
