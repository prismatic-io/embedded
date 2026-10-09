import type {
  ConfigurationTarget,
  MarketplaceIntegrationState,
} from "../protocol/index.js";
import { expect, test } from "vitest";
import {
  type FakeEmbeddedRole,
  FakeCollection,
  FakePreAuthApi,
  FakePrismaticApi,
  type FakeStores,
  fakeInstanceState,
  fakeIntegrationState,
} from "./fakeFrame.js";

const NO_EMISSION = Symbol("no emission");

const boot = async ({
  integrations = [fakeIntegrationState({ id: "int-1" })],
  instances = [],
  role,
}: {
  integrations?: MarketplaceIntegrationState[];
  instances?: ReturnType<typeof fakeInstanceState>[];
  role?: FakeEmbeddedRole;
} = {}) => {
  let n = 0;
  const stores: FakeStores = {
    connections: new FakeCollection(),
    integrations: new FakeCollection(integrations),
    instances: new FakeCollection(
      instances.map((state) => ({ ...state, value: undefined })),
    ),
    configurations: {},
    templates: [],
    nextId: (prefix) => `${prefix}-${++n}`,
    roleOf: role && (() => role),
  };
  const api = await new FakePreAuthApi(stores).authenticate("alice:t1");
  return { stores, api };
};

/** Resolves the next emission, or {@link NO_EMISSION} if none arrives promptly. */
const nextOf = <T>(reader: ReadableStreamDefaultReader<T>) => {
  const pending = reader.read().then(({ value }) => value);
  return {
    pending,
    soon: () =>
      Promise.race([
        pending,
        new Promise<typeof NO_EMISSION>((resolve) =>
          setTimeout(() => resolve(NO_EMISSION), 20),
        ),
      ]),
  };
};

test("an outside change reaches open streams only once the session reads it again", async () => {
  const seeded = fakeIntegrationState({ id: "int-1", name: "Old" });
  const { stores, api } = await boot({ integrations: [seeded] });
  const listing = await api.marketplace.get("int-1");
  const reader = listing.state().getReader();
  expect((await reader.read()).value?.name).toBe("Old");

  stores.integrations.set({ ...seeded, name: "New" });
  const next = nextOf(reader);
  expect(await next.soon()).toBe(NO_EMISSION);

  await api.marketplace.get("int-1");
  expect((await next.pending)?.name).toBe("New");
});

test("a re-read that changes nothing emits nothing", async () => {
  const { api } = await boot();
  const listing = await api.marketplace.get("int-1");
  const reader = listing.state().getReader();
  await reader.read();
  const next = nextOf(reader);
  await api.marketplace.list();
  expect(await next.soon()).toBe(NO_EMISSION);
});

test("a listing's instances and createInstance permission follow create and delete", async () => {
  const { api } = await boot();
  const listing = await api.marketplace.get("int-1");
  const reader = listing.state().getReader();
  const carried = async () => {
    const state = (await reader.read()).value;
    return {
      instances: state?.instances.length,
      createInstance: state?.permissions.createInstance,
    };
  };
  const allowed = { allowed: true, reason: null };
  const instanceExists = { allowed: false, reason: "INSTANCE_EXISTS" };
  expect(await carried()).toEqual({ instances: 0, createInstance: allowed });

  const instance = await listing.createInstance({ name: "Unfinished" });
  expect(await carried()).toEqual({
    instances: 1,
    createInstance: instanceExists,
  });

  await instance.delete();
  expect(await carried()).toEqual({ instances: 0, createInstance: allowed });
});

test("a listing carries the instances of every version joined to it by an upgrade", async () => {
  const { stores, api } = await boot({
    integrations: [fakeIntegrationState({ id: "int-v2" })],
    instances: [
      fakeInstanceState({ id: "on-v1", integrationId: "int-v1" }),
      fakeInstanceState({ id: "elsewhere", integrationId: "int-other" }),
      fakeInstanceState({ id: "on-v2", integrationId: "int-v2" }),
    ],
  });
  stores.configurations["int-v1"] = {
    schema: {},
    upgradeTarget: {
      integrationId: "int-v2",
      versionNumber: 2,
      configurationVersion: "1",
    },
  };
  const listing = await api.marketplace.get("int-v2");
  const reader = listing.state().getReader();
  expect((await reader.read()).value?.instances).toEqual([
    { id: "on-v2" },
    { id: "on-v1" },
  ]);
  expect(
    await Promise.all(
      (await listing.instances()).map(
        async (instance) => (await instance.refresh()).id,
      ),
    ),
  ).toEqual(["on-v2", "on-v1"]);
});

