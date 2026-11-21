# Example integrations

These are code-native Prismatic integrations that the example apps configure and deploy.
Both the React app in [`../example-embedded-app`](../example-embedded-app) and the Angular app in [`../angular-app`](../angular-app) use them for their headless configuration examples.

All three use headless configuration, so each app shows them with its own forms instead of Prismatic's configuration wizard.

| Integration             | What it shows                                                                                              | Connections needed |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------ |
| [`fake-crm/`](fake-crm) | A form with a record type picker, a field mapper, and a sample-record preview, backed by server functions. | None               |
| [`hubspot/`](hubspot)   | One-click connect: the customer connects HubSpot and saves, with no other fields.                          | `hubspot-oauth`    |
| [`slack/`](slack)       | One-click connect, plus a channel the customer picks.                                                      | `slack-oauth`      |

Fake CRM's records are static sample data.
HubSpot and Slack call their APIs directly with the customer's OAuth token, so they use no components.

Each integration's schema, `init` function, and server functions are in its `src/configuration.ts`.

## Import an integration

You need:

- The [Prism CLI](https://prismatic.io/docs/cli/) 10.6.0 or later, logged in to your organization.
- The `headlessConfiguration` feature enabled for your organization. Contact Prismatic to enable it.
- For HubSpot and Slack, the `hubspot-oauth` and `slack-oauth` customer-activated connections. The [React app's README](../example-embedded-app/README.md#set-up-the-hubspot-and-slack-integrations) lists the scopes each needs.

Each integration is its own Bun project.
From its directory:

```bash
bun install
bun run import    # builds the integration and imports it into Prismatic
```

Then publish the integration and make that version available and deployable in your marketplace:

```bash
prism integrations:publish <integration-id>
prism integrations:marketplace <version-id> --available --deployable
```

## Other commands

Run these from an integration's directory:

| Command             | What it does                  |
| ------------------- | ----------------------------- |
| `bun run build`     | Builds the integration.       |
| `bun run test`      | Runs its tests.               |
| `bun run typecheck` | Typechecks it.                |
| `bun run check`     | Runs Biome's lint and format. |
