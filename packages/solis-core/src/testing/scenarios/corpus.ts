/**
 * Protocol-level scenarios. Each drives the wire API the way a host would and asserts only
 * what a user or the backend could observe: list contents, Result status and codes,
 * permission reasons, and state after a re-read. None counts emissions or asserts ids.
 */

import type {
  ConnectionState,
  Instance,
  MarketplaceListPage,
  PrismaticApi,
} from "../../protocol/index.js";
import type { Scenario } from "./scenario.js";
import {
  type World,
  type WorldConnection,
  type WorldIntegration,
  type WorldUser,
  worldConnectionId,
} from "./world.js";

const ALICE: WorldUser = { principal: "alice", role: "admin" };
const BOB: WorldUser = { principal: "bob", role: "user" };
const USERS = [ALICE, BOB];

/** The value a stream holds now: its first emission. */
const current = async <T>(
  stream: ReadableStream<T> | PromiseLike<ReadableStream<T>>,
): Promise<T> => {
  const reader = (await stream).getReader();
  try {
    const { done, value } = await reader.read();
    if (done) throw new Error("Stream closed before emitting");
    return value;
  } finally {
    await reader.cancel();
  }
};

/** Reads a stream until a value matches, as a host following a status does. */
const until = async <T>(
  stream: ReadableStream<T> | PromiseLike<ReadableStream<T>>,
  matches: (value: T) => boolean,
  timeoutMs = 8_000,
): Promise<T> => {
  const reader = (await stream).getReader();
  const timer = setTimeout(
    () => void reader.cancel(new Error("No matching value in time")),
    timeoutMs,
  );
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) throw new Error("Stream closed before a matching value");
      if (matches(value)) return value;
    }
  } finally {
    clearTimeout(timer);
    await reader.cancel().catch(() => {});
  }
};

const permissionReasons = ({ permissions }: ConnectionState) => ({
  connect: permissions.connect.reason,
  disconnect: permissions.disconnect.reason,
});

const listingNames = async (page: MarketplaceListPage) =>
  Promise.all(
    page.integrations.map(
      async (listing) => (await current(listing.state())).name,
    ),
  );

const instanceNames = async (instances: readonly Instance[]) =>
  Promise.all(
    instances.map(async (instance) => (await instance.refresh()).name),
  );

/** A fresh read of the listing, as a host route landing on it would make. */
const listing = async (api: PrismaticApi, integrationId: string) =>
  current((await api.marketplace.get(integrationId)).state());

const allNames = async (api: PrismaticApi, limit: number) => {
  const names: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await api.marketplace.list({ limit, cursor });
    names.push(...(await listingNames(page)));
    cursor = page.pageInfo.hasNextPage
      ? (page.pageInfo.endCursor ?? undefined)
      : undefined;
  } while (cursor);
  return names;
};

const allowed = { allowed: true, reason: null };
const denied = (reason: string) => ({ allowed: false, reason });

const catalog: WorldIntegration[] = [
  {
    id: "int-zeta",
    name: "Zeta Sales",
    category: "Sales",
    labels: ["beta"],
  },
  { id: "int-beta", name: "Beta CRM", category: "CRM", labels: ["featured"] },
  {
    id: "int-alpha",
    name: "Alpha Airtable",
    category: "CRM",
    labels: ["featured", "beta"],
  },
  { id: "int-delta", name: "Delta Uncategorized" },
  { id: "int-gamma", name: "Gamma Hair Salon", category: "Retail" },
  {
    id: "int-alpha-v0",
    name: "Alpha Airtable (old)",
    category: "CRM",
    listed: false,
    upgradeTo: "int-alpha",
  },
];

const catalogWorld: World = { users: USERS, integrations: catalog };

const multi: WorldIntegration = {
  id: "int-multi",
  name: "Multi",
  allowMultipleInstances: true,
};
const single: WorldIntegration = { id: "int-single", name: "Single" };

const configured: WorldIntegration = {
  id: "int-config",
  name: "Configured",
  schema: {
    type: "object",
    properties: { baseId: { type: "string" } },
  },
  configurationVersion: "1",
  initResult: { baseId: "app-default" },
  serverFunctions: [
    {
      key: "echo",
      label: "Echo",
      execute: (inputs) => ({ echoed: inputs }),
      connections: [
        { key: "slack", options: ["ccv-team-slack", "ccv-org-picked-slack"] },
      ],
    },
    {
      key: "listTables",
      label: "List tables",
      invalidInputs: "A base is required",
    },
  ],
  initConnections: [
    { key: "airtable", options: ["scv-own-airtable", "scv-org-airtable"] },
  ],
};

const CUSTOMER_CONNECTIONS: readonly WorldConnection[] = [
  {
    name: "ccv-team-slack",
    kind: "customerActivated",
    label: "Team Slack",
    status: "ACTIVE",
    componentKey: "slack",
    definition: "slack-connection",
  },
  {
    name: "scv-own-airtable",
    kind: "manualCustomerActivated",
    label: "Our Airtable",
    status: "PENDING",
    componentKey: "airtable",
    definition: "own-airtable",
  },
  {
    name: "scv-alice-gmail",
    kind: "userActivated",
    label: "Alice's Gmail",
    status: "ACTIVE",
    componentKey: "gmail",
    definition: "gmail-connection",
    owner: "alice",
  },
];

/** Customer and personal credentials across OAuth grants and statuses. */
const OAUTH_CONNECTIONS: readonly WorldConnection[] = [
  {
    name: "ccv-team-slack",
    kind: "customerActivated",
    label: "Team Slack",
    status: "PENDING",
    componentKey: "slack",
    definition: "slack-connection",
    oauth2Type: "authorization_code",
  },
  {
    name: "ccv-sales-slack",
    kind: "customerActivated",
    label: "Sales Slack",
    status: "ACTIVE",
    componentKey: "slack",
    definition: "slack-connection",
    oauth2Type: "authorization_code",
  },
  {
    name: "ccv-expired-slack",
    kind: "customerActivated",
    label: "Expired Slack",
    status: "ERROR",
    componentKey: "slack",
    definition: "slack-connection",
    oauth2Type: "authorization_code",
  },
  {
    name: "scv-alice-gmail",
    kind: "userActivated",
    label: "Alice's Gmail",
    status: "ACTIVE",
    componentKey: "gmail",
    definition: "gmail-connection",
    owner: "alice",
    oauth2Type: "authorization_code",
  },
  {
    name: "ccv-service",
    kind: "customerActivated",
    label: "Service Account",
    status: "ACTIVE",
    componentKey: "warehouse",
    definition: "warehouse-connection",
    oauth2Type: "client_credentials",
  },
  {
    name: "scv-own-airtable",
    kind: "manualCustomerActivated",
    label: "Our Airtable",
    status: "ACTIVE",
    componentKey: "airtable",
    definition: "own-airtable",
  },
];

const withNewConnections: WorldIntegration = {
  id: "int-new-connections",
  name: "New connections",
  initConnections: [
    {
      key: "slack",
      options: ["ccv-team-slack"],
      template: {
        definition: "slack-connection",
        oauth2Type: "authorization_code",
      },
    },
  ],
};

const refusedClientCredentials: WorldIntegration = {
  id: "int-refused-client-credentials",
  name: "Refused client credentials",
  initConnections: [
    {
      key: "ledger",
      options: [],
      template: {
        definition: "ledger-connection",
        oauth2Type: "client_credentials",
        connectsAs: "FAILED",
      },
    },
  ],
};

const userLevel: WorldIntegration = {
  id: "int-user-level",
  name: "User level",
  userConfigurationSchema: { type: "object" },
};

