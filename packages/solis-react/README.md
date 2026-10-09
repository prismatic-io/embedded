# @prismatic-io/solis-react

React hooks for embedding Prismatic without its UI. Your app renders everything. The
SDK talks to a hidden Prismatic frame, caches what it reads, keeps it live, and cleans
up after your components unmount.

## Quickstart

Wrap your app once, then read with hooks.

```tsx
import {
  HostedConfiguration,
  PrismaticProvider,
  useMarketplace,
  useMarketplaceIntegration,
} from "@prismatic-io/solis-react";
import { useState } from "react";

export const App = ({ token }: { token: string }) => (
  <PrismaticProvider prismaticUrl="https://app.prismatic.io" auth={{ token }}>
    <Marketplace />
  </PrismaticProvider>
);

const Marketplace = () => {
  const marketplace = useMarketplace({});
  if (marketplace.status === "loading") return <p>Loading…</p>;
  if (marketplace.status === "error")
    return <button onClick={() => marketplace.actions.refresh.execute()}>Retry</button>;
  const { items, pageInfo } = marketplace.data;
  const { loadNextPage } = marketplace.actions;
  return (
    <>
      {items.map((item) => <Activate key={item.id} integrationId={item.id} />)}
      {pageInfo.hasNextPage && (
        <button disabled={loadNextPage.status === "loading"} onClick={() => loadNextPage.execute()}>
          More
        </button>
      )}
    </>
  );
};

const Activate = ({ integrationId }: { integrationId: string }) => {
  const integration = useMarketplaceIntegration(integrationId);
  const [instanceId, setInstanceId] = useState<string>();
  if (integration.status !== "success") return null;
  if (instanceId)
    return <HostedConfiguration instanceId={instanceId} onClose={() => setInstanceId(undefined)} />;
  const { createInstance } = integration.actions;
  return (
    <button
      disabled={!integration.data.permissions.createInstance.allowed || createInstance.status === "loading"}
      onClick={async () => {
        const created = await createInstance.execute({ name: integration.data.name });
        if (created.status === "success") setInstanceId(created.data.id);
      }}
    >
      Activate {integration.data.name}
    </button>
  );
};
```

SSR isn't supported. The provider boots the frame in an effect, so every hook is
`loading` during a server render.

## Four types

Every hook follows the same rules, so learning one teaches the rest.

**Resource.** Every read returns
`{ actions } & ({ status: "loading" } | { status: "error"; error; isRefreshing } | { status: "success"; data; isRefreshing })`.
`data` exists only on success. `actions` exists in every branch. A `null` or
`undefined` id stays `loading` and sends nothing.

**Action.** Every write is an action on the resource that owns it, including
`refresh`. `execute(input)` resolves to a `Result` and never rejects. The action's own
`status` is `idle`, `loading`, `success` or `error`. Readers of the same entity share
one status, so a list row and a detail view both show "deploying". A second
`execute()` while one runs resolves to a `PRISMATIC_ACTION_BUSY` error.

**Result.** `{ status: "success"; data } | { status: "error"; error }`. Errors carry a
stable `code`.

**Permission.** Each guarded action has a matching
`data.permissions.<action>`, either `{ allowed: true, reason: null }` or
`{ allowed: false, reason }`. Permissions exist only on success; before then an
action's `execute()` resolves to an error result instead of running. Decide availability from `allowed`. Map known reasons to messages and keep a
fallback, since new reasons can appear.

Lists return a `ListResource`: a Resource whose data is
`{ items, pageInfo: { hasNextPage, hasPreviousPage } }`, with `refresh`,
`loadNextPage` and `loadPreviousPage` actions. Each item is the same resource the
matching detail hook returns, plus a top-level `id` to key it by (`ListItem<R>`). An
item has its own status, so check `item.status` before reading `item.data`. List
inputs take `pageSize` and `onPageLoad` (`ListInput`):

- `"append"` (default) adds each page to the items already shown. A failed page
  leaves them alone and shows on `loadNextPage.status`. `hasPreviousPage` stays
  `false`.
