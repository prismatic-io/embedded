import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { build } from "esbuild";
import { expect, test } from "./fixtures.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(here, "fixtures");

const bundleFixture = async (
  entry: string,
  mode: "esm" | "cjs",
): Promise<string> => {
  const result = await build({
    entryPoints: [resolve(fixturesDir, entry)],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    target: "es2022",
    conditions: mode === "esm" ? ["import", "browser"] : ["require", "browser"],
    mainFields: mode === "esm" ? ["module", "main"] : ["main"],
    sourcemap: "inline",
    logLevel: "warning",
  });
  return result.outputFiles[0].text;
};

const captureErrors = (page: Page): string[] => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  return errors;
};

const assertMarketplaceRendered = async (page: Page): Promise<void> => {
  const iframe = page.locator("#pio__iframe");
  await expect(iframe).toHaveCount(1, { timeout: 5_000 });
  await expect(iframe).toHaveAttribute("src", /\/integration-marketplace\//);
  await expect(page.locator(".pio__overlay--is_visible")).toBeVisible();
};

test.beforeEach(async ({ page, stub }) => {
  await page.goto(stub.url);
});

test("ESM bundle: init → authenticate → showMarketplace renders iframe", async ({
  page,
}) => {
  const errors = captureErrors(page);
  const bundle = await bundleFixture("esm-entry.ts", "esm");
  await page.addScriptTag({ content: bundle });
  await assertMarketplaceRendered(page);
  expect(errors, "no console errors during SDK bootstrap").toEqual([]);
});

test("CJS bundle: init → authenticate → showMarketplace renders iframe", async ({
  page,
}) => {
  const errors = captureErrors(page);
  const bundle = await bundleFixture("cjs-entry.cts", "cjs");
  await page.addScriptTag({ content: bundle });
  await assertMarketplaceRendered(page);
  expect(errors, "no console errors during SDK bootstrap").toEqual([]);
});

test("UMD bundle: init → authenticate → showMarketplace renders iframe", async ({
  page,
}) => {
  const errors = captureErrors(page);
  await page.addScriptTag({ url: "/dist/index.umd.js" });
  await page.evaluate(async () => {
    window.prismatic.init({
      prismaticUrl: window.location.origin,
      skipPreload: true,
    });
    await window.prismatic.authenticate({ token: "fake-jwt" });
    window.prismatic.showMarketplace({ usePopover: true });
  });
  await assertMarketplaceRendered(page);
  expect(errors, "no console errors during SDK bootstrap").toEqual([]);
});
