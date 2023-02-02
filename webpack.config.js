const path = require("path");
const webpack = require("webpack");
const package = require("./package.json");

module.exports = {
  mode: "production",
  target: "node",
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
