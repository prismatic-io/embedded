import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import corePkg from "../solis-core/package.json" with { type: "json" };

const coreSource = (path: string) =>
  fileURLToPath(new URL(`../solis-core/src/${path}`, import.meta.url));

export default defineConfig({
  define: {
    __SOLIS_CORE_PACKAGE_NAME__: JSON.stringify(corePkg.name),
    __SOLIS_CORE_PACKAGE_VERSION__: JSON.stringify(corePkg.version),
  },
  resolve: {
    alias: [
      {
        find: /^@prismatic-io\/solis-core$/,
        replacement: coreSource("index.ts"),
      },
      {
        find: /^@prismatic-io\/solis-core\/protocol$/,
        replacement: coreSource("protocol/index.ts"),
      },
      {
        find: /^@prismatic-io\/solis-core\/testing$/,
        replacement: coreSource("testing/index.ts"),
      },
      {
        find: /^@prismatic-io\/solis-core\/internal$/,
        replacement: coreSource("internal.ts"),
      },
    ],
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.spec.{ts,tsx}"],
    exclude: ["dist/**", "node_modules/**"],
  },
});
