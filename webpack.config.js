const path = require("node:path");
const webpack = require("webpack");
const pkg = require("./package.json");

module.exports = {
  mode: "production",
  node: { global: true },
  module: {
    rules: [
      {
        sideEffects: false,
      },
      {
        test: /\.ts/,
        use: "ts-loader",
        exclude: [/node_modules/, /\.test\.ts$/],
      },
    ],
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  optimization: {
    usedExports: true,
  },
  entry: "./src/index.ts",
  output: {
    filename: "index.js",
    path: path.resolve(__dirname, "dist"),
    globalObject: "this",
    library: "prismatic",
    libraryTarget: "umd",
  },
  plugins: [
    new webpack.DefinePlugin({
      EMBEDDED_VERSION: JSON.stringify(pkg.version),
    }),
  ],
};
