import { fileURLToPath } from "node:url";
import { defineConfig } from "tsdown";

// solis-core publishes no ./internal subpath; its internals are bundled in here instead.
const coreInternal = "@prismatic-io/solis-core/internal";

// Keyed entries name the output files, so each subpath in package.json
// exports lands at dist/<name>.{mjs,cjs,d.mts,d.cts}.
const common = {
  entry: {
    index: "src/index.ts",
  },
  clean: false,
  minify: { compress: true, mangle: true, codegen: false },
  sourcemap: true,
  alias: {
    [coreInternal]: fileURLToPath(
      new URL("../solis-core/src/internal.ts", import.meta.url),
    ),
  },
  deps: { alwaysBundle: [coreInternal] },
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
