# Prismatic embedded — example app

This is a tutorial app.
It shows how to embed [Prismatic](https://prismatic.io) in a SaaS app with [`@prismatic-io/embedded`](https://github.com/prismatic-io/embedded).

The app pretends to be **Acme SaaS**, a CRM. You sign in as one user of one customer.
The CRM pages (Dashboard, Leads, Contacts, Accounts) hold static sample data.
They give the Prismatic examples a realistic home.

## The two things to read

**The examples are in [`frontend/routes/examples/`](frontend/routes/examples).**
Each file is one page, and each page shows one way to use the SDK.
Open a page in the browser, then read the file that makes it.
Each page also has a **Read about this example** button.
That text comes from [`frontend/components/helper-text/`](frontend/components/helper-text).

| Example                                                                                       | What it shows                                                                                                              |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| [`basic-embedded-marketplace.tsx`](frontend/routes/examples/basic-embedded-marketplace.tsx)   | `showMarketplace` in an iframe inside the page.                                                                            |
| [`basic-marketplace-popover.tsx`](frontend/routes/examples/basic-marketplace-popover.tsx)     | `showMarketplace` in a popover above the page.                                                                             |
| [`custom-marketplace-ui.tsx`](frontend/routes/examples/custom-marketplace-ui.tsx)             | `graphqlRequest` to build your own marketplace UI.                                                                         |
| [`headless-configuration.tsx`](frontend/routes/examples/headless-configuration.tsx)           | `@prismatic-io/solis-react`: your own forms for headless integrations, Prismatic's wizard for the rest. Needs setup below. |
| [`headless-one-click-list.tsx`](frontend/routes/examples/headless-one-click-list.tsx)         | A list with one-click **Connect**: OAuth, configure, and deploy.                                                           |
| [`headless-presentation-modes.tsx`](frontend/routes/examples/headless-presentation-modes.tsx) | One configuration as a single page or as a multi-step wizard.                                                              |
| [`screen-configuration.tsx`](frontend/routes/examples/screen-configuration.tsx)               | `screenConfiguration` options, with live controls.                                                                         |
| [`translations.tsx`](frontend/routes/examples/translations.tsx)                               | Phrase overrides and other languages.                                                                                      |
| [`connections.tsx`](frontend/routes/examples/connections.tsx)                                 | `showConnections` for reusable connections.                                                                                |
| [`dashboard.tsx`](frontend/routes/examples/dashboard.tsx)                                     | `showDashboard`, and how to hide tabs.                                                                                     |
| [`workflow-builder.tsx`](frontend/routes/examples/workflow-builder.tsx)                       | `showWorkflows` for customer-built workflows.                                                                              |
| [`workflow-contexts.tsx`](frontend/routes/examples/workflow-contexts.tsx)                     | `createWorkflow` from a context blueprint. Needs setup in Prismatic first.                                                 |
| [`chat-bot.tsx`](frontend/routes/examples/chat-bot.tsx)                                       | A chat bot that calls the Prismatic MCP server.                                                                            |

**The authentication backend is in [`server/prismatic-auth.ts`](server/prismatic-auth.ts).**
Every embedded screen needs a signed JWT. Your server signs that JWT, because the signing key must never reach the browser.
Here a Vite dev-server plugin does the work and serves `/api/prismatic-auth`.
In your own app, this is a real route on your backend.

The browser side is in [`frontend/hooks/use-prismatic-auth.tsx`](frontend/hooks/use-prismatic-auth.tsx).
It asks the endpoint for a token, calls `prismatic.init` and `prismatic.authenticate`, reads the user with `prismatic.graphqlRequest`, and then refreshes the token before it expires.

## Configure the app

The app reads its configuration from `.env.local` and from an RSA private key.
Both files are git-ignored.

1. Copy the template and fill in your values:

   ```bash
   cp .env.example .env.local
   ```

2. Make an RSA key pair. Save the private key as `prismatic-private-key.pem` in this directory.
   Upload the public key to Prismatic. Alternatively, Prismatic can generate the key pair for you.
   For the steps, see [Signing key setup](https://prismatic.io/docs/get-started/embedded-marketplace/authenticate-embedded-users/).

3. Install and start the app with [Bun](https://bun.sh):

   ```bash
   bun install
   bun run dev
   ```

   The app runs at <http://localhost:3000>.

### Configuration values

| Variable                         | Purpose                                                    |
| -------------------------------- | ---------------------------------------------------------- |
| `PRISMATIC_URL`                  | The Prismatic API host for your region.                    |
| `PRISMATIC_ORGANIZATION`         | Your organization ID.                                      |
| `PRISMATIC_CUSTOMER_EXTERNAL_ID` | The external ID of the customer.                           |
| `PRISMATIC_CUSTOMER_NAME`        | The name of the customer. It fills the app shell.          |
| `PRISMATIC_USER_ID`              | The end user. It fills the `sub` and `external_id` claims. |
| `PRISMATIC_USER_NAME`            | The name of the user. It fills the app shell.              |
| `PRISMATIC_ROLE`                 | `admin` or `user`.                                         |
| `PRISMATIC_TOKEN_VALID_SECONDS`  | Token lifetime. The minimum is 120.                        |
| `PRISMATIC_SIGNING_KEY_PATH`     | Path to your private key file.                             |
| `OPENAI_API_KEY`                 | Used by the chat bot example only.                         |
| `PRISMATIC_MCP_URL`              | The Prismatic MCP server for your region.                  |

Every value is required.
There are no defaults.
[`server/prismatic-config.ts`](server/prismatic-config.ts) checks them with a zod schema.
If a value is missing or has the wrong shape, the dev server prints every problem at start-up, and `/api/prismatic-auth` returns the same message.

Four things to know:

- **Edits take effect at once.**
  The app reads the configuration on each request.
  Change `.env.local`, then reload the page.
  Do not restart the server.
- **The `.env` files are the only source.**
  The app ignores real environment variables.
  Vite copies the `.env` values into `process.env` at start-up, so a read of `process.env` would hide a value you had just changed.
- **Never rename these variables to `VITE_*`.**
  Vite puts `VITE_*` variables into the client bundle.
  That would send your signing key to the browser.
- **The app shell shows the same user as the JWT.**
  Without a valid `.env.local`, the shell shows "Guest".

## Set up the headless configuration example

The **Headless Configuration** page configures an integration with this app's own UI instead of Prismatic's configuration wizard.
It needs the **Fake CRM** integration in your organization's marketplace.
That integration's source is in [`integrations/fake-crm/`](integrations/fake-crm).
It needs no connections: Fake CRM's records are static sample data.

Headless configuration is available for code-native integrations only.
Your organization needs the `headlessConfiguration` feature enabled before you import or publish one.
Contact Prismatic to enable it.

You need the [Prism CLI](https://prismatic.io/docs/cli/) 10.6.0 or later, logged in to your organization.
Prism 11 requires Node.js 22.19.0 or later.

To start a new headless integration of your own, pass `--configuration-type headless` (the default is `hosted`):

```bash
prism integrations:init my-integration --configuration-type headless
```

To use the provided Fake CRM integration:

```bash
cd integrations/fake-crm
bun install
bun run import    # builds the integration and imports it into Prismatic
```

Then, in Prismatic, publish the integration and make that version available and deployable in your marketplace.
Or use Prism, with the integration ID that `bun run import` printed:

```bash
prism integrations:publish <integration-id>
prism integrations:marketplace <version-id> --available --deployable
```

The integration's configuration is in [`integrations/fake-crm/src/configuration.ts`](integrations/fake-crm/src/configuration.ts).
It defines the schema, an `init` function that suggests values, and three server functions.
Its layout is a JSON Forms `uiSchema`, declared as `ui: { type: "uiSchema", value }`.
The app reads it from Solis as `configuration.data.ui`, and uses it to order the field mapper's fields.
`init` returns the suggested `configuration`, plus `unresolvedReasons` for the customer to review.
It saves nothing, and Prismatic doesn't validate its result.
The app saves the reviewed values, which Prismatic validates against the schema, then deploys the instance to make them live.
The app's form is in [`frontend/components/headless/fake-crm-configuration-form.tsx`](frontend/components/headless/fake-crm-configuration-form.tsx).

The **Presentation Modes** page uses Fake CRM too.

## Set up the HubSpot and Slack integrations

The **One-Click Connect** page lists your headless integrations, each with a **Connect** button.
Two integrations show the two cases it handles:

- **HubSpot Contacts**, in [`integrations/hubspot/`](integrations/hubspot), needs only a HubSpot connection.
  Its configuration has no fields, so **Connect** deploys it as soon as the customer authorizes HubSpot.
- **Slack Notifications**, in [`integrations/slack/`](integrations/slack), also needs a channel.
  Its `init` leaves the required channel empty, so the app asks for a channel in a dialog.

After **Connect** runs `init`, the app checks its suggested configuration against the integration's JSON Schema.
If any required field is empty, the app asks for the rest in a dialog. Otherwise it saves and deploys right away.

The **Headless Configuration** page sets them up too.

Both integrations call their APIs directly with the customer's OAuth token, so they use no components.
Each declares a customer-activated connection, which your organization defines once in Prismatic and each customer authorizes for themselves.
Before you import the integrations, create these customer-activated connections in Prismatic:

| Stable key      | Connection                     | OAuth scopes                                                                 |
| --------------- | ------------------------------ | ---------------------------------------------------------------------------- |
| `hubspot-oauth` | HubSpot's OAuth 2.0 connection | `oauth`, `crm.objects.contacts.read`, `crm.objects.contacts.write`           |
| `slack-oauth`   | Slack's OAuth 2.0 connection   | Bot scopes `channels:read`, `groups:read`, `chat:write`, `chat:write.public` |

Use your own HubSpot and Slack OAuth apps for the client ID and secret.
For the steps, see [Customer-activated connections](https://prismatic.io/docs/integrations/connections/integration-agnostic-connections/customer-activated/).

Then import, publish, and add each integration to your marketplace, as for Fake CRM:

```bash
cd integrations/hubspot   # then the same in integrations/slack
bun install
bun run import
```

Saving a headless configuration links the instance to the customer's credential, which the instance needs before it can deploy.
That needs a Prismatic stack with the Solis `configuration.connections` feature.

To try the flows, post to an instance's webhook URL.
HubSpot takes an Acme contact, such as `{ "email": "ada@example.com", "firstName": "Ada" }`, or `{ "contacts": [...] }`.
Slack takes `{ "text": "Hello from Acme" }`.

## Where everything else is

The app is split in two at the top level:

```
frontend/   The React app. Everything the browser renders.
server/     The backend. It signs the JWT and backs the chat bot.
```

`server/` is where your own backend code would go. Here those files are Vite
dev-server plugins, so they run under `bun run dev` only.

| Path                                                     | What it holds                                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------------- |
| `frontend/routes/examples/`                              | One route per example. Read these first.                                  |
| `server/prismatic-auth.ts`                               | Dev-only backend. It signs the embedded JWT.                              |
| `server/prismatic-config.ts`                             | zod schema for `.env.local`.                                              |
| `server/acme-chat-bot.ts`                                | Dev-only backend for the chat bot example.                                |
| `server/prismatic-mcp.ts`                                | MCP client for the chat bot example.                                      |
| `frontend/components/workflow-context-prerequisites.tsx` | In-app setup steps for the workflow contexts example.                     |
| `frontend/hooks/use-prismatic-auth.tsx`                  | The React binding for the token.                                          |
| `frontend/lib/navigation.ts`                             | The sidebar links. Add each new example here.                             |
| `frontend/lib/session.ts`                                | The signed-in user, read on the server.                                   |
| `frontend/routes/placeholder/`                           | Static CRM pages. No Prismatic code.                                      |
| `integrations/fake-crm/`                                 | The code-native integration the headless example configures.              |
| `integrations/hubspot/`, `integrations/slack/`           | Integrations for the one-click connect example.                           |
| `frontend/components/headless/`                          | Shared pieces of the headless examples: forms, editor, connection picker. |
| `frontend/components/`                                   | Shell components: sidebar, header, theme toggle.                          |
| `frontend/components/ui/`                                | Unmodified shadcn/ui parts. **Skip this folder.**                         |

## Commands

| Command                   | Result                                   |
| ------------------------- | ---------------------------------------- |
| `bun run dev`             | Start the development server.            |
| `bun run build`           | Build for production.                    |
| `bun run typecheck`       | Check TypeScript without emitting files. |
| `bun run generate-routes` | Regenerate `frontend/routeTree.gen.ts`.  |
| `bun run check`           | Lint and format with Biome.              |

## Stack

- [Bun](https://bun.sh) for package management and scripts
- [Vite](https://vite.dev) and [TanStack Start](https://tanstack.com/start)
- [TanStack Router](https://tanstack.com/router) with file-based routes
- [Tailwind CSS](https://tailwindcss.com) v4 and [shadcn/ui](https://ui.shadcn.com)
- [Biome](https://biomejs.dev) for lint and format
