# One-Click Connect

The marketplace's headless integrations in a list, each with a **Connect** button. One click does everything:

1. Creates an instance with `createInstance`, if the customer doesn't have one.
2. Authorizes the customer's account with `createConnection`, which runs the OAuth flow in a new window.
3. Runs the integration's `init` for its suggested configuration.
4. Saves that configuration with `save({ value, connections })`, linking the new credential, then deploys the instance.

Step 4 checks the suggested configuration against the integration's JSON Schema. When `init` leaves a required field empty, the integration needs more than a connection. Then step 4 waits for the customer: their remaining settings open in a dialog, and saving the dialog deploys. Fake CRM fills every field with defaults, so it deploys in one click too.

Integrations that use Prismatic's configuration wizard can't be set up this way, so the list leaves them out.

## Try it with HubSpot and Slack

Two integrations in `integrations/` show both cases:

- **HubSpot Contacts** only needs a connection. Its configuration has no fields, so Connect deploys it straight after the customer authorizes HubSpot.
- **Slack Notifications** needs a channel, which has no sensible default. Its `init` leaves the required channel empty, so the app asks for one. The dialog lists the workspace's channels with the integration's `listChannels` server function, run with the credential the customer just authorized.

Both need customer-activated connections in your organization. See the README for setup.

## Opening the consent window

Browsers only let a click open a window, and only before the click handler's first `await`. `createConnection` opens its window as it starts, but a new integration has nothing to call it on until its instance exists. So the click opens a blank window right away, and the app gives the session a `host` with an `openExternalUrl` capability. When Solis asks the host to open the consent screen, that capability sends the blank window there.

## Read the code

- `frontend/routes/examples/headless-one-click-list.tsx` runs the steps above.
- `frontend/components/headless/consent-window.ts` opens the window inside the click.
- `frontend/components/headless/configuration-editor.tsx` has `unpopulatedFields`, which finds the empty required fields.
- `integrations/hubspot/src/configuration.ts` and `integrations/slack/src/configuration.ts` define each integration's schema and `init`.
