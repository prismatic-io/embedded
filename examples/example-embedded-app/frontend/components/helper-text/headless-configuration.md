# Headless Configuration

A marketplace built with this app's own cards, for every integration in it. Integrations that support headless configuration are set up with this app's own forms instead of Prismatic's configuration wizard. The rest fall back to the wizard, in an iframe.

The page uses Solis React (`@prismatic-io/solis-react`), Prismatic's custom UI SDK for React. Its `PrismaticProvider` takes the same embedded JWT as the other examples. Hooks then read and change Prismatic data:

- `useMarketplace` lists the integrations, with a search and a category from `useMarketplaceFilterOptions`. `useMarketplaceIntegration` activates one with `createInstance`.
- `useConfiguration` returns the integration's configuration schema, its server functions, and the connections it needs.
- `init` suggests a `configuration`, plus any extra details the integration adds, such as reasons to review the suggestion. It saves nothing.
- `save` validates and stores the customer's values, and the instance's `deploy` makes them live.
- `useServerFunction` calls functions the integration defines, such as listing Fake CRM's record types or a Slack workspace's channels.

## Headless or hosted

The card's badge comes from the marketplace's `configurationExperience`, which describes the integration's latest version. The setup dialog decides by the `configurationExperience` of the configuration it opens, which describes the version the customer's instance runs:

- **`headless`**: this app's own form for the integration. A headless integration defines its schema, but this app decides how to render it. The app has forms for Fake CRM and Slack, matched to an integration by a server function only that integration defines. An integration whose configuration has no fields, such as HubSpot Contacts, needs only a save. A headless integration with no form here shows its schema instead.
- **`hosted`**: `<HostedConfiguration>`, Prismatic's wizard, in an iframe inside the same dialog. Solis refreshes whatever the wizard changed when it closes.

## Reusing the customer's connections

When a headless integration declares connections, the customer first chooses a credential for each one. Customer-activated connections are reusable, so a customer who authorized Slack for one integration can pick that same credential for another. `data.connections.data.instance` lists each connection with the customer's credentials as `options`, and `createConnection` authorizes a new one. The chosen credentials go to `save({ value, connections })`, which links the instance to them. An instance can't deploy until it's linked.

## Updates

When a newer version saves configuration in the same shape, the instance offers a one-click update: `upgrade` moves the instance, and `deploy` makes it live. When the new version's configuration changed shape, `useConfiguration` opens that version instead, and the customer reviews the values its `init` migrated before saving moves the instance to it.

## Set it up

The page needs the **Fake CRM** code-native integration in your organization's marketplace, and your organization needs the `headlessConfiguration` feature enabled before import or publish. Its source is in `integrations/fake-crm/`. From that directory, run `bun install` and `bun run import`, then publish the integration and make it available in your marketplace. The HubSpot and Slack integrations in `integrations/` work here too. See the README for installation and marketplace commands.

## Read the code

- `frontend/routes/examples/headless-configuration.tsx` lists the marketplace and picks the experience.
- `frontend/components/headless/connection-picker.tsx` chooses or creates credentials.
- `frontend/components/headless/configuration-editor.tsx` runs `init`, `save`, and `deploy`.
- `frontend/components/headless/configuration-forms.tsx` matches integrations to forms.
- `integrations/fake-crm/src/configuration.ts` defines Fake CRM's schema, `init`, and server functions.

References: [Headless configuration](https://prismatic.io/docs/integrations/headless-configuration/), [Solis](https://prismatic.io/docs/embed/headless/), and [Get started with headless configuration](https://prismatic.io/docs/get-started/build-integrations/headless-configuration/).
