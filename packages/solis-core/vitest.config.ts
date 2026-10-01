import { defineConfig } from "vitest/config";
import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  define: {
    __SOLIS_CORE_PACKAGE_NAME__: JSON.stringify(pkg.name),
    __SOLIS_CORE_PACKAGE_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "core",
          environment: "jsdom",
          include: ["src/*.spec.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "testing",
          include: ["src/testing/**/*.spec.ts"],
        },
      },
    ],
  },
});
