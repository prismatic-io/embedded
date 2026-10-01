import { expect, test } from "vitest";
import { eventually, openApp, type World } from "./harness.js";

const orders: World = {
  users: { alice: "admin" },
  integrations: [
    {
      id: "orders",
      allowMultipleInstances: true,
      personalConfiguration: {},
    },
  ],
  instances: [
    {
      id: "store",
      integrationId: "orders",
      name: "Store",
      flows: [{ id: "receive", name: "Receive order", apiKeys: ["old"] }],
    },
    { id: "unfinished", integrationId: "orders", deployed: false },
  ],
  personalConfigurations: [
    { user: "alice", instanceId: "store", value: {} },
    { user: "bob", instanceId: "store", value: {} },
  ],
};

const store = { kind: "instance", id: "store" } as const;
const unfinished = { kind: "instance", id: "unfinished" } as const;

test("the app reads an instance with its flows", async () => {
  const { app } = await openApp(orders);

  expect(await app.readResource("instance", "store")).toMatchObject({
    status: "ready",
    data: {
      name: "Store",
      deployed: true,
      enabled: true,
      lifecycle: "active",
      flows: [{ id: "receive", name: "Receive order", apiKeys: ["old"] }],
    },
  });
});

const receiveWithoutKeys = [{ id: "receive", name: "Receive order" }];
const receiveWithKeys = [
  { id: "receive", name: "Receive order", apiKeys: ["old"] },
];

type App = Awaited<ReturnType<typeof openApp>>["app"];

const storeRowFlows = async (app: App) =>
  (await app.readList("instances")).rows.find(({ id }) => id === "store")
    ?.flows;

const storeCarriedFlows = async (app: App) => {
  const listing = await app.readResource("listing", "orders");
  return listing.status === "ready"
    ? listing.data.instances.find(({ id }) => id === "store")?.flows
    : undefined;
};

test("instance list rows and a listing's instances never carry flow API keys", async () => {
  const { app } = await openApp(orders);

  expect(await storeRowFlows(app)).toEqual(receiveWithoutKeys);
  await app.refresh({ list: "instances" });
  expect(await storeRowFlows(app)).toEqual(receiveWithoutKeys);
  expect(await storeCarriedFlows(app)).toEqual(receiveWithoutKeys);
});

test("an instance's own screen shows its flows' API keys, even after a list read it", async () => {
  const { app } = await openApp(orders);

  expect(await storeRowFlows(app)).toEqual(receiveWithoutKeys);
  await eventually(async () =>
    expect(await app.readResource("instance", "store")).toMatchObject({
      status: "ready",
      data: { flows: receiveWithKeys },
    }),
  );
});

test("listing again after the instance's own screen loaded its flow API keys keeps them", async () => {
  const { app } = await openApp(orders);

  expect(await app.readResource("instance", "store")).toMatchObject({
    data: { flows: receiveWithKeys },
  });
  await app.refresh({ list: "instances" });
  expect(await storeRowFlows(app)).toEqual(receiveWithKeys);
  await app.refresh({ kind: "listing", id: "orders" });
  expect(await storeCarriedFlows(app)).toEqual(receiveWithKeys);
  await app.unmount();
  expect(await storeRowFlows(app)).toEqual(receiveWithKeys);
});

test("a failed flow API key read on the instance's own screen leaves it ready without keys until a refresh", async () => {
  const { app, backend } = await openApp(orders);
  backend.failNext("instances.flowApiKeys");

  expect(await app.readResource("instance", "store")).toMatchObject({
    status: "ready",
    data: { flows: receiveWithoutKeys },
  });
  await app.rerender();
  expect(await app.readResource("instance", "store")).toMatchObject({
    status: "ready",
    data: { flows: receiveWithoutKeys },
  });

  expect(await app.refresh(store)).toMatchObject({ status: "success" });
  expect(await app.readResource("instance", "store")).toMatchObject({
    status: "ready",
    data: { flows: receiveWithKeys },
  });
});