- `"replace"` shows one page at a time and keeps it on screen until the next one is
  ready. The SDK remembers visited pages, so `loadPreviousPage` works without
  cursors.

`refresh` on a list reloads membership, order and every loaded page. A filter,
`pageSize` or `onPageLoad` change starts a new list at the first page, in `loading`.
An empty result is `success` with `items: []`. Inline filter literals are fine; the
SDK compares them by value.

A failed refresh keeps a loaded resource on `success` with its last data. The error
shows on `actions.refresh.status`.

## Hooks

| Hook | Argument | Returns |
| --- | --- | --- |
| `usePrismatic()` | none | Session: `{ serverInfo, hasFeature(name) }` |
| `useAuthenticatedUser()` | none | The user behind the token |
| `useMarketplace(filter?)` | `{ search?, category?, label?, ordering?, … } & ListInput` | `ListResource` of marketplace integrations |
| `useMarketplaceIntegration(id)` | integration id | One listing, with its instances |
| `useMarketplaceFilterOptions()` | none | `{ categories, labels }` |
| `useInstances(filter?)` | `{ integrationId? } & ListInput` | `ListResource` of instances |
| `useInstance(id)` | instance id | One instance |
| `useConfiguration(input)` | `{ instanceId, integrationVersionId? }` | Configuration for one version |
| `useUserConfiguration(id)` | instance id | The signed-in user's configuration |
| `useServerFunction(configuration, key)` | a configuration resource and a function key | An `Action` |
| `useConnections(filter?)` | `{ componentKey?, kind?, status? } & ListInput` | `ListResource` of connections |
| `useConnection(id)` | connection id | One connection |
| `usePrismaticClient()` | none | The solis-core `Client`, or `null` (advanced) |
| `useAction(handle)` | a core `ActionHandle` | An `Action` (advanced) |

A hook that needs only an id takes the bare id. Anything else takes one object.

## Provider

```tsx
<PrismaticProvider prismaticUrl="https://app.prismatic.io" auth={{ token }} onError={report}>
```

- `prismaticUrl`: the Prismatic app that serves the frame.
- `auth`: `{ token }`, a customer-scoped JWT. Without it the session stays `loading`.
  A new token goes over the live session. Re-authenticating as the same user keeps
  the cache. A different user drops it.
- `onError`: boot and session failures. Hook errors arrive on the hooks.
- `telemetry`: called with every wire event, including the boot's own.
- `clientMeta`: nonsecret, primitive-valued context sent to the frame once, at boot,
  for client identification.

Children render right away; the provider never suspends.

## Session

`usePrismatic()` is `loading` until the frame connects and confirms the session behind
`auth.token`, `error` when it can't, and then `success` with
`{ serverInfo, hasFeature(name) }`. A new token re-confirms in place: a ready session
stays `success` with `isRefreshing` until the frame answers. `actions.refresh` asks
the frame to confirm the session again.

```tsx
const session = usePrismatic();
if (session.status === "loading") return <Spinner />;
if (session.status === "error") return <Retry onRetry={session.actions.refresh.execute} />;
const canFilter = session.data.hasFeature("connections.listFilter");
```

`useAuthenticatedUser()` returns the user behind the token, with `refresh`.

## Marketplace

`useMarketplace(filter?)` takes `search`, `category`, `label`, `ordering`
(`MarketplaceOrdering`), `includeActiveIntegrations`, `activated`, `filterQuery` and
`strictMatchFilterQuery`, plus `ListInput`. `pageSize` defaults to 25. Without
`ordering` the list sorts by category, then name.

`useMarketplaceFilterOptions()` returns every category and label across the visible
marketplace, sorted and distinct, whatever the current filters are.

`useMarketplaceIntegration(id)` is one listing. A missing integration is an `error`
with `PRISMATIC_MARKETPLACE_INTEGRATION_NOT_FOUND`. Its data includes
`configurationExperience` for the latest marketplace version, so a card can badge
custom setup before any instance exists, and `instances`: the caller's instances of
the integration on every version, newest first, never-deployed ones included. Each is
the resource `useInstance(id)` returns, so a card can show `lifecycle` and `update`
and run `upgrade` or `deploy` with no other hook.

