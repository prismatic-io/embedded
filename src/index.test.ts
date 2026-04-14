import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

import prismatic, { init as namedInit } from "../dist/index.js";

const distPath = resolve(__dirname, "../dist/index.js");

describe("@prismatic-io/embedded public API", () => {
  it("supports ESM default + named imports", () => {
    expect(typeof prismatic.init).toBe("function");
    expect(typeof namedInit).toBe("function");
  });

  it("supports CommonJS require", () => {
    const require = createRequire(import.meta.url);
    const mod = require(distPath) as {
      init: unknown;
      default: { init: unknown };
    };
    expect(typeof mod.init).toBe("function");
    expect(typeof mod.default.init).toBe("function");
  });

  it("supports UMD <script> tag (attaches window.prismatic)", async () => {
    const dom = new JSDOM("", { runScripts: "dangerously" });
    dom.window.eval(await readFile(distPath, "utf8"));
    const windowPrismatic = (
      dom.window as unknown as {
        prismatic: { init: unknown };
      }
    ).prismatic;
    expect(typeof windowPrismatic.init).toBe("function");
  });
});