test("an instance is disabled until its first deploy enables it", async () => {
  const { api } = await boot();
  const listing = await api.marketplace.get("int-1");
  const instance = await listing.createInstance({ name: "Unfinished" });
  expect((await instance.refresh()).enabled).toBe(false);
  await instance.deploy();
  expect((await instance.refresh()).enabled).toBe(true);
});

test("permissions derive from the session's role", async () => {
  const { api } = await boot({
    role: {
      isCustomerMarketplaceUser: true,
      isCustomerMarketplaceAdmin: false,
    },
    instances: [
      fakeInstanceState({
        id: "inst-1",
        integrationId: "int-1",
        deployed: true,
      }),
    ],
  });
  const listing = await api.marketplace.get("int-1");
  expect((await listing.state().getReader().read()).value?.permissions).toEqual(
    { createInstance: { allowed: false, reason: "MARKETPLACE_USER" } },
  );
  const configuration = await (
    await api.instances.get("inst-1")
  ).configuration();
  const { permissions } = await configuration.refresh();
  expect(permissions.save).toEqual({
    allowed: false,
    reason: "role-restricted",
  });
  expect(permissions).not.toHaveProperty("deploy");
  const restricted = { allowed: false, reason: "role-restricted" };
  expect(
    (await (await api.instances.get("inst-1")).refresh()).permissions,
  ).toMatchObject({
    deploy: restricted,
    pause: restricted,
    resume: restricted,
    remove: restricted,
  });
});

test("pausing and resuming follow the instance's state", async () => {
  const { api } = await boot();
  const listing = await api.marketplace.get("int-1");
  const instance = await listing.createInstance({ name: "Unfinished" });
  expect((await instance.refresh()).permissions).toMatchObject({
    deploy: { allowed: true },
    pause: { allowed: false, reason: "not-deployed" },
    resume: { allowed: false, reason: "not-deployed" },
    remove: { allowed: true },
  });
  await instance.deploy();
  expect((await instance.refresh()).permissions).toMatchObject({
    pause: { allowed: true },
    resume: { allowed: false, reason: "not-paused" },
  });
  await instance.pause();
  expect((await instance.refresh()).permissions).toMatchObject({
    pause: { allowed: false, reason: "already-paused" },
    resume: { allowed: true },
  });
});

test("a state built with an update, saved values or personal settings keeps them", () => {
  const update = {
    integrationVersionId: "int-2",
    versionNumber: 2,
    requiresReconfiguration: false,
  };
  const configuration = { value: { region: "us" }, configurationVersion: "1" };
  const userConfiguration = {
    value: { name: "Alice" },
    configurationVersion: null,
    configured: true,
  };
  const state = fakeInstanceState({
    id: "inst-1",
    integrationId: "int-1",
    deployed: true,
    update,
    configuration,
    userConfiguration,
  });
  expect(state).toMatchObject({ update, configuration, userConfiguration });
  expect(state.permissions.upgrade).toEqual({ allowed: true, reason: null });
});

test("removal follows the seeded remove flag, not updates", async () => {
  const { api } = await boot({
    instances: [
      fakeInstanceState({
        id: "inst-1",
        integrationId: "int-1",
        deployed: true,
        permissions: { remove: { allowed: false, reason: "role-restricted" } },
      }),
    ],
  });
  const { permissions } = await (await api.instances.get("inst-1")).refresh();
  expect(permissions.updateDetails).toEqual({ allowed: true, reason: null });
  expect(permissions.remove).toEqual({
    allowed: false,
    reason: "role-restricted",
  });
});

test("an integration without authored configuration serves an empty schema", async () => {
  const { api } = await boot({
    instances: [
      fakeInstanceState({
        id: "inst-1",
        integrationId: "int-1",
        deployed: true,
      }),
    ],
  });
  const configuration = await (
    await api.instances.get("inst-1")
  ).configuration();
  expect((await configuration.refresh()).schema).toEqual({});
});

