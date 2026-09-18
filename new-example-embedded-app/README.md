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

| Example                                                                                     | What it shows                                      |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| [`basic-embedded-marketplace.tsx`](frontend/routes/examples/basic-embedded-marketplace.tsx) | `showMarketplace` in an iframe inside the page.    |
| [`basic-marketplace-popover.tsx`](frontend/routes/examples/basic-marketplace-popover.tsx)   | `showMarketplace` in a popover above the page.     |
| [`custom-marketplace-ui.tsx`](frontend/routes/examples/custom-marketplace-ui.tsx)           | `graphqlRequest` to build your own marketplace UI. |
| [`screen-configuration.tsx`](frontend/routes/examples/screen-configuration.tsx)             | `screenConfiguration` options, with live controls. |
| [`translations.tsx`](frontend/routes/examples/translations.tsx)                             | Phrase overrides and other languages.              |
| [`connections.tsx`](frontend/routes/examples/connections.tsx)                               | `showConnections` for reusable connections.        |
| [`dashboard.tsx`](frontend/routes/examples/dashboard.tsx)                                   | `showDashboard`, and how to hide tabs.             |
| [`chat-bot.tsx`](frontend/routes/examples/chat-bot.tsx)                                     | A chat bot that calls the Prismatic MCP server.    |

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

3. Install and start the app:

   ```bash
   npm install
   npm run dev
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

## Where everything else is

The app is split in two at the top level:

```
frontend/   The React app. Everything the browser renders.
server/     The backend. It signs the JWT and backs the chat bot.
```

`server/` is where your own backend code would go. Here those files are Vite
dev-server plugins, so they run under `npm run dev` only.

| Path                                    | What it holds                                     |
| --------------------------------------- | ------------------------------------------------- |
| `frontend/routes/examples/`             | One route per example. Read these first.          |
| `server/prismatic-auth.ts`              | Dev-only backend. It signs the embedded JWT.      |
| `server/prismatic-config.ts`            | zod schema for `.env.local`.                      |
| `server/acme-chat-bot.ts`               | Dev-only backend for the chat bot example.        |
| `server/prismatic-mcp.ts`               | MCP client for the chat bot example.              |
| `frontend/hooks/use-prismatic-auth.tsx` | The React binding for the token.                  |
| `frontend/lib/navigation.ts`            | The sidebar links. Add each new example here.     |
| `frontend/lib/session.ts`               | The signed-in user, read on the server.           |
| `frontend/routes/placeholder/`          | Static CRM pages. No Prismatic code.              |
| `frontend/components/`                  | Shell components: sidebar, header, theme toggle.  |
| `frontend/components/ui/`               | Unmodified shadcn/ui parts. **Skip this folder.** |

## Commands

| Command                   | Result                                  |
| ------------------------- | --------------------------------------- |
| `npm run dev`             | Start the development server.           |
| `npm run build`           | Build for production.                   |
| `npm run generate-routes` | Regenerate `frontend/routeTree.gen.ts`. |
| `npm run check`           | Lint and format with Biome.             |

## Stack

- [Vite](https://vite.dev) and [TanStack Start](https://tanstack.com/start)
- [TanStack Router](https://tanstack.com/router) with file-based routes
- [Tailwind CSS](https://tailwindcss.com) v4 and [shadcn/ui](https://ui.shadcn.com)
- [Biome](https://biomejs.dev) for lint and format