/** Each user's own credential for the connection the instance's user-level configuration needs. */
const USER_LEVEL_CONNECTIONS: readonly WorldConnection[] = [
  {
    name: "ulcv-alice-crm",
    kind: "userLevel",
    label: "crm",
    status: "PENDING",
    componentKey: "crm",
    definition: "crm-user-connection",
    oauth2Type: "authorization_code",
    owner: "alice",
    instanceId: "inst-1",
  },
  {
    name: "ulcv-bob-crm",
    kind: "userLevel",
    label: "crm",
    status: "ACTIVE",
    componentKey: "crm",
    definition: "crm-user-connection",
    oauth2Type: "authorization_code",
    owner: "bob",
    instanceId: "inst-1",
  },
];

const ORG_CONNECTIONS: readonly WorldConnection[] = [
  {
    name: "ccv-org-picked-slack",
    kind: "orgActivatedCustomer",
    label: "Slack the org set up for us",
    status: "ACTIVE",
    componentKey: "slack",
    definition: "org-slack-connection",
  },
  {
    name: "scv-org-airtable",
    kind: "orgActivatedGlobal",
    label: "Org Airtable",
    status: "ACTIVE",
    componentKey: "airtable",
    definition: "org-airtable",
  },
];

const migrateV1: WorldIntegration = {
  id: "int-migrate-v1",
  name: "Migrate",
  versionNumber: 1,
  listed: false,
  schema: { type: "object", properties: { email: { type: "string" } } },
  configurationVersion: "1",
  upgradeTo: "int-migrate-v2",
};
const migrateV2: WorldIntegration = {
  id: "int-migrate-v2",
  name: "Migrate",
  versionNumber: 2,
  schema: {
    type: "object",
    properties: { recipients: { type: "array", items: { type: "string" } } },
  },
  configurationVersion: "2",
  initResult: { recipients: ["a@example.test"] },
  serverFunctions: [
    {
      key: "previewRecipients",
      label: "Preview recipients",
      execute: (inputs) => ({
        recipients: [(inputs as { email: string }).email],
      }),
    },
  ],
};

const compatV1: WorldIntegration = {
  id: "int-compat-v1",
  name: "Compatible",
  versionNumber: 1,
  listed: false,
  upgradeTo: "int-compat-v2",
};
const compatV2: WorldIntegration = {
  id: "int-compat-v2",
  name: "Compatible",
  versionNumber: 2,
};

const personal: WorldIntegration = {
  id: "int-personal",
  name: "Personal",
  userConfigurationSchema: {
    type: "object",
    properties: { channel: { type: "string" } },
  },
};