test("a deleted instance answers results, and released targets answer ACTION_DISPOSED", async () => {
  const { api } = await boot({
    instances: [
      fakeInstanceState({
        id: "inst-1",
        integrationId: "int-1",
        deployed: true,
      }),
    ],
  });
  const instance = await api.instances.get("inst-1");
  const configuration = await instance.configuration();
  const action = await configuration.createServerFunction({ key: "fn" });
  await instance.delete();
  expect(await configuration.save({ value: {} })).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_INSTANCE_REMOVED" },
  });

  (configuration as ConfigurationTarget & Disposable)[Symbol.dispose]();
  expect(await action.execute({ inputs: {} })).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_ACTION_DISPOSED" },
  });
  await expect(configuration.save({ value: {} })).rejects.toMatchObject({
    code: "PRISMATIC_ACTION_DISPOSED",
  });
});

test("marketplace pages carry opaque cursors over category, then name, ordering", async () => {
  const { api } = await boot({
    integrations: [
      fakeIntegrationState({ id: "uncategorized", name: "A", category: null }),
      fakeIntegrationState({ id: "crm-b", name: "B", category: "CRM" }),
      fakeIntegrationState({ id: "crm-a", name: "A", category: "CRM" }),
      fakeIntegrationState({ id: "erp", name: "A", category: "ERP" }),
    ],
  });
  const ids = async (page: { integrations: unknown[] }) =>
    Promise.all(
      page.integrations.map(async (target) => {
        const reader = (
          target as { state(): ReadableStream<MarketplaceIntegrationState> }
        )
          .state()
          .getReader();
        return (await reader.read()).value?.id;
      }),
    );
  const first = await api.marketplace.list({ limit: 2 });
  expect(await ids(first)).toEqual(["crm-a", "crm-b"]);
  expect(first.pageInfo.endCursor).not.toMatch(/^\d+$/);
  const second = await api.marketplace.list({
    limit: 2,
    cursor: first.pageInfo.endCursor ?? undefined,
  });
  expect(await ids(second)).toEqual(["erp", "uncategorized"]);
  expect(second.pageInfo.hasNextPage).toBe(false);

  const byName = await api.marketplace.list({
    ordering: [{ field: "NAME", direction: "DESC" }],
  });
  expect((await ids(byName))[0]).toBe("crm-b");
});

test("instance pages list the newest first", async () => {
  const { api } = await boot({
    instances: [
      fakeInstanceState({
        id: "older",
        integrationId: "int-1",
        deployed: true,
      }),
      fakeInstanceState({
        id: "newer",
        integrationId: "int-1",
        deployed: true,
      }),
    ],
  });
  const page = await api.instances.list();
  const ids = await Promise.all(
    page.instances.map(async (instance) => (await instance.refresh()).id),
  );
  expect(ids).toEqual(["newer", "older"]);
});

test("flow API keys a detail read loaded stay with that session, even for the same user", async () => {
  const { stores, api: first } = await boot({
    instances: [
      fakeInstanceState({
        id: "keyed",
        integrationId: "int-1",
        deployed: true,
        flows: [
          {
            id: "flow-a",
            name: "A",
            stableId: null,
            scheduleFromDeployer: false,
            schedule: null,
            webhookUrl: "https://hooks.example.test/a",
            apiKeys: ["key-a"],
            endpointSecurityType: "CUSTOMER_OPTIONAL",
            permissions: { updateApiKeys: { allowed: true, reason: null } },
          },
        ],
      }),
    ],
  });
  const second = await new FakePreAuthApi(stores).authenticate("alice:t2");
  const keysOf = async (api: FakePrismaticApi) =>
    (await (await api.instances.get("keyed")).refresh()).flows.map(
      ({ apiKeys }) => apiKeys,
    );

  await (await second.instances.get("keyed")).refreshDetail();
  expect(await keysOf(first)).toEqual([undefined]);
  expect(await keysOf(second)).toEqual([["key-a"]]);

  await (await first.instances.get("keyed")).refreshDetail();
  FakePrismaticApi.revoke(first);
  expect(await keysOf(second)).toEqual([["key-a"]]);
});
