# Customer Dashboard

`prismatic.showDashboard()` embeds one screen that gathers everything a customer
needs: the integrations they activated, their executions and logs, their
reusable connections, and the marketplace itself.

```js
prismatic.showDashboard({
  selector: "#my-embedded-dashboard",
  theme: theme === "light" ? "LIGHT" : "DARK",
});
```

## Hide the tabs you do not need

Your app may already show some of this information. Remove a tab with
`screenConfiguration.dashboard.hideTabs`. Use the panel on the left to try it.

```js
prismatic.showDashboard({
  selector: "#my-embedded-dashboard",
  screenConfiguration: {
    dashboard: { hideTabs: ["Logs", "Credentials"] },
  },
});
```

You can hide `Attachments`, `Components`, `Credentials`, `Executions`,
`Instances`, `Integrations`, `Logs`, and `Marketplace`.

`hideTabs` removes a tab from the screen. It does not change what the customer
is allowed to do. The customer's role still decides which tabs exist, so a tab
you do not hide can still be absent.

The dashboard also opens in a popover:

```js
prismatic.showDashboard({ usePopover: true });
```

You can review the code for this page in `src/routes/examples/dashboard.tsx`.

Read more about
[Embedding the Dashboard](https://prismatic.io/docs/embed/additional-screens/show-dashboard/).
