import { defineConfig } from "tsdown";
import pkg from "./package.json" with { type: "json" };

// Keyed entries name the output files, so each subpath in package.json
// exports lands at dist/<name>.{mjs,cjs,d.mts,d.cts}.
const common = {
  entry: {
    index: "src/index.ts",
    protocol: "src/protocol/index.ts",
    testing: "src/testing/index.ts",
  },
  clean: false,
  minify: true,
  sourcemap: true,
  // The handshake reports the installed package to the frame.
  define: {
    __SOLIS_CORE_PACKAGE_NAME__: JSON.stringify(pkg.name),
    __SOLIS_CORE_PACKAGE_VERSION__: JSON.stringify(pkg.version),
  },
} as const;

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
]);