test("a failed flow API key read after a list read the instance leaves it ready without keys until a refresh", async () => {
  const { app, backend } = await openApp(orders);
  expect(await storeRowFlows(app)).toEqual(receiveWithoutKeys);
  const stalled = backend.hold("instances.flowApiKeys");
  backend.failNext("instances.flowApiKeys");

  await app.readResource("instance", "store");
  await stalled.reached;
  stalled.release();
  // A later read in the same session answers only after the failed key read has.
  await app.readResource("listing", "orders");
  expect(await app.readResource("instance", "store")).toMatchObject({
    status: "ready",
    data: { flows: receiveWithoutKeys },
  });

  expect(await app.refresh(store)).toMatchObject({ status: "success" });
  expect(await app.readResource("instance", "store")).toMatchObject({
    status: "ready",
    data: { flows: receiveWithKeys },
  });
});

const withNextVersion: World = {
  ...orders,
  integrations: [
    ...(orders.integrations ?? []),
    { id: "orders-v2", versionNumber: 2, listed: false },
  ],
};

test("a version move that brings new flows loads their API keys on the instance's own screen", async () => {
  const { app, backend } = await openApp(withNextVersion);
  expect(await app.readResource("instance", "store")).toMatchObject({
    data: { flows: receiveWithKeys },
  });

  const refund = { id: "refund", name: "Refund order", apiKeys: ["refund"] };
  backend.upgradeElsewhere("store", {
    to: "orders-v2",
    flows: [...receiveWithKeys, refund],
  });
  await app.refresh({ list: "instances" });
  await eventually(async () =>
    expect(await app.readResource("instance", "store")).toMatchObject({
      status: "ready",
      data: { versionNumber: 2, flows: [...receiveWithKeys, refund] },
    }),
  );
});

test("refreshing an instance its own screen loaded keeps its flows' API keys current", async () => {
  const { app, backend } = await openApp(orders);
  expect(await app.readResource("instance", "store")).toMatchObject({
    data: { flows: receiveWithKeys },
  });

  backend.setFlowApiKeysElsewhere("store", "receive", ["new"]);
  expect(await app.refresh(store)).toMatchObject({ status: "success" });
  expect(await app.readResource("instance", "store")).toMatchObject({
    data: {
      flows: [{ id: "receive", name: "Receive order", apiKeys: ["new"] }],
    },
  });
});

test("every instance list includes never-deployed instances, newest first", async () => {
  const { app } = await openApp(orders);

  for (const filter of [undefined, { integrationId: "orders" }]) {
    const { status, rows, hasMore } = await app.readList("instances", filter);
    expect(status).toBe("ready");
    expect(rows.map(({ id, lifecycle }) => ({ id, lifecycle }))).toEqual([
      { id: "unfinished", lifecycle: "notDeployed" },
      { id: "store", lifecycle: "active" },
    ]);
    expect(hasMore).toBe(false);
  }
});

const twoIntegrations: World = {
  ...orders,
  integrations: [
    ...(orders.integrations ?? []),
    { id: "billing", allowMultipleInstances: true },
  ],
  instances: [
    ...(orders.instances ?? []),
    { id: "invoices", integrationId: "billing" },
  ],
};

test("an instance list narrows to one integration", async () => {
  const { app } = await openApp(twoIntegrations);

  expect(
    (await app.readList("instances", { integrationId: "billing" })).rows.map(
      ({ id }) => id,
    ),
  ).toEqual(["invoices"]);
  expect((await app.readList("instances")).rows.map(({ id }) => id)).toEqual([
    "invoices",
    "unfinished",
    "store",
  ]);
});

test("an instance list pages newest first, fetching only the next page each time", async () => {
  const { app, backend } = await openApp(twoIntegrations);
  const paged = { list: "instances", filter: { pageSize: 1 } } as const;

  expect(await app.readList("instances", paged.filter)).toMatchObject({
    rows: [{ id: "invoices" }],
    hasMore: true,
  });
  const before = backend.served("instances.list");
  await app.execute(paged, "nextPage");
  await app.execute(paged, "nextPage");
  expect(backend.served("instances.list")).toBe(before + 2);
  expect(await app.readList("instances", paged.filter)).toMatchObject({
    rows: [{ id: "invoices" }, { id: "unfinished" }, { id: "store" }],
    hasMore: false,
  });
});

