# Headless Configuration

Configure an integration with your own UI instead of Prismatic's configuration wizard. Nothing on this page is an iframe: the marketplace cards, the setup steps, the field mapper, and the preview are this app's own components.

The page uses `@prismatic-io/solis-react`. Its `PrismaticProvider` takes the same embedded JWT as the other examples. Hooks then read and change Prismatic data:

- `useMarketplace` lists the integrations, and `useMarketplaceIntegration` activates one with `createInstance`.
- `useConfiguration` returns the integration's configuration schema and its server functions.
- `init` suggests starting values. `save` stores the customer's values, and the instance's `deploy` makes them live.
- `useServerFunction` calls functions the integration defines. Here they list Fake CRM record types and fields, and preview the Acme contact a mapping makes.

An integration whose version uses a config wizard reports `configurationExperience: "hosted"`. For those, the page renders `<HostedConfiguration>`, Prismatic's wizard.

## Set it up

The page needs the **Fake CRM** integration in your organization's marketplace. Its source is in `integrations/fake-crm/`. From that directory, run `bun install` and `bun run import`, then publish the integration and make it available in your marketplace.

## Read the code

- `frontend/routes/examples/headless-configuration.tsx` lists integrations and runs `init`, `save`, and `deploy`.
- `frontend/components/headless/fake-crm-configuration-form.tsx` is the setup form.
- `frontend/hooks/use-server-function-query.ts` runs a server function whenever its inputs change.
- `integrations/fake-crm/src/configuration.ts` defines the schema, `init`, and the server functions.

References: [Headless configuration](https://prismatic.io/docs/integrations/headless-configuration/) and [Get started with headless configuration](https://prismatic.io/docs/get-started/build-integrations/headless-configuration/).
