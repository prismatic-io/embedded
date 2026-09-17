# Basic Example Marketplace

In this example, we demonstrate how to embed the integration marketplace into your app as an iframe using `prismatic.showMarketplace()`.

This page contains a `<div>` which serves as a placeholder for the embedded marketplace, and the marketplace `<iframe>` is injected into the `<div>` with

```js
prismatic.showMarketplace({
  selector: "#my-embedded-marketplace",
  theme: theme === "light" ? "LIGHT" : "DARK",
});
```

This is one of many options you have for embedding the integration marketplace in your app.
[Explore Marketplace Options](https://prismatic.io/docs/get-started/embedded-marketplace/marketplace-options/).

You can review the code for this page in `src/routes/examples/basic-embedded-marketplace.tsx`.

Read more about [Embedding Marketplace](https://prismatic.io/docs/embed/marketplace/).