If the customer's instances can't be read, listings still load. Each then has empty
`instances`, `instancesError` set to `PRISMATIC_INSTANCES_UNAVAILABLE`, and
`createInstance` denied with `INSTANCES_UNAVAILABLE`.

`actions.createInstance.execute({ name, description? })` creates a never-deployed
instance and resolves to it. Gate it on `permissions.createInstance`, which covers
creating a new instance only. Instance and marketplace lists refresh by themselves
afterwards.

## Instances

`useInstances({ integrationId? })` lists instances newest first, never-deployed ones
included. `useInstance(id)` reads one by id, deployed or not. Items share their
entries with `useInstance`, so a row can pause or remove its instance and the detail
view sees it.

`data` holds the instance's flows, its
permissions, and `lifecycle`: the first that applies of `notDeployed`,
`needsReconfiguration`, `needsUserConfiguration`, `paused`, `pendingChanges` and
`active` (`InstanceLifecycle`). Three read-only values sit beside them:

- `configuration`: the saved `{ value, configurationVersion }`. `value` is `null`
  until something is saved. Edit through `useConfiguration`.
- `userConfiguration`: the signed-in user's `{ value, configurationVersion, configured }`,
  or `null` when the integration asks users for nothing.
- `update` (`InstanceUpdate`): `null` on the newest version, otherwise
  `{ integrationVersionId, versionNumber, requiresReconfiguration }`.

Actions are `updateDetails`, `deploy`, `upgrade`, `pause`, `resume`, `remove` and
`refresh`, each with a permission of the same name except `refresh`. `deploy` is the
only deploy: it makes a never-deployed instance live or applies saved configuration.
`upgrade` moves the instance to `update` keeping its values, and is denied with
`requires-reconfiguration` when the user should review them first. Neither `upgrade`
nor a configuration save deploys; the old version runs until `deploy` succeeds.

```tsx
const { update, permissions } = instance.data;
const { upgrade, deploy } = instance.actions;
if (update && !update.requiresReconfiguration)
  return (
    <button
      disabled={!permissions.upgrade.allowed || upgrade.status === "loading"}
      onClick={async () => {
        const moved = await upgrade.execute();
        if (moved.status === "success") await deploy.execute();
      }}
    >
      Update to v{update.versionNumber}
    </button>
  );
```

Each flow has its `webhookUrl`. Its `apiKeys` are absent until `useInstance` loads
them: lists never read keys, and a mounted `useInstance` reads them for any flow
missing them. A list item shares the entry, so a row shows keys once a detail view
has loaded them, and listing again keeps them. If reading the keys fails, the instance
is still ready and those flows stay without `apiKeys`; `refresh` reads them again.

Flows also expose `scheduleFromDeployer` and their saved `schedule`:
`{ expression, timezone }`, or `null` if no schedule is configured. An expression
is a cron string, `"once"`, or `"none"` to disable scheduled executions.

`updateDetails.execute({ name?, flows? })` renames the instance or replaces a flow's
API keys, as `{ flowId, apiKeys }`. Omitted fields stay as they are, and an empty
`apiKeys` clears that flow's keys.

Once `remove` succeeds, the instance leaves every list, and its `useInstance`,
`useConfiguration` and `useUserConfiguration` readers turn to `error` with
`PRISMATIC_INSTANCE_REMOVED`.

## Configuration

`useConfiguration({ instanceId, integrationVersionId? })` is one instance's
configuration for one integration version. Leave `integrationVersionId` out for the
version the instance runs, or pass `instance.data.update?.integrationVersionId` to
review an update. The same component handles a new instance, an edit and an update.

Data includes `schema`, `uiSchema`, `configurationVersion`, `serverFunctions`,
`integrationName`, `isUpgrade` and `configurationExperience` (`"headless"` or
`"hosted"`). Route on `configurationExperience`: render your form for `headless`, and
`<HostedConfiguration>` for `hosted`.

Actions are `init`, `save` and `refresh`. `init` returns the integration author's
suggested values; mapping them to form values is up to you. `save({ value })` stores
values. On a newer version it also moves the instance to that version. Deploying
stays on the instance.

