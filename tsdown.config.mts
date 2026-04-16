import type { LogHandler, LogLevel, RolldownLog } from "rolldown";
import { defineConfig } from "tsdown";
import pkg from "./package.json" with { type: "json" };

const define = {
  EMBEDDED_VERSION: JSON.stringify(pkg.version),
};

// MIXED_EXPORTS fires because src/index.ts intentionally exposes both named
// exports and a default namespace. CJS consumers reach the namespace via
// `require(...).default`, which is the shape our tests assert (see
// src/index.test.ts). Filter the warning so the build output stays quiet.
const onLog = (
  level: LogLevel,
  log: RolldownLog,
  defaultHandler: LogHandler,
) => {
  if (log.code === "MIXED_EXPORTS") return;
  defaultHandler(level, log);
};

// @prismatic-io/translations is a type-only import; it's erased at bundle
// time so it doesn't belong in the runtime bundle list.
const bundledDeps = ["lodash.merge", "url-join"];

const common = {
  entry: ["src/index.ts"] as const,
  clean: false,
  minify: true,
  sourcemap: true,
  define,
  inputOptions: { onLog },
};

export default defineConfig([
  {
    ...common,
    format: "esm",
    dts: true,
    clean: true,
  },
  {
    ...common,
    format: "cjs",
    dts: true,
  },
  {
    ...common,
    format: "umd",
    globalName: "prismatic",
    platform: "browser",
    deps: {
      alwaysBundle: bundledDeps,
      onlyBundle: bundledDeps,
    },
  },
]);
