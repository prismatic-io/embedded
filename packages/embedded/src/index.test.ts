import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

// ESM entry point verified against dist/index.mjs. tsconfig.test.json uses
// moduleResolution=bundler so the `.mjs` extension resolves to `.d.mts`
// at type-check time while vitest reads the runtime file directly.
import prismatic, { init as namedInit } from "../dist/index.mjs";

const cjsPath = resolve(__dirname, "../dist/index.cjs");
const umdPath = resolve(__dirname, "../dist/index.umd.js");

describe("@prismatic-io/embedded public API", () => {
  it("supports ESM default + named imports", () => {
    expect(typeof prismatic.init).toBe("function");
    expect(typeof namedInit).toBe("function");
  });

  it("supports CommonJS require", () => {
    const require = createRequire(import.meta.url);
    const mod = require(cjsPath) as {
      init: unknown;
      default: { init: unknown };
    };
    expect(typeof mod.init).toBe("function");
    expect(typeof mod.default.init).toBe("function");
  });

  it("supports UMD <script> tag (attaches window.prismatic)", async () => {
    const dom = new JSDOM("", { runScripts: "dangerously" });
    dom.window.eval(await readFile(umdPath, "utf8"));
    const windowPrismatic = (
      dom.window as unknown as {
        prismatic: { init: unknown };
      }
    ).prismatic;
    expect(typeof windowPrismatic.init).toBe("function");
  });
});