### Flow schedules

`configuration.data.flows` describes the version being configured, including each
flow's `id`, `name`, `stableId`, and `scheduleFromDeployer`. Marketplace
`data.flows` describes the offered version; instance `data.flows` describes the
saved version and includes saved schedules. Use target-version IDs when saving
an upgrade; stable IDs can associate saved flows with their target counterparts.

```tsx
await configuration.actions.save.execute({
  value: formValues,
  flows: [
    {
      flowId: selectedFlow.id,
      schedule: { expression: "0 9 * * *", timezone: "America/Phoenix" },
    },
  ],
});
```

Omit `flows`, or individual flows, to retain existing schedules. A newly required
deployer schedule must be supplied before configuration can be completed. Use
`{ expression: "none" }` to disable scheduled executions, not a null schedule.
Omitted or null timezones use UTC. The platform validates schedules and retains
them across version changes for flows with the same stable identity.
Saving schedules and values is one operation; deployment remains separate.

```tsx
const Configure = ({ instanceId, integrationVersionId }: Props) => {
  const configuration = useConfiguration({ instanceId, integrationVersionId });
  const instance = useInstance(instanceId);
  if (configuration.status !== "success" || instance.status !== "success") return <Spinner />;
  const submit = async (value: unknown) => {
    const saved = await configuration.actions.save.execute({ value });
    if (saved.status === "success") await instance.actions.deploy.execute();
  };
  return <MyForm schema={configuration.data.schema} onSubmit={submit} />;
};
```

`data.connections` is a nested resource that loads in the background once the
configuration has. On success it is
`{ init: Requirement[]; serverFunctions: Record<key, Requirement[]> }`, where a
requirement is `{ key, label, options, permissions, actions }` and each option is a
connection resource like `useConnection(id)` returns. You keep selections as
`{ key, id }[]` and pass them to `init` and to server functions. Org-activated
connections are never offered.

A requirement backed by a customer-activated connection can make the customer a new
credential in one click: `actions.createConnection.execute({ label? })`, gated on
`permissions.createConnection` (`ROLE_RESTRICTED` for a marketplace user, `NO_TEMPLATE`
for a requirement nothing customer-activated backs). For OAuth it opens the consent
window from the click, so call it straight from the handler; a client-credentials
connection connects as it's made, with no window. It resolves with the new connection
once it's connected, the connection joins the requirement's `options`, and you select
it by its `id`.

## Server functions

```tsx
const configuration = useConfiguration({ instanceId, integrationVersionId });
const listTables = useServerFunction<{ baseId: string }, Table[]>(configuration, "listTables");
const result = await listTables.execute({ inputs: { baseId }, connections: selected });
```

`useServerFunction(configuration, key)` takes a configuration or user configuration
resource and returns an `Action` owned by your component. Its identity is stable, and
its status is its own. It runs against the configuration's version, so an update's
functions work before the instance moves. Separate calls to the hook run side by side.
Before the configuration loads, `execute` resolves to
`PRISMATIC_CONFIGURATION_UNAVAILABLE`. A call still running at unmount resolves to
`PRISMATIC_ACTION_DISPOSED`. The generics type the result; nothing validates it at
runtime.

## User configuration

`useUserConfiguration(instanceId)` is the signed-in user's own configuration on the
instance's current version, with `save`, `remove` and `refresh`. `save({ value })`
never deploys. `remove` deletes only this user's values. `data.configured` says whether
the user has saved settings, the same flag as the instance's `userConfiguration.configured`;
`value` is `null` until then. Its `data.connections` lists
the user-level connections each server function needs, and `useServerFunction` works
on it too. The frame needs to announce the `userConfiguration` feature.

## Connections

```tsx
const connections = useConnections({ kind: "customerActivated", status: "ACTIVE" });
const connection = useConnection(id);
```

