# Prismatic embedded — Angular example

A minimal Angular app that embeds [Prismatic](https://prismatic.io).
For a fuller tour of the SDKs, see the React app in [`../example-embedded-app`](../example-embedded-app).

| File                                                                                                      | What it shows                                                                                  |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [`server.ts`](server.ts)                                                                                  | The backend. It signs the embedded JWT with your private key.                                  |
| [`src/app/prismatic-auth.ts`](src/app/prismatic-auth.ts)                                                  | Fetches the JWT, calls `prismatic.init` and `prismatic.authenticate`, and refreshes the token. |
| [`src/app/hosted-marketplace/`](src/app/hosted-marketplace)                                               | `@prismatic-io/embedded`: Prismatic's marketplace in an iframe, with `showMarketplace`.        |
| [`src/app/custom-marketplace/`](src/app/custom-marketplace)                                               | `@prismatic-io/solis-core`: your own marketplace UI. See below.                                |
| [`src/app/dashboard/`](src/app/dashboard)                                                                 | A placeholder page. No Prismatic code.                                                         |

Each page has its own folder under `src/app/`, as Angular's [style guide](https://angular.dev/style-guide) recommends: code is grouped by feature, not by type. [`app.routes.ts`](src/app/app.routes.ts) maps the sidebar links to those pages.

## Run it

1. Copy the template and fill in your values:

   ```bash
   cp .env.example .env.local
   ```

2. Save your RSA private key as `prismatic-private-key.pem` in this directory, and upload its public key to Prismatic.
   See [Signing key setup](https://prismatic.io/docs/get-started/embedded-marketplace/authenticate-embedded-users/).

3. Install and start the app with [Bun](https://bun.sh):

   ```bash
   bun install
   bun run dev
   ```

   `bun run dev` starts the auth server on port 3001 and the Angular dev server at <http://localhost:4200>.
   The Angular dev server sends `/api` requests to the auth server (see [`proxy.conf.json`](proxy.conf.json)).

## The custom marketplace

The custom marketplace lists every integration in the marketplace. **Deploy** reuses the customer's instance of that integration, or creates one, and opens setup in a popover.
**Remove** deletes the customer's instance, and its configuration with it.
The configuration of the version being set up decides who renders it:

- **hosted**: Prismatic's configuration wizard, in the iframe from `client.openVisibleFrame`. The wizard deploys the instance.
- **headless**: this app's own UI, in [`headless-setup/`](src/app/custom-marketplace/headless-setup):
  1. **Connect your accounts.** For each customer-activated connection the integration declares, the customer picks an account they connected before or connects a new one. A new OAuth connection opens the provider's consent screen in a new window.
  2. **Configure.** The app runs the integration's `init` for suggested values and shows them in its form for that integration.
  3. **Save and deploy.** Saving links the chosen connections. Prismatic validates the values against the integration's schema, and the form shows invalid fields by path.

The app has forms for the three example integrations in [`../example-embedded-app/integrations/`](../example-embedded-app/integrations):

| Integration | Form                                                                                                                   |
| ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| Fake CRM    | Picks a record type, maps fields, and previews a sample record. No connections.                                         |
| Slack       | Picks a channel, listed with the customer's Slack connection.                                                           |
| HubSpot     | None needed: its configuration has no fields, so the customer connects HubSpot and saves.                               |

A headless integration without a form here gets its values as editable JSON.

The custom marketplace's files:

| File                                                                                                 | What it does                                                                                 |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| [`custom-marketplace.ts`](src/app/custom-marketplace/custom-marketplace.ts)                          | The page: lists integrations, and opens setup in a popover.                                  |
| [`solis.ts`](src/app/custom-marketplace/solis.ts)                                                    | Helpers over solis-core: server functions, connection choices, and the OAuth consent flow.   |
| [`headless-setup/headless-setup.ts`](src/app/custom-marketplace/headless-setup/headless-setup.ts)    | The headless steps: connect, configure, save and deploy. Picks the form for the integration. |
| [`headless-setup/connection-picker.ts`](src/app/custom-marketplace/headless-setup/connection-picker.ts) | Picks or connects the customer's account for each connection.                              |
| [`headless-setup/fake-crm-form.ts`](src/app/custom-marketplace/headless-setup/fake-crm-form.ts)      | Fake CRM's form.                                                                             |
| [`headless-setup/slack-form.ts`](src/app/custom-marketplace/headless-setup/slack-form.ts)            | Slack's form.                                                                                |
To import the integrations and create the `slack-oauth` and `hubspot-oauth` customer-activated connections they need, follow [the React app's instructions](../example-embedded-app/README.md#set-up-the-headless-configuration-example).
Linking connections on save needs a Prismatic stack with the Solis `configuration.connections` feature.
