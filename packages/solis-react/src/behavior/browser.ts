/**
 * The browser around the app, as a behavior spec sees it: the windows the app opens for the
 * user to consent in, a popup blocker, and a host that opens URLs itself. Specs drive the
 * user's side through it; the app never sees it.
 */

import { vi } from "vitest";

export interface ConsentWindowView {
  url: string;
  closed: boolean;
}

export interface Browser {
  /** The browser refuses every new window, as a popup blocker does outside a click. */
  blockPopups: () => void;
  /**
   * The app's attempts to close a consent window do nothing, as when the provider's opener
   * policy severs the app's handle on it. Real browsers differ here, so a spec that cares
   * asserts what the user sees rather than whether the window closed.
   */
  ignoreCloses: () => void;
  /** Windows the app opened for the user to consent in, oldest first. */
  consentWindows: () => ConsentWindowView[];
  /** The user closes the newest consent window. */
  closeConsentWindow: () => void;
  /** URLs a host that opens them itself was asked to open. */
  openedByHost: () => string[];
}

interface FakeWindow {
  closed: boolean;
  opener: unknown;
  document: { title: string; body: { textContent: string } };
  location: { href: string };
  close: () => void;
}

export const installBrowser = () => {
  const windows: FakeWindow[] = [];
  const opened: string[] = [];
  let blocked = false;
  let closesIgnored = false;
  const open = vi.spyOn(window, "open").mockImplementation(() => {
    if (blocked) return null;
    const created: FakeWindow = {
      closed: false,
      opener: window,
      document: { title: "", body: { textContent: "" } },
      location: { href: "about:blank" },
      close: () => {
        if (!closesIgnored) created.closed = true;
      },
    };
    windows.push(created);
    return created as unknown as Window;
  });
  const browser: Browser = {
    blockPopups: () => {
      blocked = true;
    },
    ignoreCloses: () => {
      closesIgnored = true;
    },
    consentWindows: () =>
      windows.map(({ location, closed }) => ({ url: location.href, closed })),
    closeConsentWindow: () => {
      const newest = windows.at(-1);
      if (!newest) throw new Error("No consent window is open.");
      newest.closed = true;
    },
    openedByHost: () => [...opened],
  };
  return {
    browser,
    host: {
      openExternalUrl: (url: string) => {
        opened.push(url);
        return true;
      },
    },
    restore: () => open.mockRestore(),
  };
};