export const scenarios: readonly Scenario[] = [
  {
    id: "marketplace.list-default-order",
    title:
      "lists the marketplace by category then name, uncategorized last, without older versions",
    world: catalogWorld,
    run: async ({ signIn, expect }) => {
      const api = await signIn("alice");
      expect(await listingNames(await api.marketplace.list())).toEqual([
        "Alpha Airtable",
        "Beta CRM",
        "Gamma Hair Salon",
        "Zeta Sales",
        "Delta Uncategorized",
      ]);
    },
  },
  {
    id: "marketplace.paging",
    title: "pages the marketplace with cursors until it runs out",
    world: catalogWorld,
    run: async ({ signIn, expect }) => {
      const api = await signIn("alice");
      const first = await api.marketplace.list({ limit: 2 });
      expect(await listingNames(first)).toEqual(["Alpha Airtable", "Beta CRM"]);
      expect(first.pageInfo.hasNextPage).toBe(true);
      const second = await api.marketplace.list({
        limit: 2,
        cursor: first.pageInfo.endCursor ?? undefined,
      });
      expect(await listingNames(second)).toEqual([
        "Gamma Hair Salon",
        "Zeta Sales",
      ]);
      const last = await api.marketplace.list({
        limit: 2,
        cursor: second.pageInfo.endCursor ?? undefined,
      });
      expect(await listingNames(last)).toEqual(["Delta Uncategorized"]);
      expect(last.pageInfo.hasNextPage).toBe(false);
      expect(await allNames(api, 2)).toEqual(
        await listingNames(await api.marketplace.list()),
      );
    },
  },
  {
    id: "marketplace.filters",
    title: "filters the marketplace by search term, category and label",
    world: catalogWorld,
    run: async ({ signIn, expect }) => {
      const api = await signIn("alice");
      expect(
        await listingNames(await api.marketplace.list({ searchTerm: "AIR" })),
      ).toEqual(["Alpha Airtable", "Gamma Hair Salon"]);
      expect(
        await listingNames(await api.marketplace.list({ category: "CRM" })),
      ).toEqual(["Alpha Airtable", "Beta CRM"]);
      expect(
        await listingNames(await api.marketplace.list({ label: "beta" })),
      ).toEqual(["Alpha Airtable", "Zeta Sales"]);
      expect(
        await listingNames(
          await api.marketplace.list({ category: "CRM", label: "featured" }),
        ),
      ).toEqual(["Alpha Airtable", "Beta CRM"]);
    },
  },
  {
    id: "marketplace.configuration-experience",
    title:
      "tells listings configured in the host's own UI from ones configured in the hosted wizard",
    world: {
      users: USERS,
      integrations: [
        { id: "int-spectral", name: "Spectral", category: "A" },
        {
          id: "int-pages-v1",
          name: "Moving to Spectral",
          category: "B",
          listed: false,
          configurationExperience: "hosted",
          upgradeTo: "int-pages-v2",
        },
        {
          id: "int-pages-v2",
          name: "Moving to Spectral",
          category: "B",
          versionNumber: 2,
        },
        {
          id: "int-pages",
          name: "Config Pages",
          category: "C",
          configurationExperience: "hosted",
        },
      ],
    },
    run: async ({ signIn, expect }) => {
      const api = await signIn("alice");
      const page = await api.marketplace.list();
      expect(
        await Promise.all(
          page.integrations.map(async (stub) => {
            const { name, configurationExperience } = await current(
              stub.state(),
            );
            return [name, configurationExperience];
          }),
        ),
      ).toEqual([
        ["Spectral", "headless"],
        ["Moving to Spectral", "headless"],
        ["Config Pages", "hosted"],
      ]);
      expect(await listing(api, "int-pages")).toMatchObject({
        configurationExperience: "hosted",
      });
    },
  },
  {
    id: "marketplace.filters-partial-match",
    title:
      "matches category and label filters as case-insensitive substrings, as the API does",
    world: catalogWorld,
    run: async ({ signIn, expect }) => {
      const api = await signIn("alice");
      expect(
        await listingNames(await api.marketplace.list({ category: "cr" })),
      ).toEqual(["Alpha Airtable", "Beta CRM"]);
      expect(
        await listingNames(await api.marketplace.list({ label: "FEAT" })),
      ).toEqual(["Alpha Airtable", "Beta CRM"]);
    },
  },
  {
    id: "marketplace.ordering",
    title: "honors a host ordering over the default",
    world: catalogWorld,
    run: async ({ signIn, expect }) => {
      const api = await signIn("alice");
      expect(
        await listingNames(
          await api.marketplace.list({
            ordering: [{ field: "NAME", direction: "DESC" }],
          }),
        ),
      ).toEqual([
        "Zeta Sales",
        "Gamma Hair Salon",
        "Delta Uncategorized",
        "Beta CRM",
        "Alpha Airtable",
      ]);
    },
  },
  {
    id: "marketplace.categories-labels",
    title:
      "offers every category and label in the marketplace as filter options",
    world: catalogWorld,
    run: async ({ signIn, expect }) => {
      const api = await signIn("alice");
      expect(await api.marketplace.filterOptions()).toEqual({
        categories: ["CRM", "Retail", "Sales"],
        labels: ["beta", "featured"],
      });
    },
  },
  {
    id: "marketplace.activated-filter",
    title:
      "restricts the marketplace to integrations with or without instances",
    world: {
      users: USERS,
      integrations: [multi, single],
      instances: [{ id: "inst-1", name: "One", integrationId: multi.id }],
    },
    run: async ({ signIn, expect }) => {
      const api = await signIn("alice");
      expect(
        await listingNames(await api.marketplace.list({ activated: true })),
      ).toEqual(["Multi"]);
      expect(
        await listingNames(await api.marketplace.list({ activated: false })),
      ).toEqual(["Single"]);
    },
  },
  {
    id: "marketplace.create-permission",
    title: "explains why an instance may or may not be created, per role",
    world: {
      users: USERS,
      integrations: [
        multi,
        single,
        { id: "int-org-only", name: "Org only", isCustomerDeployable: false },
      ],
      instances: [{ id: "inst-1", name: "One", integrationId: single.id }],
    },
    run: async ({ signIn, expect }) => {
      const admin = await signIn("alice");
      expect(
        (await listing(admin, multi.id)).permissions.createInstance,
      ).toEqual(allowed);
      expect(
        (await listing(admin, single.id)).permissions.createInstance,
      ).toEqual(denied("INSTANCE_EXISTS"));
      expect(
        (await listing(admin, "int-org-only")).permissions.createInstance,
      ).toEqual(denied("NOT_CUSTOMER_DEPLOYABLE"));
      const user = await signIn("bob");
      expect(
        (await listing(user, multi.id)).permissions.createInstance,
      ).toEqual(denied("MARKETPLACE_USER"));
    },
  },
  {
    id: "instances.create-deploy-get-list",
    title:
      "creates and deploys an instance, then finds it by id, in the instance list and on the listing",
    world: {
      users: USERS,
      integrations: [multi],
      instances: [{ id: "inst-first", name: "First", integrationId: multi.id }],
    },
    run: async ({ signIn, expect }) => {
      const api = await signIn("alice");
      const integration = await api.marketplace.get(multi.id);
      const created = await integration.createInstance({ name: "Second" });
      const { id } = await created.refresh();
      expect(await (await api.instances.get(id)).refresh()).toMatchObject({
        name: "Second",
        deployed: false,
        enabled: false,
        lifecycle: "notDeployed",
      });
      await (await api.instances.get(id)).deploy();

      expect(await (await api.instances.get(id)).refresh()).toMatchObject({
        name: "Second",
        integrationId: multi.id,
        deployed: true,
        enabled: true,
      });
      const page = await api.instances.list({ integrationId: multi.id });
      expect(await instanceNames(page.instances)).toEqual(["Second", "First"]);
      expect(
        (await instanceNames(await integration.instances())).sort(),
      ).toEqual(["First", "Second"]);
      expect((await listing(api, multi.id)).instances.length).toBe(2);
    },
  },
  {
    id: "instances.single-instance-limit",
    title: "refuses a second instance of a single-instance integration",
    world: {
      users: USERS,
      integrations: [single],
      instances: [{ id: "inst-1", name: "Only", integrationId: single.id }],
    },
    run: async ({ signIn, expect }) => {
      const api = await signIn("alice");
      const integration = await api.marketplace.get(single.id);
      await expect(
        integration.createInstance({ name: "Another" }),
      ).rejects.toThrow();
      expect(
        await instanceNames((await api.instances.list()).instances),
      ).toEqual(["Only"]);
    },
  },
  {
    id: "instances.single-instance-limit-undeployed",
    title:
      "counts a never-deployed instance against a single-instance integration, in the permission and on create",
    world: {
      users: USERS,
      integrations: [single],
      instances: [
        {
          id: "inst-1",
          name: "Unfinished",
          integrationId: single.id,
          deployed: false,
        },
      ],
    },
    run: async ({ signIn, expect }) => {
      const api = await signIn("alice");
      expect(
        (await listing(api, single.id)).permissions.createInstance,
      ).toEqual(denied("INSTANCE_EXISTS"));
      await expect(
        (await api.marketplace.get(single.id)).createInstance({
          name: "Another",
        }),
      ).rejects.toThrow();
      expect(
        await instanceNames((await api.instances.list()).instances),
      ).toEqual(["Unfinished"]);
    },
  },
  {
    id: "instances.list-paging",
    title: "pages instances newest first and narrows them to one integration",
    world: {
      users: USERS,
      integrations: [multi, single],
      instances: [
        { id: "inst-1", name: "Oldest", integrationId: multi.id },
        { id: "inst-2", name: "Middle", integrationId: single.id },
        { id: "inst-3", name: "Newest", integrationId: multi.id },
      ],
    },
    run: async ({ signIn, expect }) => {
      const api = await signIn("alice");
      const first = await api.instances.list({ limit: 2 });
      expect(await instanceNames(first.instances)).toEqual([
        "Newest",
        "Middle",
      ]);
      expect(first.pageInfo.hasNextPage).toBe(true);
      const second = await api.instances.list({
        limit: 2,
        cursor: first.pageInfo.endCursor ?? undefined,
      });
      expect(await instanceNames(second.instances)).toEqual(["Oldest"]);
      expect(second.pageInfo.hasNextPage).toBe(false);
      expect(
        await instanceNames(
          (await api.instances.list({ integrationId: multi.id })).instances,
        ),
      ).toEqual(["Newest", "Oldest"]);
    },
  },
  {
    id: "instances.undeployed-visible",
    title: "lists and gets instances that were never deployed",
    world: {
      users: USERS,
      integrations: [multi],
      instances: [
        { id: "inst-live", name: "Live", integrationId: multi.id },
        {
          id: "inst-unfinished",
          name: "Unfinished",
          integrationId: multi.id,
          deployed: false,
        },
      ],
    },
    run: async ({ signIn, expect }) => {
      const api = await signIn("alice");
      expect(
        await instanceNames((await api.instances.list()).instances),
      ).toEqual(["Unfinished", "Live"]);
      expect(
        await (await api.instances.get("inst-unfinished")).refresh(),
      ).toMatchObject({
        name: "Unfinished",
        deployed: false,
        enabled: false,
        lifecycle: "notDeployed",
      });
      const integration = await api.marketplace.get(multi.id);
      expect(
        (await instanceNames(await integration.instances())).sort(),
      ).toEqual(["Live", "Unfinished"]);
      const created = await integration.createInstance({ name: "Fresh" });
      await created.refresh();
      expect(
        await instanceNames((await api.instances.list()).instances),
      ).toContain("Fresh");
    },
  },
  {
    id: "instances.pause-resume",
    title:
      "pauses and resumes an instance, and the listing's instances show it",
    world: {
      users: USERS,
      integrations: [single],
      instances: [{ id: "inst-1", name: "Running", integrationId: single.id }],
    },
    run: async ({ signIn, expect }) => {
      const api = await signIn("alice");
      const carried = async () =>
        Promise.all(
          (await (await api.marketplace.get(single.id)).instances()).map(
            async (instance) => (await instance.refresh()).lifecycle,
          ),
        );
      expect(await carried()).toEqual(["active"]);
      const instance = await api.instances.get("inst-1");
      await instance.pause();
      expect(await (await api.instances.get("inst-1")).refresh()).toMatchObject(
        { enabled: false, lifecycle: "paused" },
      );
      expect(await carried()).toEqual(["paused"]);
      await instance.resume();
      expect(await (await api.instances.get("inst-1")).refresh()).toMatchObject(
        { enabled: true, lifecycle: "active" },
      );
      expect(await carried()).toEqual(["active"]);
    },
  },
  {
    id: "instances.delete",
    title:
      "deletes an instance: it reads as removed by id, leaves lists, and the listing may be deployed again",
    world: {
      users: USERS,
      integrations: [single],
      instances: [{ id: "inst-1", name: "Doomed", integrationId: single.id }],
    },
    run: async ({ signIn, expect }) => {
      const api = await signIn("alice");
      await (await api.instances.get("inst-1")).delete();
      await expect(api.instances.get("inst-1")).rejects.toMatchObject({
        code: "PRISMATIC_INSTANCE_REMOVED",
      });
      expect((await api.instances.list()).instances).toEqual([]);
      const after = await listing(api, single.id);
      expect(after.instances).toEqual([]);
      expect(after.permissions.createInstance).toEqual(allowed);
    },
  },
  {
    id: "marketplace.instances-across-versions",
    title:
      "a listing carries its instances on every version, never-deployed ones too, and keeps one it upgrades",
    world: {
      users: USERS,
      integrations: [compatV1, compatV2, single],
      instances: [
        { id: "inst-old", name: "On v1", integrationId: compatV1.id },
        {
          id: "inst-new",
          name: "Unfinished on v2",
          integrationId: compatV2.id,
          deployed: false,
        },
        { id: "inst-other", name: "Elsewhere", integrationId: single.id },
      ],
    },
    run: async ({ signIn, expect }) => {
      const api = await signIn("alice");
      const carried = async () => {
        const integration = await api.marketplace.get(compatV2.id);
        const states = await Promise.all(
          (await integration.instances()).map((instance) => instance.refresh()),
        );
        return states.map(({ name, integrationId }) => [name, integrationId]);
      };
      expect(await carried()).toEqual([
        ["Unfinished on v2", compatV2.id],
        ["On v1", compatV1.id],
      ]);
      const page = await api.marketplace.list();
      const listed = await Promise.all(
        page.integrations.map((integration) => current(integration.state())),
      );
      const counts = Object.fromEntries(
        listed.map(({ name, instances }) => [name, instances.length]),
      );
      expect(counts).toMatchObject({ Compatible: 2, Single: 1 });

      const upgraded = await (await api.instances.get("inst-old")).upgrade();
      expect(upgraded).toEqual({ status: "success", data: undefined });
      expect(await carried()).toEqual([
        ["Unfinished on v2", compatV2.id],
        ["On v1", compatV2.id],
      ]);
    },
  },
  {
    id: "configuration.init-save-deploy",
    title: "initializes, saves and deploys a configuration on the same version",
    world: {
      users: USERS,
      integrations: [configured],
      instances: [
        {
          id: "inst-1",
          name: "Configured",
          integrationId: configured.id,
          value: { baseId: "app-old" },
        },
      ],
    },
    run: async ({ signIn, expect }) => {
      const api = await signIn("alice");
      const configuration = await (
        await api.instances.get("inst-1")
      ).configuration();
      expect(await configuration.refresh()).toMatchObject({
        integrationId: configured.id,
        integrationName: "Configured",
        configurationExperience: "headless",
        isUpgrade: false,
        schema: configured.schema,
        configurationVersion: "1",
      });
      expect(await configuration.init({})).toEqual({
        status: "success",
        data: { baseId: "app-default" },
      });
      expect(
        await configuration.save({ value: { baseId: "app-new" } }),
      ).toEqual({ status: "success", data: undefined });

      const saved = await (await api.instances.get("inst-1")).refresh();
      expect(saved.configuration.value).toEqual({ baseId: "app-new" });

      await (await api.instances.get("inst-1")).deploy();
      expect(await (await api.instances.get("inst-1")).refresh()).toMatchObject(
        {
          deployed: true,
          needsDeploy: false,
          configState: "FULLY_CONFIGURED",
          configuration: { value: { baseId: "app-new" } },
        },
      );
      expect(await configuration.refresh()).toMatchObject({
        deployedVersion: 1,
        deployedConfigurationVersion: "1",
      });
    },
  },
  {
    id: "configuration.version-change",
    title:
      "offers an upgrade, initializes and saves against it, then deploys the new version",
    world: {
      users: USERS,
      integrations: [migrateV1, migrateV2],
      instances: [
        {
          id: "inst-1",
          name: "Migrating",
          integrationId: migrateV1.id,
          value: { email: "a@example.test" },
        },
      ],
    },
    run: async ({ signIn, expect }) => {
      const api = await signIn("alice");
      const instance = await api.instances.get("inst-1");
      const current = await instance.configuration();
      expect(await current.refresh()).toMatchObject({
        integrationId: migrateV1.id,
        versionNumber: 1,
        isUpgrade: false,
        configurationVersion: "1",
      });
      const update = (await instance.refresh()).update;
      expect(update).toMatchObject({
        integrationVersionId: migrateV2.id,
        requiresReconfiguration: true,
      });

      const next = await instance.configuration({
        integrationVersionId: migrateV2.id,
      });
      expect(await next.refresh()).toMatchObject({
        integrationId: migrateV2.id,
        integrationName: "Migrate",
        versionNumber: 2,
        isUpgrade: true,
        schema: migrateV2.schema,
        configurationVersion: "2",
        serverFunctions: [{ key: "previewRecipients" }],
      });
      expect(await next.init({})).toEqual({
        status: "success",
        data: { recipients: ["a@example.test"] },
      });
      expect(await (await api.instances.get("inst-1")).refresh()).toMatchObject(
        {
          integrationId: migrateV1.id,
          configuration: { value: { email: "a@example.test" } },
        },
      );
      expect(
        await next.save({
          value: { recipients: ["a@example.test", "b@example.test"] },
        }),
      ).toEqual({ status: "success", data: undefined });

      const moved = {
        integrationId: migrateV2.id,
        versionNumber: 2,
        isUpgrade: false,
        needsDeploy: true,
        deployedVersion: 1,
        deployedConfigurationVersion: "1",
        configurationVersion: "2",
      };
      expect(await next.refresh()).toMatchObject(moved);
      expect(await current.refresh()).toMatchObject(moved);
      expect(await (await api.instances.get("inst-1")).refresh()).toMatchObject(
        {
          integrationId: migrateV2.id,
          integrationVersionNumber: 2,
          needsDeploy: true,
          lifecycle: "pendingChanges",
          configuration: {
            value: { recipients: ["a@example.test", "b@example.test"] },
          },
          update: null,
        },
      );

      await (await api.instances.get("inst-1")).deploy();
      expect(
        (await (await api.instances.get("inst-1")).refresh()).lifecycle,
      ).toBe("active");
      expect(await current.refresh()).toMatchObject({
        integrationId: migrateV2.id,
        needsDeploy: false,
        deployedVersion: 2,
        deployedConfigurationVersion: "2",
      });
    },
  },
  {
    id: "configuration.server-function-on-newer-version",
    title:
      "invokes a newer version's server function before the instance moves to it",
    world: {
      users: USERS,
      integrations: [migrateV1, migrateV2],
      instances: [
        {
          id: "inst-1",
          name: "Migrating",
          integrationId: migrateV1.id,
          value: { email: "a@example.test" },
        },
      ],
    },
    run: async ({ signIn, expect }) => {
      const api = await signIn("alice");
      const instance = await api.instances.get("inst-1");
      expect(
        (await (await instance.configuration()).refresh()).serverFunctions,
      ).toEqual([]);
      const next = await instance.configuration({
        integrationVersionId: migrateV2.id,
      });
      const preview = await next.createServerFunction({
        key: "previewRecipients",
      });
      expect(
        await preview.execute({ inputs: { email: "b@example.test" } }),
      ).toEqual({
        status: "success",
        data: { recipients: ["b@example.test"] },
      });
      expect(await instance.refresh()).toMatchObject({
        integrationId: migrateV1.id,
        needsDeploy: false,
      });
    },
  },
  {
    id: "configuration.permissions-by-role",
    title:
      "lets an admin save but restricts a marketplace user and non-deployable integrations",
    world: {
      users: USERS,
      integrations: [
        configured,
        { id: "int-org-only", name: "Org only", isCustomerDeployable: false },
      ],
      instances: [
        { id: "inst-1", name: "Configured", integrationId: configured.id },
        { id: "inst-2", name: "Org only", integrationId: "int-org-only" },
      ],
    },
    run: async ({ signIn, expect }) => {
      const admin = await signIn("alice");
      const permissions = async (api: PrismaticApi, instanceId: string) =>
        (
          await (
            await (await api.instances.get(instanceId)).configuration()
          ).refresh()
        ).permissions;
      expect(await permissions(admin, "inst-1")).toMatchObject({
        save: allowed,
      });
      expect(await permissions(admin, "inst-2")).toMatchObject({
        save: denied("role-restricted"),
      });
      const user = await signIn("bob");
      expect(await permissions(user, "inst-1")).toMatchObject({
        save: denied("role-restricted"),
      });
    },
  },
  {
    id: "instances.permissions-by-role-and-state",
    title:
      "lets an admin deploy, pause, resume and remove as the instance's state allows, and restricts a marketplace user and non-deployable integrations",
    world: {
      users: USERS,
      integrations: [
        multi,
        { id: "int-org-only", name: "Org only", isCustomerDeployable: false },
      ],
      instances: [
        { id: "inst-running", name: "Running", integrationId: multi.id },
        {
          id: "inst-paused",
          name: "Paused",
          integrationId: multi.id,
          enabled: false,
        },
        {
          id: "inst-unfinished",
          name: "Unfinished",
          integrationId: multi.id,
          deployed: false,
        },
        { id: "inst-org", name: "Org only", integrationId: "int-org-only" },
      ],
    },
    run: async ({ signIn, expect }) => {
      const permissions = async (api: PrismaticApi, instanceId: string) =>
        (await (await api.instances.get(instanceId)).refresh()).permissions;
      const restricted = denied("role-restricted");
      const admin = await signIn("alice");
      expect(await permissions(admin, "inst-running")).toMatchObject({
        deploy: allowed,
        pause: allowed,
        resume: denied("not-paused"),
        remove: allowed,
      });
      expect(await permissions(admin, "inst-paused")).toMatchObject({
        pause: denied("already-paused"),
        resume: allowed,
      });
      expect(await permissions(admin, "inst-unfinished")).toMatchObject({
        deploy: allowed,
        pause: denied("not-deployed"),
        resume: denied("not-deployed"),
        remove: allowed,
      });
      expect(await permissions(admin, "inst-org")).toMatchObject({
        deploy: restricted,
        pause: restricted,
        resume: restricted,
        remove: restricted,
      });
      const user = await signIn("bob");
      expect(await permissions(user, "inst-running")).toMatchObject({
        deploy: restricted,
        pause: restricted,
        resume: restricted,
        remove: restricted,
      });
    },
  },
  {
    id: "instances.update-and-upgrade",
    title:
      "offers each instance's newer version, upgrades without reconfiguring when the configuration version is unchanged, and refuses when it changes",
    world: {
      users: USERS,
      integrations: [compatV1, compatV2, migrateV1, migrateV2],
      instances: [
        {
          id: "inst-compat",
          name: "Compatible",
          integrationId: compatV1.id,
          value: { region: "us" },
        },
        {
          id: "inst-migrate",
          name: "Migrating",
          integrationId: migrateV1.id,
          value: { email: "a@example.test" },
        },
        {
          id: "inst-locked",
          name: "Locked",
          integrationId: compatV1.id,
          upgradeable: false,
        },
      ],
    },
    run: async ({ signIn, expect }) => {
      const read = async (api: PrismaticApi, id: string) =>
        (await api.instances.get(id)).refresh();
      const user = await signIn("bob");
      expect((await read(user, "inst-compat")).permissions.upgrade).toEqual(
        denied("role-restricted"),
      );
      expect(
        await (await user.instances.get("inst-compat")).upgrade(),
      ).toMatchObject({
        status: "error",
        error: { code: "PRISMATIC_CONFIGURATION_FORBIDDEN" },
      });

      const admin = await signIn("alice");
      expect(await read(admin, "inst-compat")).toMatchObject({
        update: {
          integrationVersionId: compatV2.id,
          versionNumber: 2,
          requiresReconfiguration: false,
        },
        permissions: { upgrade: allowed },
      });
      expect(await read(admin, "inst-migrate")).toMatchObject({
        update: {
          integrationVersionId: migrateV2.id,
          versionNumber: 2,
          requiresReconfiguration: true,
        },
        permissions: { upgrade: denied("requires-reconfiguration") },
      });
      expect((await read(admin, "inst-locked")).permissions.upgrade).toEqual(
        denied("role-restricted"),
      );

      expect(
        await (await admin.instances.get("inst-migrate")).upgrade(),
      ).toMatchObject({
        status: "error",
        error: { code: "PRISMATIC_CONFIGURATION_FORBIDDEN" },
      });
      expect(await read(admin, "inst-migrate")).toMatchObject({
        integrationId: migrateV1.id,
        needsDeploy: false,
      });

      const compat = await admin.instances.get("inst-compat");
      expect(await compat.upgrade()).toEqual({
        status: "success",
        data: undefined,
      });
      expect(await read(admin, "inst-compat")).toMatchObject({
        integrationId: compatV2.id,
        integrationVersionNumber: 2,
        needsDeploy: true,
        lifecycle: "pendingChanges",
        update: null,
        configuration: { value: { region: "us" } },
        permissions: { upgrade: denied("no-update") },
      });
      await compat.deploy();
      expect(await read(admin, "inst-compat")).toMatchObject({
        integrationVersionNumber: 2,
        lifecycle: "active",
        configuration: { value: { region: "us" } },
      });
    },
  },
  {
    id: "instances.saved-configuration",
    title:
      "shows an instance's saved configuration and only the signed-in user's personal configuration beside it",
    world: {
      users: USERS,
      integrations: [configured, personal],
      instances: [
        {
          id: "inst-configured",
          name: "Configured",
          integrationId: configured.id,
          value: { baseId: "app-old" },
        },
        { id: "inst-personal", name: "Personal", integrationId: personal.id },
      ],
    },
    run: async ({ signIn, expect }) => {
      const read = async (api: PrismaticApi, id: string) =>
        (await api.instances.get(id)).refresh();
      const alice = await signIn("alice");
      expect(await read(alice, "inst-configured")).toMatchObject({
        configuration: {
          value: { baseId: "app-old" },
          configurationVersion: "1",
        },
        userConfiguration: null,
        update: null,
      });
      expect((await read(alice, "inst-personal")).userConfiguration).toEqual({
        value: null,
        configurationVersion: null,
        configured: false,
      });
      const personalOf = await (
        await alice.instances.get("inst-personal")
      ).userConfiguration();
      await personalOf.save({ value: { channel: "#alice" } });
      expect((await read(alice, "inst-personal")).userConfiguration).toEqual({
        value: { channel: "#alice" },
        configurationVersion: null,
        configured: true,
      });

      const bob = await signIn("bob");
      expect((await read(bob, "inst-personal")).userConfiguration).toEqual({
        value: null,
        configurationVersion: null,
        configured: false,
      });
    },
  },
  {
    id: "user-configuration.per-user",
    title:
      "saves and removes a personal configuration for the signed-in user only",
    world: {
      users: USERS,
      integrations: [personal],
      instances: [
        { id: "inst-1", name: "Personal", integrationId: personal.id },
      ],
    },
    run: async ({ signIn, expect }) => {
      const personalOf = async (api: PrismaticApi) =>
        (await api.instances.get("inst-1")).userConfiguration();

      const alice = await personalOf(await signIn("alice"));
      expect(await alice.refresh()).toMatchObject({
        value: null,
        configured: false,
        schema: personal.userConfigurationSchema,
      });
      expect(await alice.save({ value: { channel: "#alice" } })).toEqual({
        status: "success",
        data: undefined,
      });
      expect(await alice.refresh()).toMatchObject({
        value: { channel: "#alice" },
        permissions: { save: allowed, remove: allowed },
      });

      const bob = await personalOf(await signIn("bob"));
      expect((await bob.refresh()).value).toBe(null);
      expect(await bob.save({ value: { channel: "#bob" } })).toEqual({
        status: "success",
        data: undefined,
      });
      expect((await bob.refresh()).value).toEqual({ channel: "#bob" });
      expect(await bob.remove()).toEqual({
        status: "success",
        data: undefined,
      });
      expect(await bob.refresh()).toMatchObject({
        value: null,
        configured: false,
      });

      const aliceAgain = await personalOf(await signIn("alice"));
      expect((await aliceAgain.refresh()).value).toEqual({ channel: "#alice" });
    },
  },
  {
    id: "instances.update-details",
    title: "renames an instance and sets one flow's API keys, leaving the rest",
    world: {
      users: USERS,
      integrations: [single],
      instances: [
        {
          id: "inst-1",
          name: "Before",
          integrationId: single.id,
          flows: [
            { id: "flow-a", name: "A", apiKeys: ["key-a"] },
            { id: "flow-b", name: "B", apiKeys: ["key-b"] },
          ],
        },
      ],
    },
    run: async ({ signIn, expect }) => {
      const api = await signIn("alice");
      const instance = await api.instances.get("inst-1");
      expect(
        await instance.updateDetails({
          name: "After",
          flows: [{ flowId: "flow-a", apiKeys: ["new-a", "newer-a"] }],
        }),
      ).toEqual({ status: "success", data: undefined });

      const state = await (await api.instances.get("inst-1")).refresh();
      expect(state.name).toBe("After");
      expect(
        state.flows.map(({ name, apiKeys }) => ({ name, apiKeys })),
      ).toEqual([
        { name: "A", apiKeys: ["new-a", "newer-a"] },
        { name: "B", apiKeys: ["key-b"] },
      ]);
    },
  },
  {
    id: "instances.list-omits-flow-keys",
    title:
      "listed instances carry their flows without API keys, even after a refresh",
    world: {
      users: USERS,
      integrations: [single],
      instances: [
        {
          id: "inst-1",
          name: "Keyed",
          integrationId: single.id,
          flows: [{ id: "flow-a", name: "A", apiKeys: ["key-a"] }],
        },
      ],
    },
    run: async ({ signIn, expect }) => {
      const api = await signIn("alice");
      const flowKeys = (state: { flows: readonly { apiKeys?: unknown }[] }) =>
        state.flows.map((flow) => "apiKeys" in flow);
      const [listed] = (await api.instances.list()).instances;
      expect(flowKeys(await current(listed.state()))).toEqual([false]);
      const [carried] = await (
        await api.marketplace.get(single.id)
      ).instances();
      expect(flowKeys(await current(carried.state()))).toEqual([false]);
      expect(flowKeys(await listed.refresh())).toEqual([false]);
    },
  },
  {
    id: "instances.detail-read-loads-flow-keys",
    title: "a detail read of one instance shows each flow's API keys",
    world: {
      users: USERS,
      integrations: [single],
      instances: [
        {
          id: "inst-1",
          name: "Keyed",
          integrationId: single.id,
          flows: [
            { id: "flow-a", name: "A", apiKeys: ["key-a"] },
            { id: "flow-b", name: "B" },
          ],
        },
      ],
    },
    run: async ({ signIn, expect }) => {
      const api = await signIn("alice");
      const instance = await api.instances.get("inst-1");
      const detail = await instance.refreshDetail();
      expect(
        detail.flows.map(({ name, apiKeys }) => ({ name, apiKeys })),
      ).toEqual([
        { name: "A", apiKeys: ["key-a"] },
        { name: "B", apiKeys: [] },
      ]);
      expect(
        (await current(instance.state())).flows.map(({ apiKeys }) => apiKeys),
      ).toEqual([["key-a"], []]);
    },
  },
  {
    id: "instances.list-after-detail-keeps-flow-keys",
    title: "listing instances again keeps the API keys a detail read loaded",
    world: {
      users: USERS,
      integrations: [single],
      instances: [
        {
          id: "inst-1",
          name: "Keyed",
          integrationId: single.id,
          flows: [{ id: "flow-a", name: "A", apiKeys: ["key-a"] }],
        },
      ],
    },
    run: async ({ signIn, expect }) => {
      const api = await signIn("alice");
      await (await api.instances.get("inst-1")).refreshDetail();
      const [listed] = (await api.instances.list()).instances;
      const [carried] = await (
        await api.marketplace.get(single.id)
      ).instances();
      for (const instance of [listed, carried])
        expect(
          (await current(instance.state())).flows.map(({ apiKeys }) => apiKeys),
        ).toEqual([["key-a"]]);
      expect(
        (await listed.refresh()).flows.map(({ apiKeys }) => apiKeys),
      ).toEqual([["key-a"]]);
    },
  },
  {
    id: "instances.update-details-rejected",
    title:
      "rejects invalid or forbidden detail changes with a code and changes nothing",
    world: {
      users: USERS,
      integrations: [single],
      instances: [
        {
          id: "inst-1",
          name: "Stable",
          integrationId: single.id,
          flows: [
            { id: "flow-a", name: "A", apiKeys: ["key-a"] },
            { id: "flow-locked", name: "Locked", updatable: false },
          ],
        },
      ],
    },
    run: async ({ signIn, expect }) => {
      const api = await signIn("alice");
      const instance = await api.instances.get("inst-1");
      expect(await instance.updateDetails({ name: "  " })).toMatchObject({
        status: "error",
        error: { code: "PRISMATIC_CONFIGURATION_INVALID" },
      });
      expect(
        await instance.updateDetails({
          flows: [
            { flowId: "flow-a", apiKeys: ["x"] },
            { flowId: "flow-a", apiKeys: ["y"] },
          ],
        }),
      ).toMatchObject({
        status: "error",
        error: { code: "PRISMATIC_CONFIGURATION_INVALID" },
      });
      expect(
        await instance.updateDetails({
          flows: [{ flowId: "flow-locked", apiKeys: ["x"] }],
        }),
      ).toMatchObject({
        status: "error",
        error: { code: "PRISMATIC_CONFIGURATION_FORBIDDEN" },
      });
      const state = await (await api.instances.get("inst-1")).refresh();
      expect(state.name).toBe("Stable");
      expect(state.flows.map(({ apiKeys }) => apiKeys)).toEqual([
        ["key-a"],
        [],
      ]);
      expect(
        state.flows.map(({ permissions }) => permissions.updateApiKeys),
      ).toEqual([allowed, denied("role-restricted")]);
    },
  },
  {
    id: "configuration.server-function",
    title:
      "invokes a server function and reports a failed invocation as a Result",
    world: {
      users: USERS,
      integrations: [configured],
      instances: [
        { id: "inst-1", name: "Configured", integrationId: configured.id },
      ],
    },
    run: async ({ signIn, expect }) => {
      const api = await signIn("alice");
      const configuration = await (
        await api.instances.get("inst-1")
      ).configuration();
      const state = await configuration.refresh();
      expect(state.serverFunctions.map(({ key }) => key)).toEqual([
        "echo",
        "listTables",
      ]);
      expect(state.serverFunctions.map(({ permission }) => permission)).toEqual(
        [allowed, allowed],
      );
      const echo = await configuration.createServerFunction({ key: "echo" });
      expect(await echo.execute({ inputs: { baseId: "app-1" } })).toEqual({
        status: "success",
        data: { echoed: { baseId: "app-1" } },
      });
      const listTables = await configuration.createServerFunction({
        key: "listTables",
      });
      expect(await listTables.execute({ inputs: {} })).toMatchObject({
        status: "error",
        error: {
          code: "PRISMATIC_CONFIGURATION_INVALID",
          message: "A base is required",
        },
      });
    },
  },
  {
    id: "configuration.connection-options",
    title:
      "offers, per caller, the connections a customer may use, each the connection read by its id",
    world: {
      users: USERS,
      integrations: [configured, single],
      instances: [
        { id: "inst-1", name: "Configured", integrationId: configured.id },
        { id: "inst-2", name: "Plain", integrationId: single.id },
      ],
      connections: [...CUSTOMER_CONNECTIONS, ...ORG_CONNECTIONS],
    },
    run: async ({ signIn, expect }) => {
      const api = await signIn("alice");
      const optionsOf = async (instanceId: string) =>
        (
          await (await api.instances.get(instanceId)).configuration()
        ).readConnectionOptions();
      const labelsOf = (
        requirements: Awaited<ReturnType<typeof optionsOf>>["init"],
      ) =>
        Promise.all(
          requirements.map(async ({ key, options }) => ({
            key,
            options: await Promise.all(
              options.map(
                async (option) => (await current(option.state())).label,
              ),
            ),
          })),
        );

      const options = await optionsOf("inst-1");
      expect(await labelsOf(options.init)).toEqual([
        { key: "airtable", options: ["Our Airtable"] },
      ]);
      expect(Object.keys(options.serverFunctions).sort()).toEqual([
        "echo",
        "listTables",
      ]);
      expect(await labelsOf(options.serverFunctions.echo ?? [])).toEqual([
        { key: "slack", options: ["Team Slack"] },
      ]);
      expect(options.serverFunctions.listTables).toEqual([]);

      const [offered] = options.init[0]?.options ?? [];
      if (!offered) throw new Error("Nothing offered for airtable");
      const state = await current(offered.state());
      expect(
        await current((await api.connections.get(state.id)).state()),
      ).toEqual(state);

      expect(await optionsOf("inst-2")).toEqual({
        init: [],
        serverFunctions: {},
      });
    },
  },
  {
    id: "connections.customer-visible",
    title:
      "lists only the connections a customer may use, and reads each one by its id",
    world: {
      users: USERS,
      integrations: [single],
      connections: [...CUSTOMER_CONNECTIONS, ...ORG_CONNECTIONS],
    },
    run: async ({ signIn, expect }) => {
      const api = await signIn("alice");
      const facts = async (
        filter?: Parameters<typeof api.connections.list>[0],
      ) =>
        (
          await Promise.all(
            (
              await api.connections.list(filter)
            ).map(async (connection) => {
              const { label, kind, status, definition } = await current(
                connection.state(),
              );
              return { label, kind, status, definition: definition.stableKey };
            }),
          )
        ).sort((a, b) => a.label.localeCompare(b.label));
      expect(await facts()).toEqual([
        {
          label: "Alice's Gmail",
          kind: "userActivated",
          status: "ACTIVE",
          definition: "gmail-connection",
        },
        {
          label: "Our Airtable",
          kind: "manualCustomerActivated",
          status: "PENDING",
          definition: "own-airtable",
        },
        {
          label: "Team Slack",
          kind: "customerActivated",
          status: "ACTIVE",
          definition: "slack-connection",
        },
      ]);
      expect(
        (await facts({ kind: "customerActivated" })).map(({ label }) => label),
      ).toEqual(["Team Slack"]);

      for (const connection of await api.connections.list()) {
        const listed = await current(connection.state());
        const read = await current(
          (await api.connections.get(listed.id)).state(),
        );
        expect(read).toEqual(listed);
      }

      for (const hidden of ORG_CONNECTIONS) {
        const refusal = await api.connections
          .get(worldConnectionId(hidden))
          .then(
            () => null,
            (error: unknown) => error,
          );
        expect(refusal).toMatchObject({
          code: "PRISMATIC_CONNECTION_NOT_FOUND",
        });
      }
    },
  },
  {
    id: "connections.permissions",
    title:
      "says, per connection, whether the user can connect or disconnect it and why not",
    world: {
      users: USERS,
      integrations: [single],
      connections: OAUTH_CONNECTIONS,
    },
    run: async ({ signIn, expect }) => {
      const api = await signIn("alice");
      const reasons = Object.fromEntries(
        await Promise.all(
          (await api.connections.list()).map(async (connection) => {
            const state = await current(connection.state());
            return [state.label, permissionReasons(state)];
          }),
        ),
      );
      expect(reasons).toEqual({
        "Team Slack": { connect: null, disconnect: "NOT_CONNECTED" },
        "Sales Slack": { connect: "ALREADY_CONNECTED", disconnect: null },
        "Expired Slack": { connect: null, disconnect: null },
        "Alice's Gmail": { connect: "ALREADY_CONNECTED", disconnect: null },
        "Service Account": { connect: "CLIENT_CREDENTIALS", disconnect: null },
        "Our Airtable": { connect: "NOT_OAUTH", disconnect: "NOT_OAUTH" },
      });
    },
  },
  {
    id: "connections.authorize",
    title:
      "hands out an https consent screen and follows the authorization to its outcome without another read",
    world: {
      users: USERS,
      integrations: [single],
      connections: OAUTH_CONNECTIONS,
    },
    run: async ({ signIn, expect, backend }) => {
      const api = await signIn("alice");
      const pending = OAUTH_CONNECTIONS[0] as WorldConnection;
      const connection = await api.connections.get(worldConnectionId(pending));
      const reader = connection.state();
      const authorization = await connection.authorize();
      expect(authorization).toMatchObject({ status: "success" });
      if (authorization.status !== "success") return;
      expect(new URL(authorization.data.url).protocol).toBe("https:");

      backend.setConnectionStatus(pending.name, "ACTIVE");
      expect(
        permissionReasons(
          await until(reader, ({ status }) => status === "ACTIVE"),
        ),
      ).toEqual({ connect: "ALREADY_CONNECTED", disconnect: null });
      expect(await connection.authorize()).toMatchObject({
        status: "error",
        error: { code: "PRISMATIC_CONNECTION_FORBIDDEN" },
      });

      const airtable = await api.connections.get(
        worldConnectionId(OAUTH_CONNECTIONS[5] as WorldConnection),
      );
      expect(await airtable.authorize()).toMatchObject({
        status: "error",
        error: { code: "PRISMATIC_CONNECTION_FORBIDDEN" },
      });
    },
  },
  {
    id: "connections.authorize-refused",
    title: "follows an authorization the provider refuses to its failure",
    world: {
      users: USERS,
      integrations: [single],
      connections: OAUTH_CONNECTIONS,
    },
    run: async ({ signIn, expect, backend }) => {
      const api = await signIn("alice");
      const pending = OAUTH_CONNECTIONS[0] as WorldConnection;
      const connection = await api.connections.get(worldConnectionId(pending));
      const reader = connection.state();
      expect(await connection.authorize()).toMatchObject({ status: "success" });

      backend.setConnectionStatus(pending.name, "FAILED");
      expect(
        permissionReasons(
          await until(reader, ({ status }) => status === "FAILED"),
        ),
      ).toEqual({ connect: null, disconnect: null });
    },
  },
  {
    id: "connections.disconnect",
    title:
      "disconnects a connected credential, customer or personal, back to pending, and refuses one with nothing to disconnect",
    world: {
      users: USERS,
      integrations: [single],
      connections: OAUTH_CONNECTIONS,
    },
    run: async ({ signIn, expect }) => {
      const api = await signIn("alice");
      for (const named of [OAUTH_CONNECTIONS[1], OAUTH_CONNECTIONS[3]]) {
        const id = worldConnectionId(named as WorldConnection);
        const connection = await api.connections.get(id);
        expect(await connection.disconnect()).toMatchObject({
          status: "success",
          data: { status: "PENDING" },
        });
        const reread = await current((await api.connections.get(id)).state());
        expect(reread.status).toBe("PENDING");
        expect(permissionReasons(reread)).toEqual({
          connect: null,
          disconnect: "NOT_CONNECTED",
        });
        expect(await connection.disconnect()).toMatchObject({
          status: "error",
          error: { code: "PRISMATIC_CONNECTION_FORBIDDEN" },
        });
      }
    },
  },
  {
    id: "connections.create",
    title:
      "lets a customer admin make a credential for a requirement, which is then offered for it, and refuses a marketplace user",
    world: {
      users: USERS,
      integrations: [withNewConnections, single],
      instances: [
        {
          id: "inst-1",
          name: "Configured",
          integrationId: withNewConnections.id,
        },
      ],
      connections: OAUTH_CONNECTIONS,
    },
    run: async ({ signIn, expect }) => {
      const optionsOf = async (api: PrismaticApi) =>
        (
          await (await api.instances.get("inst-1")).configuration()
        ).readConnectionOptions();
      const alice = await signIn("alice");
      const [slack] = (await optionsOf(alice)).init;
      expect(slack).toMatchObject({
        key: "slack",
        template: { oauth2Type: "authorization_code" },
        permissions: { createConnection: { allowed: true, reason: null } },
      });
      if (!slack?.template) throw new Error("No template for slack");

      const created = await alice.connections.create({
        templateId: slack.template.id,
        label: "Support Slack",
      });
      expect(created).toMatchObject({ status: "success" });
      if (created.status !== "success") return;
      const made = await current(created.data.state());
      expect(made).toMatchObject({
        label: "Support Slack",
        kind: "customerActivated",
        status: "PENDING",
      });
      expect(permissionReasons(made)).toEqual({
        connect: null,
        disconnect: "NOT_CONNECTED",
      });
      const offered = await Promise.all(
        ((await optionsOf(alice)).init[0]?.options ?? []).map(
          async (option) => (await current(option.state())).label,
        ),
      );
      expect(offered).toContain("Support Slack");
      expect(offered).toContain("Team Slack");

      const bob = await signIn("bob");
      expect((await optionsOf(bob)).init[0]?.permissions).toEqual({
        createConnection: { allowed: false, reason: "ROLE_RESTRICTED" },
      });
      expect(
        await bob.connections.create({ templateId: slack.template.id }),
      ).toMatchObject({
        status: "error",
        error: { code: "PRISMATIC_CONNECTION_FORBIDDEN" },
      });
    },
  },
  {
    id: "connections.create-refused-client-credentials",
    title:
      "keeps a client-credentials credential the provider refuses, reports the failure, and offers it for its requirement",
    world: {
      users: USERS,
      integrations: [refusedClientCredentials],
      instances: [
        {
          id: "inst-1",
          name: "Configured",
          integrationId: refusedClientCredentials.id,
        },
      ],
    },
    run: async ({ signIn, expect }) => {
      const api = await signIn("alice");
      const optionsOf = async () =>
        (
          await (await api.instances.get("inst-1")).configuration()
        ).readConnectionOptions();
      const [ledger] = (await optionsOf()).init;
      if (!ledger?.template) throw new Error("No template for ledger");
      expect(ledger.options).toEqual([]);

      expect(
        await api.connections.create({
          templateId: ledger.template.id,
          label: "Books",
        }),
      ).toMatchObject({
        status: "error",
        error: { code: "PRISMATIC_CONNECT_FAILED" },
      });

      const offered = await Promise.all(
        ((await optionsOf()).init[0]?.options ?? []).map(async (option) => {
          const { label, status } = await current(option.state());
          return { label, status };
        }),
      );
      expect(offered).toEqual([{ label: "Books", status: "PENDING" }]);
    },
  },
  {
    id: "connections.user-level",
    title:
      "serves each user only their own user-level connections, which they can connect and disconnect",
    world: {
      users: USERS,
      integrations: [userLevel],
      instances: [
        { id: "inst-1", name: "Personal", integrationId: userLevel.id },
      ],
      connections: USER_LEVEL_CONNECTIONS,
    },
    run: async ({ signIn, expect, backend }) => {
      const [aliceCrm, bobCrm] = USER_LEVEL_CONNECTIONS as [
        WorldConnection,
        WorldConnection,
      ];
      const listed = async (api: PrismaticApi) =>
        Promise.all(
          (await api.connections.list()).map(async (connection) => {
            const state = await current(connection.state());
            return {
              label: state.label,
              kind: state.kind,
              status: state.status,
              ...permissionReasons(state),
            };
          }),
        );

      const alice = await signIn("alice");
      expect(await listed(alice)).toEqual([
        {
          label: "crm",
          kind: "userLevel",
          status: "PENDING",
          connect: null,
          disconnect: "NOT_CONNECTED",
        },
      ]);
      const [mine] = await alice.connections.list();
      if (!mine) throw new Error("Nothing listed for alice");
      const listedState = await current(mine.state());
      const connection = await alice.connections.get(listedState.id);
      expect(await current(connection.state())).toEqual(listedState);
      const theirs = await alice.connections
        .get(worldConnectionId(bobCrm))
        .then(
          () => null,
          (error: unknown) => error,
        );
      expect(theirs).toMatchObject({ code: "PRISMATIC_CONNECTION_NOT_FOUND" });

      const reader = connection.state();
      const authorization = await connection.authorize();
      expect(authorization).toMatchObject({ status: "success" });
      if (authorization.status !== "success") return;
      expect(new URL(authorization.data.url).protocol).toBe("https:");
      backend.setConnectionStatus(aliceCrm.name, "ACTIVE");
      expect(
        permissionReasons(
          await until(reader, ({ status }) => status === "ACTIVE"),
        ),
      ).toEqual({ connect: "ALREADY_CONNECTED", disconnect: null });

      expect(await connection.disconnect()).toMatchObject({
        status: "success",
        data: { status: "PENDING" },
      });
      expect(
        (await current((await alice.connections.get(listedState.id)).state()))
          .status,
      ).toBe("PENDING");

      const bob = await signIn("bob");
      expect(await listed(bob)).toEqual([
        {
          label: "crm",
          kind: "userLevel",
          status: "ACTIVE",
          connect: "ALREADY_CONNECTED",
          disconnect: null,
        },
      ]);
    },
  },
];