test("an instance list shows one page at a time in replace mode and goes back", async () => {
  const { app } = await openApp(twoIntegrations);
  const filter = { pageSize: 2, onPageLoad: "replace" } as const;
  const paged = { list: "instances", filter } as const;

  expect(await app.readList("instances", filter)).toMatchObject({
    rows: [{ id: "invoices" }, { id: "unfinished" }],
    hasMore: true,
    hasPrevious: false,
  });
  await app.execute(paged, "nextPage");
  expect(await app.readList("instances", filter)).toMatchObject({
    rows: [{ id: "store" }],
    hasMore: false,
    hasPrevious: true,
  });
  await app.execute(paged, "previousPage");
  expect(await app.readList("instances", filter)).toMatchObject({
    rows: [{ id: "invoices" }, { id: "unfinished" }],
    hasPrevious: false,
  });
});

test("pausing from a list row shows on the instance's own screen, and resuming there shows on the row, with no extra read", async () => {
  const { app, backend } = await openApp(orders);
  const row = { list: "instances", item: "store" } as const;
  await app.readResource("instance", "store");
  await app.readList("instances");
  const reads = backend.served("instances.get");

  expect(await app.execute(row, "pause")).toMatchObject({
    status: "success",
  });
  expect(backend.instance("store")?.enabled).toBe(false);
  await eventually(async () => {
    expect(await app.readResource("instance", "store")).toMatchObject({
      data: { enabled: false, lifecycle: "paused" },
    });
    expect(
      await app.readListItem("instances", undefined, "store"),
    ).toMatchObject({ data: { enabled: false, lifecycle: "paused" } });
  });

  expect(await app.execute(store, "resume")).toMatchObject({
    status: "success",
  });
  await eventually(async () =>
    expect(
      await app.readListItem("instances", undefined, "store"),
    ).toMatchObject({ data: { enabled: true, lifecycle: "active" } }),
  );
  expect(backend.served("instances.get")).toBe(reads);
});

test("a row and the instance's own screen share one action status: a second deploy from either is refused as busy", async () => {
  const { app, backend } = await openApp(orders);
  const row = { list: "instances", item: "unfinished" } as const;
  await app.readResource("instance", "unfinished");
  await app.readList("instances");

  const stalled = backend.hold("configuration.deploy");
  const deploying = app.execute(row, "deploy");
  await stalled.reached;
  expect(await app.execute(unfinished, "deploy")).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_ACTION_BUSY" },
  });
  stalled.release();
  expect(await deploying).toEqual({ status: "success", data: undefined });
  await eventually(async () =>
    expect(await app.readResource("instance", "unfinished")).toMatchObject({
      data: { deployed: true },
    }),
  );
});

test("creating an instance adds it to the lists it belongs to, which stay on screen meanwhile", async () => {
  const { app } = await openApp(twoIntegrations);
  await app.readList("instances");
  await app.readList("instances", { integrationId: "orders" });
  await app.readList("instances", { integrationId: "billing" });

  expect(
    await app.execute({ kind: "listing", id: "orders" }, "activate", {
      name: "Second store",
    }),
  ).toMatchObject({ status: "success" });

  await eventually(async () => {
    for (const filter of [undefined, { integrationId: "orders" }]) {
      const list = await app.readList("instances", filter);
      expect(list.status).toBe("ready");
      expect(list.rows[0]).toMatchObject({
        name: "Second store",
        lifecycle: "notDeployed",
      });
    }
  });
  expect(
    (await app.readList("instances", { integrationId: "billing" })).rows.map(
      ({ id }) => id,
    ),
  ).toEqual(["invoices"]);
});

