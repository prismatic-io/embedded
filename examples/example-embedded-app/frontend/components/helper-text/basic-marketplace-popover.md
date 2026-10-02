# Basic Marketplace with Popover

In this example, we demonstrate how to embed the integration marketplace into your app as an iframe that opens in a popover using `prismatic.showMarketplace()`.

This page contains a button that, when clicked, invokes:

```js
prismatic.showMarketplace({
  usePopover: true,
  theme: theme === "light" ? "LIGHT" : "DARK",
});
```

This is one of many options you have for embedding the integration marketplace in your app.
[Explore Marketplace Options](https://prismatic.io/docs/get-started/embedded-marketplace/marketplace-options/).

You can review the code for this page in `frontend/routes/examples/basic-marketplace-popover.tsx`.

Read more about [Embedding Marketplace](https://prismatic.io/docs/embed/marketplace/).
