/**
 * Boots the app against a described backend and, after every spec, checks the hygiene no
 * spec should have to assert for itself: nothing is left running, and leaving every screen
 * gives back every import, export and live stream the app took.
 */

import { STATE_RELEASE_GRACE_MS } from "@prismatic-io/solis-core/internal";
import { waitFor } from "@testing-library/react";
import { afterEach, expect } from "vitest";
import { createAdapter } from "./adapters/current.js";
import type { Adapter } from "./adapters/types.js";
import { type Browser, installBrowser } from "./browser.js";
import {
  APP_ORIGIN,
  type Backend,
  type InstalledBackend,
  installBackend,
  type World,
} from "./world.js";

export type { Browser } from "./browser.js";
export type { Backend, World } from "./world.js";

interface Hygiene {
  imports: number;
  exports: number;
  streams: number;
}

interface Open {
  app: Adapter;
  installed: InstalledBackend;
  baseline: Hygiene;
  restoreBrowser: () => void;
}

let open: Open | null = null;

/**
 * Counts once every release has landed: the cache drops an unread entry on a timer, a
 * stream outlives its last observer by the grace window, and a cancelled stream is only
 * noticed on its next write, which the flush forces.
 */
const sampleHygiene = async (
  app: Adapter,
  installed: InstalledBackend,
): Promise<Hygiene> => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) =>
    setTimeout(resolve, STATE_RELEASE_GRACE_MS * 2),
  );
  await installed.frame.flushStreams();
  return { ...app.transport(), streams: installed.frame.openStreams() };
};

/**
 * Signs `user` in against a backend holding `world`. With `hostOpensUrls`, the host opens
 * consent screens itself, as a native shell that blocks popups does.
 */
export const openApp = async (
  world: World,
  {
    as = "alice",
    hostOpensUrls = false,
  }: { as?: string; hostOpensUrls?: boolean } = {},
): Promise<{ app: Adapter; backend: Backend; browser: Browser }> => {
  if (open) throw new Error("One app per spec.");
  const installed = await installBackend(world);
  const { browser, host, restore: restoreBrowser } = installBrowser();
  try {
    const app = await createAdapter({
      origin: APP_ORIGIN,
      token: `${as}:1`,
      ...(hostOpensUrls ? { host } : {}),
    });
    open = {
      app,
      installed,
      baseline: await sampleHygiene(app, installed),
      restoreBrowser,
    };
    return { app, backend: installed.backend, browser };
  } catch (error) {
    restoreBrowser();
    installed.restore();
    throw error;
  }
};

/** Retries an assertion until the app catches up with the backend. */
export const eventually = <T>(assertion: () => T | Promise<T>) =>
  waitFor(assertion, { timeout: 3000, interval: 5 });

afterEach(async () => {
  const current = open;
  if (!current) return;
  open = null;
  const { app, installed, baseline, restoreBrowser } = current;
  try {
    await waitFor(
      () =>
        expect(app.busyActions(), "actions still running at the end").toEqual(
          [],
        ),
      { timeout: 1000, interval: 5 },
    );
    await app.unmount();
    expect(
      await sampleHygiene(app, installed),
      "leaving every screen must release what the app acquired",
    ).toEqual(baseline);
  } finally {
    app.close();
    restoreBrowser();
    installed.restore();
  }
});