test("removing an instance from a list row drops it from every list and reports it gone on its own screen", async () => {
  const { app, backend } = await openApp(twoIntegrations);
  await app.readResource("instance", "store");
  await app.readList("instances");
  await app.readList("instances", { integrationId: "orders" });

  expect(
    await app.execute(
      { list: "instances", filter: { integrationId: "orders" }, item: "store" },
      "remove",
    ),
  ).toMatchObject({ status: "success" });

  expect(backend.instance("store")).toBeUndefined();
  await eventually(async () => {
    expect((await app.readList("instances")).rows.map(({ id }) => id)).toEqual([
      "invoices",
      "unfinished",
    ]);
    expect(
      (await app.readList("instances", { integrationId: "orders" })).rows.map(
        ({ id }) => id,
      ),
    ).toEqual(["unfinished"]);
    expect(await app.readResource("instance", "store")).toMatchObject({
      status: "error",
      error: { code: "PRISMATIC_INSTANCE_REMOVED" },
    });
  });
});

test("renaming and replacing then clearing a flow's API keys reach the backend and the screen", async () => {
  const { app, backend } = await openApp(orders);

  expect(await app.execute(store, "rename", { name: "Renamed" })).toEqual({
    status: "success",
    data: undefined,
  });
  expect(
    await app.execute(store, "setFlowApiKeys", {
      flowId: "receive",
      apiKeys: ["new"],
    }),
  ).toMatchObject({ status: "success" });
  expect(backend.instance("store")).toMatchObject({
    name: "Renamed",
    flows: [{ id: "receive", apiKeys: ["new"] }],
  });
  await eventually(async () =>
    expect(await app.readResource("instance", "store")).toMatchObject({
      data: { name: "Renamed", flows: [{ apiKeys: ["new"] }] },
    }),
  );

  await app.execute(store, "setFlowApiKeys", {
    flowId: "receive",
    apiKeys: [],
  });
  expect(backend.instance("store")?.flows).toEqual([
    { id: "receive", apiKeys: [] },
  ]);
  await eventually(async () =>
    expect(await app.readResource("instance", "store")).toMatchObject({
      data: { flows: [{ apiKeys: [] }] },
    }),
  );
});

test("a blank name is refused and nothing changes", async () => {
  const { app, backend } = await openApp(orders);

  expect(await app.execute(store, "rename", { name: " " })).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_CONFIGURATION_INVALID" },
  });
  expect(backend.instance("store")?.name).toBe("Store");
});

test("pausing and resuming flip whether the instance runs", async () => {
  const { app, backend } = await openApp(orders);

  for (const [action, enabled] of [
    ["pause", false],
    ["resume", true],
  ] as const) {
    expect(await app.execute(store, action)).toMatchObject({
      status: "success",
    });
    expect(backend.instance("store")?.enabled).toBe(enabled);
    await eventually(async () =>
      expect(await app.readResource("instance", "store")).toMatchObject({
        data: { enabled, lifecycle: enabled ? "active" : "paused" },
      }),
    );
  }
});

test("a never-deployed instance is read by its id, can't be paused, deploys once while a second deploy is refused as busy, then runs", async () => {
  const { app, backend } = await openApp(orders);
  expect(await app.readResource("instance", "unfinished")).toMatchObject({
    status: "ready",
    data: {
      deployed: false,
      enabled: false,
      lifecycle: "notDeployed",
      blockedBy: {
        deploy: null,
        pause: "not-deployed",
        resume: "not-deployed",
        remove: null,
      },
    },
  });

  expect(await app.execute(unfinished, "pause")).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_CONFIGURATION_INVALID" },
  });

  const stalled = backend.hold("configuration.deploy");
  const deploying = app.execute(unfinished, "deploy");
  await stalled.reached;
  expect(await app.execute(unfinished, "deploy")).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_ACTION_BUSY" },
  });
  stalled.release();
  expect(await deploying).toEqual({ status: "success", data: undefined });

  expect(backend.instance("unfinished")).toMatchObject({
    deployed: true,
    enabled: true,
  });
  await eventually(async () =>
    expect(await app.readResource("instance", "unfinished")).toMatchObject({
      data: { deployed: true, enabled: true },
    }),
  );
});

