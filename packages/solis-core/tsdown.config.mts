import { defineConfig } from "tsdown";

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
