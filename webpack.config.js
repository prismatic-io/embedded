const path = require("path");
const webpack = require("webpack");
const package = require("./package.json");

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
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".ts", ".js"],
    fallback: {
      assert: false,
      constants: false,
      fs: false,
      path: false,
      process: false,
      stream: false,
      url: false,
      util: false,
    },
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
      EMBEDDED_VERSION: JSON.stringify(package.version),
    }),
  ],
};