test("which of pause and resume is available follows whether the instance runs", async () => {
  const { app } = await openApp(orders);
  expect(await app.readResource("instance", "store")).toMatchObject({
    data: {
      blockedBy: {
        deploy: null,
        pause: null,
        resume: "not-paused",
        remove: null,
        rename: null,
      },
    },
  });

  expect(await app.execute(store, "pause")).toMatchObject({
    status: "success",
  });

  await eventually(async () =>
    expect(await app.readResource("instance", "store")).toMatchObject({
      data: { blockedBy: { pause: "already-paused", resume: null } },
    }),
  );
});

test("a marketplace user may read an instance but not deploy, pause, resume or remove it", async () => {
  const { app } = await openApp(
    { ...orders, users: { alice: "admin", bob: "user" } },
    { as: "bob" },
  );
  const restricted = "role-restricted";

  for (const id of ["store", "unfinished"])
    expect(await app.readResource("instance", id)).toMatchObject({
      status: "ready",
      data: {
        blockedBy: {
          deploy: restricted,
          pause: restricted,
          resume: restricted,
          remove: restricted,
        },
      },
    });
});

test("a deployed instance deploys again without piling anything up", async () => {
  const { app, backend } = await openApp(orders);

  for (let round = 0; round < 3; round += 1)
    expect(await app.execute(store, "deploy")).toMatchObject({
      status: "success",
    });

  expect(backend.instance("store")).toMatchObject({
    deployed: true,
    needsDeploy: false,
  });
});

test("removing an instance deletes it; its screens then report it gone", async () => {
  const { app, backend } = await openApp(orders);
  await app.readResource("personalConfiguration", "store");

  expect(await app.execute(store, "remove")).toMatchObject({
    status: "success",
  });

  expect(backend.instance("store")).toBeUndefined();
  await eventually(async () => {
    expect(await app.readResource("instance", "store")).toMatchObject({
      status: "error",
      error: { code: "PRISMATIC_INSTANCE_REMOVED" },
    });
    expect(
      await app.readResource("personalConfiguration", "store"),
    ).toMatchObject({
      status: "error",
      error: { code: "PRISMATIC_INSTANCE_REMOVED" },
    });
  });
});

test("removing a never-deployed instance deletes it", async () => {
  const { app, backend } = await openApp(orders);

  expect(await app.execute(unfinished, "remove")).toMatchObject({
    status: "success",
  });

  expect(backend.instance("unfinished")).toBeUndefined();
});

test("after another user signs in, the same screen acts as that user", async () => {
  const { app, backend } = await openApp(orders);
  await app.readResource("instance", "store");

  await app.signInAs("bob:1");
  expect(await app.execute(store, "rename", { name: "Bob's" })).toMatchObject({
    status: "success",
  });

  expect(backend.instance("store")?.name).toBe("Bob's");
});

test("an instance shows its saved configuration and the signed-in user's own settings beside it", async () => {
  const { app } = await openApp({
    ...orders,
    instances: [
      { id: "store", integrationId: "orders", value: { region: "us" } },
    ],
    personalConfigurations: [
      { user: "alice", instanceId: "store", value: { channel: "#alice" } },
      { user: "bob", instanceId: "store", value: { channel: "#bob" } },
    ],
  });

  expect(await app.readResource("instance", "store")).toMatchObject({
    data: {
      configuration: { value: { region: "us" }, version: "orders-definition" },
      personalConfiguration: { saved: true, value: { channel: "#alice" } },
      update: null,
    },
  });
  await app.signInAs("carol:1");
  await eventually(async () =>
    expect(await app.readResource("instance", "store")).toMatchObject({
      data: { personalConfiguration: { saved: false, value: null } },
    }),
  );
});

test("an instance whose integration asks users for nothing has no personal settings", async () => {
  const { app } = await openApp(twoIntegrations);

  expect(await app.readResource("instance", "invoices")).toMatchObject({
    data: { personalConfiguration: null },
  });
});

