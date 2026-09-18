# Reusable Connections

A customer's users authenticate to a third-party app once, and Prismatic saves
that credential as a reusable connection. The same connection then serves every
integration and workflow that needs it.

`prismatic.showConnections()` embeds the screen where your customer's users
review those connections, rename them, reconnect them, and see which
integrations use each one.

```js
prismatic.showConnections({
  selector: "#my-embedded-connections",
  theme: theme === "light" ? "LIGHT" : "DARK",
});
```

Open the screen in a popover instead of an iframe on the page:

```js
prismatic.showConnections({ usePopover: true });
```

The screen shows only the connections that belong to the customer in the JWT you
signed. A user cannot see another customer's credentials.

Reusable connections appear in the configuration wizard when
`screenConfiguration.configurationWizard.connectionConfiguration` is
`"reusable"`, which is the default. Try that option on the
[Screen Configuration](/examples/screen-configuration) page.

You can review the code for this page in `frontend/routes/examples/connections.tsx`.

Read more about
[Embedding Connections](https://prismatic.io/docs/embed/additional-screens/show-connections/).