`useConnections` isn't paged, so `hasNextPage` is always `false`. A connection's `id`
is opaque; pass it back as-is. `kind` is `customerActivated`, `manualCustomerActivated`,
`userActivated` (a personal connection the user can reuse) or `userLevel` (the user's own
credential for a connection one instance's user-level configuration needs). Personal and
user-level connections are served only to the user they belong to, and org-activated
connections are never served to a customer. Match
`definition.stableKey` to find the same connection across versions. An unknown id is
`PRISMATIC_CONNECTION_NOT_FOUND`; one deleted elsewhere becomes
`PRISMATIC_CONNECTION_REMOVED` the next time this session reads it.

```tsx
<button
  disabled={!connection.data.permissions.connect.allowed}
  onClick={() => connection.actions.connect.execute()}
>
  Connect
</button>
```

`actions.connect` authorizes an OAuth connection. The hidden frame can't open a window, so
`execute()` opens a blank one inside your click, before any `await`, then sends it to the
provider's consent screen. Call it straight from the click handler; anywhere else the
browser blocks the window and it resolves to `PRISMATIC_POPUP_BLOCKED`. While the
authorization is in flight the frame re-reads the connection every 2 seconds, and at once
when the page becomes visible again, so `data.status` follows the user's consent live.
`execute({ timeoutMs?, signal? })` resolves with the connection once it's `ACTIVE`, or
fails with `PRISMATIC_CONNECT_FAILED` (the status turned `FAILED` or `ERROR`),
`PRISMATIC_CONNECT_TIMEOUT` (10 minutes by default), `PRISMATIC_CONNECT_ABORTED`, or
`PRISMATIC_CONNECT_ABANDONED`: the user closed the window and the connection was still
`PENDING` 30 seconds later. The grace period is there because some providers make a
window read as closed while the user is still consenting. `data.status` keeps following
after any of these. The platform doesn't yet report a failed first authorization, so a
refused consent usually ends as abandoned or timed out rather than failed.

`actions.disconnect` clears an OAuth credential's token and resolves with the connection,
back to `PENDING`. `data.permissions.connect` and `disconnect` say why either is
unavailable: `NOT_OAUTH`, `CLIENT_CREDENTIALS` (they connect when saved, never through
`connect`), `ALREADY_CONNECTED` (disconnect first to authorize again), `NOT_CONNECTED` or
`ROLE_RESTRICTED`. Executing a denied one resolves to
`PRISMATIC_CONNECTION_FORBIDDEN` without opening anything.

## HostedConfiguration

```tsx
<HostedConfiguration
  instanceId={instanceId}
  className="h-full"
  onClose={() => setEditing(false)}
  onEvent={(message) => log(message)}
  onError={(error) => showError(error)}
/>
```

Renders Prismatic's configuration wizard for an instance. The wizard offers any update
the instance can move to, so the user picks the version there. Size it with
`className`. It removes the wizard when the wizard closes or the component unmounts,
and calls `onClose` on close. Closing doesn't mean anything was saved. After the
wizard changes something, the component refreshes instances, the marketplace and
configurations, so other hooks update with no code from you. `onEvent` gets every
wizard message uninterpreted. `onError` gets failures to open or to reconcile.

## Advanced

These exist for hosts with unusual needs. Most apps don't need them.

- `usePrismaticClient()` returns the solis-core `Client` for calls no hook covers yet.
  Observe a core `ActionHandle` with `useAction(handle)`.
- `client` prop: pass a client from solis-core's `createClient` instead of
  `prismaticUrl` to attach to a session you booted and own. Unmounting the provider
  releases what the tree acquired and leaves the client running. `telemetry`,
  `clientMeta`, `container`, `timeoutMs` and `host` then belong on `createClient`.
- `resourceIdleMs`: how long a cached read outlives its last reader. Default 10s.
  `0` releases right away and refetches a screen the user comes back to.
- `host`: capabilities granted to the frame, such as `openExternalUrl` for native
  shells and webviews that block `window.open`. With it, `connect` and
  `createConnection` hand the consent URL to `openExternalUrl` instead of opening a
  popup. Pass a module-level or memoized object; a new identity rebuilds the frame.
- `container`: where the hidden iframe mounts. Default `document.body`.
- `timeoutMs`: boot timeout. Default 30s.
