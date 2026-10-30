# Prismatic embedded — Angular example

A minimal Angular app that embeds [Prismatic](https://prismatic.io).
For a fuller tour of the SDKs, see the React app in [`../example-embedded-app`](../example-embedded-app).

| File                                                                 | What it shows                                                                                       |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [`server.ts`](server.ts)                                             | The backend. It signs the embedded JWT with your private key.                                       |
| [`src/app/prismatic-auth.ts`](src/app/prismatic-auth.ts)             | Fetches the JWT, calls `prismatic.init` and `prismatic.authenticate`, and refreshes the token.      |
| [`src/app/hosted-marketplace.ts`](src/app/hosted-marketplace.ts)     | `@prismatic-io/embedded`: Prismatic's marketplace in an iframe, with `showMarketplace`.             |
| [`src/app/custom-marketplace.ts`](src/app/custom-marketplace.ts)     | `@prismatic-io/solis-core`: your own marketplace UI that deploys hosted and headless integrations. |
| [`src/app/dashboard.ts`](src/app/dashboard.ts)                       | A placeholder page. No Prismatic code.                                                              |

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

The custom marketplace lists every integration in the marketplace. **Deploy** reuses the customer's instance of that integration, or creates one. What happens next depends on the integration's `configurationExperience`:

- **hosted**: the app opens Prismatic's configuration wizard in a popover, a `<dialog>` that holds the iframe from `client.openVisibleFrame`. The wizard deploys the instance.
- **headless**: the app runs the integration's `init`, shows the suggested configuration as editable JSON, then saves it and deploys. In your app, you would build a real form from the configuration's `schema`.

The headless path links no connections, so use it with an integration that needs none, such as [Fake CRM](../example-embedded-app/integrations/fake-crm). For connections, see the React app's One-Click Connect example.
