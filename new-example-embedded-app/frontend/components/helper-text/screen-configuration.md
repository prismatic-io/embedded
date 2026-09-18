# Screen Configuration

`screenConfiguration` controls what the embedded screens show. Use it to remove
a control your customers must not reach, or to make a screen fit the page you
put it on. The panel on the left sets every option that affects the integration
marketplace and the screens it leads to.

```js
prismatic.showMarketplace({
  selector: "#my-embedded-marketplace",
  screenConfiguration: {
    marketplace: { hideSearch: true },
    configurationWizard: { mode: "streamlined" },
    instance: { hideTabs: ["Logs"] },
  },
});
```

An option you leave out keeps its Prismatic default, so send only what you want
to change.

## marketplace

The list of integrations your customer browses.

- `configuration` — whether a card opens a detail page. `allow-details` lets the
  user open one, `always-show-details` opens one before the wizard, and
  `disallow-details` sends the user straight to the wizard.
- `hideSearch` — remove the search box.
- `hideActiveIntegrationsFilter` — remove the **All** and **Activated** filter
  buttons.

## configurationWizard

The screens a customer steps through to activate an integration.

- `mode` — `streamlined` puts the whole wizard on one page. `traditional` splits
  it into steps.
- `connectionConfiguration` — `reusable` lets the user pick a credential they
  already authorized, and share it with other integrations. `inline` asks for
  the credential on the page each time.
- `triggerDetailsConfiguration` — show the webhook URL and other trigger
  details. `default` collapses them, `default-open` expands them, and `hidden`
  removes them.
- `logsDisabled` and `stepResultsDisabled` — `never` keeps the data, `always`
  turns it off, and `optional` lets the customer decide.
- `hideSidebar` — remove the wizard's sidebar.
- `isInModal` — draw the wizard as a modal over your page.

## configureInstance

Applies when you open the wizard yourself with `prismatic.configureInstance()`.
Its `configuration` option takes the same three values as
`marketplace.configuration`.

## instance

The page for an integration the customer already activated.

- `hideBackToMarketplace` — remove the link back to the marketplace. Use it when
  your own app supplies the navigation.
- `hidePauseButton` and `hideDeactivation` — remove the controls that stop an
  integration.
- `hideTabs` — remove any of `Test`, `Executions`, and `Logs`.

## initializing

The loading screen Prismatic shows while an embedded screen starts. Set
`background` and `color` together to match your own loading state. Both are
required.

## isInPopover

`screenConfiguration` also accepts `isInPopover`. You do not set it for a
popover you open with `usePopover: true`, because the SDK sets it for you. Set
it yourself only when you put an embedded screen inside your own modal.

## Where to set it

Set `screenConfiguration` in `prismatic.init()` to apply it to every screen. Set
it on a single call, as this page does, to apply it to that screen only. A
call-level option merges over the one from `init`.

You can review the code for this page in
`frontend/routes/examples/screen-configuration.tsx`.

References:
[Marketplace Options](https://prismatic.io/docs/get-started/embedded-marketplace/marketplace-options/)
and [Embedding Marketplace](https://prismatic.io/docs/embed/marketplace/).
