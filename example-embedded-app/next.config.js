const path = require("node:path");

const repoRoot = path.join(__dirname, "..");

module.exports = {
  turbopack: {
    root: repoRoot,
    rules: {
      "*.md": {
        loaders: ["raw-loader"],
        as: "*.js",
      },
    },
  },
  transpilePackages: ["@prismatic-io/embedded"],
  outputFileTracingRoot: repoRoot,
};