const upgrades = ({
  sameConfigurationVersion,
  users,
}: {
  sameConfigurationVersion: boolean;
  users?: World["users"];
}): World => ({
  users: users ?? { alice: "admin" },
  integrations: [
    {
      id: "crm-v1",
      upgradeTo: "crm-v2",
      listed: false,
      configurationVersion: "1",
    },
    {
      id: "crm-v2",
      versionNumber: 2,
      configurationVersion: sameConfigurationVersion ? "1" : "2",
    },
  ],
  instances: [
    { id: "acme", integrationId: "crm-v1", value: { region: "us" } },
    {
      id: "locked",
      integrationId: "crm-v1",
      value: { region: "eu" },
      upgradeable: false,
    },
  ],
});

const acme = { kind: "instance", id: "acme" } as const;

test("an update that keeps the configuration version upgrades without review, keeps the saved values and waits for a deploy", async () => {
  const { app, backend } = await openApp(
    upgrades({ sameConfigurationVersion: true }),
  );
  await app.readList("instances");
  expect(await app.readResource("instance", "acme")).toMatchObject({
    data: {
      update: { to: "crm-v2", versionNumber: 2, needsReview: false },
      blockedBy: { upgrade: null },
    },
  });

  expect(await app.execute(acme, "upgrade")).toEqual({
    status: "success",
    data: undefined,
  });

  expect(backend.instance("acme")).toMatchObject({
    integrationId: "crm-v2",
    versionNumber: 2,
    needsDeploy: true,
    value: { region: "us" },
  });
  const upgraded = {
    integrationId: "crm-v2",
    versionNumber: 2,
    lifecycle: "pendingChanges",
    update: null,
    configuration: { value: { region: "us" } },
    blockedBy: { upgrade: "no-update" },
  };
  await eventually(async () => {
    expect(await app.readResource("instance", "acme")).toMatchObject({
      data: upgraded,
    });
    expect(
      await app.readListItem("instances", undefined, "acme"),
    ).toMatchObject({ data: upgraded });
  });

  expect(await app.execute(acme, "deploy")).toMatchObject({
    status: "success",
  });
  expect(backend.instance("acme")).toMatchObject({
    versionNumber: 2,
    needsDeploy: false,
    value: { region: "us" },
  });
});

test("an update that changes the configuration version needs review: upgrading is refused and nothing changes", async () => {
  const { app, backend } = await openApp(
    upgrades({ sameConfigurationVersion: false }),
  );
  const before = backend.instance("acme");

  expect(await app.readResource("instance", "acme")).toMatchObject({
    data: {
      update: { to: "crm-v2", versionNumber: 2, needsReview: true },
      blockedBy: { upgrade: "requires-reconfiguration" },
    },
  });
  expect(await app.execute(acme, "upgrade")).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_CONFIGURATION_FORBIDDEN" },
  });
  expect(backend.instance("acme")).toEqual(before);
});

test("a marketplace user, and an instance the organization keeps customers from upgrading, can't upgrade", async () => {
  const { app, backend } = await openApp(
    upgrades({
      sameConfigurationVersion: true,
      users: { alice: "admin", bob: "user" },
    }),
  );
  const restricted = { blockedBy: { upgrade: "role-restricted" } };

  expect(await app.readResource("instance", "locked")).toMatchObject({
    data: { update: { needsReview: false }, ...restricted },
  });
  expect(
    await app.execute({ kind: "instance", id: "locked" }, "upgrade"),
  ).toMatchObject({ status: "error" });
  expect(backend.instance("locked")?.integrationId).toBe("crm-v1");

  await app.signInAs("bob:1");
  await eventually(async () =>
    expect(await app.readResource("instance", "acme")).toMatchObject({
      data: restricted,
    }),
  );
  expect(await app.execute(acme, "upgrade")).toMatchObject({
    status: "error",
  });
  expect(backend.instance("acme")?.integrationId).toBe("crm-v1");
});
