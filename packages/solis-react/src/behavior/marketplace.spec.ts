import { expect, test } from "vitest";
import { eventually, openApp, type World } from "./harness.js";

const catalog: World = {
  users: { alice: "admin", bob: "user" },
  integrations: [
    {
      id: "crm",
      name: "CRM",
      category: "Sales",
      labels: ["support"],
      allowMultipleInstances: true,
    },
    {
      id: "ledger",
      name: "Ledger",
      category: "Accounting",
      labels: ["finance", "support"],
    },
    {
      id: "chat",
      name: "Chat",
      category: "Sales",
      labels: [],
      configurationExperience: "hosted",
    },
  ],
};

const crm = { kind: "listing", id: "crm" } as const;

test("the app reads a listing, and whether this user may activate it", async () => {
  const { app } = await openApp(catalog);

  expect(await app.readResource("listing", "crm")).toMatchObject({
    status: "ready",
    data: {
      name: "CRM",
      category: "Sales",
      canActivate: true,
      instances: [],
    },
  });
});

test("each listing says whether the host renders its configuration or the hosted wizard does", async () => {
  const { app } = await openApp(catalog);

  expect(await app.readResource("listing", "chat")).toMatchObject({
    data: { configurationExperience: "hosted" },
  });
  const marketplace = await app.readList("marketplace");
  expect(
    marketplace.rows.map(({ name, configurationExperience }) => [
      name,
      configurationExperience,
    ]),
  ).toEqual(
    expect.arrayContaining([
      ["CRM", "headless"],
      ["Ledger", "headless"],
      ["Chat", "hosted"],
    ]),
  );
});

test("without an id the listing stays loading and the backend is never asked", async () => {
  const { app, backend } = await openApp(catalog);

  expect(await app.readResource("listing", null)).toEqual({
    status: "loading",
  });
  expect(backend.served("marketplace.get")).toBe(0);
});

test("a missing listing is a not-found error, and it reads once it is published and refreshed", async () => {
  const { app, backend } = await openApp(catalog);

  expect(await app.readResource("listing", "missing")).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_MARKETPLACE_INTEGRATION_NOT_FOUND" },
  });

  backend.publishListing({ id: "missing", name: "Found" });
  expect(await app.refresh({ kind: "listing", id: "missing" })).toMatchObject({
    status: "success",
  });
  expect(await app.readResource("listing", "missing")).toMatchObject({
    status: "ready",
    data: { name: "Found" },
  });
});

test("a change made elsewhere shows up after refresh", async () => {
  const { app, backend } = await openApp(catalog);
  await app.readResource("listing", "crm");

  backend.publishListing({ id: "crm", name: "CRM Live" });
  await app.refresh(crm);

  expect(await app.readResource("listing", "crm")).toMatchObject({
    data: { name: "CRM Live" },
  });
});

test("a failed refresh keeps the listing on screen", async () => {
  const { app, backend } = await openApp(catalog);
  await app.readResource("listing", "crm");
  backend.failNext("marketplace.get");

  expect(await app.refresh(crm)).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_UNKNOWN" },
  });
  expect(await app.readResource("listing", "crm")).toMatchObject({
    status: "ready",
    data: { name: "CRM", canActivate: true },
    refreshing: false,
  });
});

test("a second refresh while one runs is refused as busy, and the first still lands", async () => {
  const { app, backend } = await openApp(catalog);
  await app.readResource("listing", "crm");
  backend.publishListing({ id: "crm", name: "CRM Live" });
  const stalled = backend.hold("marketplace.get");

  const first = app.refresh(crm);
  await stalled.reached;
  expect(await app.refresh(crm)).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_ACTION_BUSY" },
  });
  expect(await app.readResource("listing", "crm")).toMatchObject({
    status: "ready",
    data: { name: "CRM" },
    refreshing: true,
  });
  stalled.release();

  expect(await first).toMatchObject({ status: "success" });
  expect(await app.readResource("listing", "crm")).toMatchObject({
    status: "ready",
    data: { name: "CRM Live" },
    refreshing: false,
  });
});

test("a marketplace user signing in sees the same listing without activation rights", async () => {
  const { app } = await openApp(catalog);
  await app.readResource("listing", "crm");

  await app.signInAs("bob:1");

  await eventually(async () =>
    expect(await app.readResource("listing", "crm")).toMatchObject({
      status: "ready",
      data: { canActivate: false, activationBlockedBy: "MARKETPLACE_USER" },
    }),
  );
});

test("the marketplace lists every listing, and narrows by search, category and label", async () => {
  const { app } = await openApp(catalog);
  const names = async (filter?: Parameters<typeof app.readList>[1]) =>
    (await app.readList("marketplace", filter)).rows.map(({ name }) => name);

  expect(await names()).toEqual(["Ledger", "CRM", "Chat"]);
  expect(await names({ search: "led" })).toEqual(["Ledger"]);
  expect(await names({ category: "Sales" })).toEqual(["CRM", "Chat"]);
  expect(await names({ label: "support" })).toEqual(["Ledger", "CRM"]);
});

test("the marketplace pages through listings until there are no more", async () => {
  const { app } = await openApp(catalog);
  const paged = { list: "marketplace", filter: { pageSize: 2 } } as const;

  expect(await app.readList("marketplace", { pageSize: 2 })).toMatchObject({
    status: "ready",
    rows: [{ name: "Ledger" }, { name: "CRM" }],
    hasMore: true,
  });

  expect(await app.execute(paged, "nextPage")).toMatchObject({
    status: "success",
  });
  expect(await app.readList("marketplace", { pageSize: 2 })).toMatchObject({
    rows: [{ name: "Ledger" }, { name: "CRM" }, { name: "Chat" }],
    hasMore: false,
  });
});

test("paging fetches only the next page, and the listings already shown stay put", async () => {
  const { app, backend } = await openApp(catalog);
  const paged = { list: "marketplace", filter: { pageSize: 1 } } as const;
  await app.readList("marketplace", { pageSize: 1 });
  const before = backend.served("marketplace.list");

  await app.execute(paged, "nextPage");
  await app.execute(paged, "nextPage");

  expect(backend.served("marketplace.list")).toBe(before + 2);
  expect(await app.readList("marketplace", { pageSize: 1 })).toMatchObject({
    rows: [{ name: "Ledger" }, { name: "CRM" }, { name: "Chat" }],
    hasMore: false,
    hasPrevious: false,
  });
});

test("a next page that fails keeps the listings shown, and paging again recovers", async () => {
  const { app, backend } = await openApp(catalog);
  const paged = { list: "marketplace", filter: { pageSize: 2 } } as const;
  await app.readList("marketplace", { pageSize: 2 });
  backend.failNext("marketplace.list");

  expect(await app.execute(paged, "nextPage")).toMatchObject({
    status: "error",
  });
  expect(await app.readList("marketplace", { pageSize: 2 })).toMatchObject({
    status: "ready",
    rows: [{ name: "Ledger" }, { name: "CRM" }],
    hasMore: true,
  });

  expect(await app.execute(paged, "nextPage")).toMatchObject({
    status: "success",
  });
  expect(
    (await app.readList("marketplace", { pageSize: 2 })).rows.map(
      ({ name }) => name,
    ),
  ).toEqual(["Ledger", "CRM", "Chat"]);
});

test("one page at a time, the marketplace pages forward and back", async () => {
  const { app } = await openApp(catalog);
  const filter = { pageSize: 2, onPageLoad: "replace" } as const;
  const paged = { list: "marketplace", filter } as const;

  expect(await app.readList("marketplace", filter)).toMatchObject({
    rows: [{ name: "Ledger" }, { name: "CRM" }],
    hasMore: true,
    hasPrevious: false,
  });

  await app.execute(paged, "nextPage");
  expect(await app.readList("marketplace", filter)).toMatchObject({
    rows: [{ name: "Chat" }],
    hasMore: false,
    hasPrevious: true,
  });

  await app.execute(paged, "previousPage");
  expect(await app.readList("marketplace", filter)).toMatchObject({
    rows: [{ name: "Ledger" }, { name: "CRM" }],
    hasMore: true,
    hasPrevious: false,
  });
});

test("one page at a time, the current page stays on screen until the next one is ready", async () => {
  const { app, backend } = await openApp(catalog);
  const filter = { pageSize: 2, onPageLoad: "replace" } as const;
  await app.readList("marketplace", filter);
  const stalled = backend.hold("marketplace.list");

  const next = app.execute({ list: "marketplace", filter }, "nextPage");
  await stalled.reached;
  expect(await app.readList("marketplace", filter)).toMatchObject({
    status: "ready",
    rows: [{ name: "Ledger" }, { name: "CRM" }],
  });
  stalled.release();

  expect(await next).toMatchObject({ status: "success" });
  expect(await app.readList("marketplace", filter)).toMatchObject({
    rows: [{ name: "Chat" }],
  });
});

test("going back to a page the marketplace has since shrunk past starts again from the first page", async () => {
  const { app, backend } = await openApp(catalog);
  const filter = { pageSize: 1, onPageLoad: "replace" } as const;
  const paged = { list: "marketplace", filter } as const;
  await app.readList("marketplace", filter);
  await app.execute(paged, "nextPage");
  await app.execute(paged, "nextPage");
  expect(await app.readList("marketplace", filter)).toMatchObject({
    rows: [{ name: "Chat" }],
    hasPrevious: true,
  });

  backend.withdrawListing("ledger");
  backend.withdrawListing("crm");
  expect(await app.execute(paged, "previousPage")).toMatchObject({
    status: "success",
  });

  expect(await app.readList("marketplace", filter)).toMatchObject({
    rows: [{ name: "Chat" }],
    hasMore: false,
    hasPrevious: false,
  });
});

test("a listing that moved across a page boundary shows once", async () => {
  const { app, backend } = await openApp(catalog);
  const paged = { list: "marketplace", filter: { pageSize: 2 } } as const;
  await app.readList("marketplace", { pageSize: 2 });

  // Sorts first, pushing CRM onto the second page as well.
  backend.publishListing({ id: "docs", name: "Docs", category: "Accounting" });
  await app.execute(paged, "nextPage");

  expect(
    (await app.readList("marketplace", { pageSize: 2 })).rows.map(
      ({ name }) => name,
    ),
  ).toEqual(["Ledger", "CRM", "Chat"]);
});

test("refreshing a paged marketplace reloads every page loaded so far", async () => {
  const { app, backend } = await openApp(catalog);
  const paged = { list: "marketplace", filter: { pageSize: 2 } } as const;
  await app.readList("marketplace", { pageSize: 2 });
  await app.execute(paged, "nextPage");

  backend.publishListing({ id: "docs", name: "Docs", category: "Accounting" });
  expect(await app.refresh(paged)).toMatchObject({ status: "success" });

  expect(await app.readList("marketplace", { pageSize: 2 })).toMatchObject({
    rows: [
      { name: "Docs" },
      { name: "Ledger" },
      { name: "CRM" },
      { name: "Chat" },
    ],
    hasMore: false,
    refreshing: false,
  });
});

test("refreshing one page at a time reloads the page on screen", async () => {
  const { app, backend } = await openApp(catalog);
  const filter = { pageSize: 2, onPageLoad: "replace" } as const;
  const paged = { list: "marketplace", filter } as const;
  await app.readList("marketplace", filter);
  await app.execute(paged, "nextPage");

  backend.publishListing({ id: "zed", name: "Zed", category: "Sales" });
  await app.refresh(paged);

  expect(await app.readList("marketplace", filter)).toMatchObject({
    rows: [{ name: "Chat" }, { name: "Zed" }],
    hasMore: false,
    hasPrevious: true,
  });
});

test("a failed marketplace refresh keeps the listings on screen", async () => {
  const { app, backend } = await openApp(catalog);
  await app.readList("marketplace");
  backend.failNext("marketplace.list");

  expect(await app.refresh({ list: "marketplace" })).toMatchObject({
    status: "error",
  });
  expect(await app.readList("marketplace")).toMatchObject({
    status: "ready",
    rows: [{ name: "Ledger" }, { name: "CRM" }, { name: "Chat" }],
    refreshing: false,
  });
});

test("a search nothing matches is an empty marketplace, not an error", async () => {
  const { app } = await openApp(catalog);

  expect(await app.readList("marketplace", { search: "nothing" })).toEqual({
    status: "ready",
    rows: [],
    hasMore: false,
    hasPrevious: false,
    refreshing: false,
  });
});

test("another filter, page size or paging mode is its own list, starting from the first page", async () => {
  const { app } = await openApp(catalog);
  await app.readList("marketplace", { pageSize: 2 });
  await app.execute(
    { list: "marketplace", filter: { pageSize: 2 } },
    "nextPage",
  );

  const names = async (filter: Parameters<typeof app.readList>[1]) =>
    (await app.readList("marketplace", filter)).rows.map(({ name }) => name);
  expect(await names({ pageSize: 1 })).toEqual(["Ledger"]);
  expect(await names({ pageSize: 2, onPageLoad: "replace" })).toEqual([
    "Ledger",
    "CRM",
  ]);
  expect(await names({ pageSize: 2, category: "Sales" })).toEqual([
    "CRM",
    "Chat",
  ]);
  expect(await names({ pageSize: 2 })).toEqual(["Ledger", "CRM", "Chat"]);
});

test("leaving the marketplace and coming back starts from the first page", async () => {
  const { app } = await openApp(catalog);
  await app.readList("marketplace", { pageSize: 2 });
  await app.execute(
    { list: "marketplace", filter: { pageSize: 2 } },
    "nextPage",
  );

  await app.unmount();

  expect(await app.readList("marketplace", { pageSize: 2 })).toMatchObject({
    rows: [{ name: "Ledger" }, { name: "CRM" }],
    hasMore: true,
  });
});

test("refreshing a listing from the marketplace shows on its own screen, and the other way round", async () => {
  const { app, backend } = await openApp(catalog);
  const fromList = { list: "marketplace", item: "crm" } as const;
  await app.readList("marketplace");
  await app.readResource("listing", "crm");

  backend.publishListing({ id: "crm", name: "CRM Live", category: "Sales" });
  const stalled = backend.hold("marketplace.get");
  const listRefresh = app.execute(fromList, "refresh");
  await stalled.reached;
  expect(await app.readResource("listing", "crm")).toMatchObject({
    status: "ready",
    refreshing: true,
  });
  expect(await app.refresh(crm)).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_ACTION_BUSY" },
  });
  stalled.release();
  expect(await listRefresh).toMatchObject({ status: "success" });
  await eventually(async () =>
    expect(await app.readResource("listing", "crm")).toMatchObject({
      data: { name: "CRM Live" },
      refreshing: false,
    }),
  );

  backend.publishListing({ id: "crm", name: "CRM Again", category: "Sales" });
  const again = backend.hold("marketplace.get");
  const detailRefresh = app.refresh(crm);
  await again.reached;
  expect(await app.readListItem("marketplace", undefined, "crm")).toMatchObject(
    { status: "ready", refreshing: true },
  );
  expect(await app.execute(fromList, "refresh")).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_ACTION_BUSY" },
  });
  again.release();
  expect(await detailRefresh).toMatchObject({ status: "success" });
  await eventually(async () =>
    expect(
      await app.readListItem("marketplace", undefined, "crm"),
    ).toMatchObject({ data: { name: "CRM Again" }, refreshing: false }),
  );
  expect(
    (await app.readList("marketplace")).rows.map(({ name }) => name),
  ).toContain("CRM Again");
});

test("a listing published elsewhere joins the marketplace after refresh", async () => {
  const { app, backend } = await openApp(catalog);
  await app.readList("marketplace");

  backend.publishListing({ id: "docs", name: "Docs", category: "Accounting" });
  await app.refresh({ list: "marketplace" });

  expect(
    (await app.readList("marketplace")).rows.map(({ name }) => name),
  ).toEqual(["Docs", "Ledger", "CRM", "Chat"]);
});

test("activating a listing creates an instance that an instance list elsewhere shows", async () => {
  const { app, backend } = await openApp(catalog);
  expect(
    await app.readList("instances", { integrationId: "crm" }),
  ).toMatchObject({ status: "ready", rows: [] });

  const activated = await app.execute(crm, "activate", { name: "New CRM" });

  expect(activated).toMatchObject({
    status: "success",
    data: { name: "New CRM", integrationId: "crm", deployed: false },
  });
  expect(backend.instances("crm")).toMatchObject([
    { name: "New CRM", deployed: false },
  ]);
  await eventually(async () =>
    expect(
      await app.readList("instances", { integrationId: "crm" }),
    ).toMatchObject({ rows: [{ name: "New CRM" }] }),
  );
  await eventually(async () =>
    expect(await app.readResource("listing", "crm")).toMatchObject({
      data: { instances: [{ name: "New CRM", lifecycle: "notDeployed" }] },
    }),
  );
});

test("activating repeatedly under one screen creates one instance each time", async () => {
  const { app, backend } = await openApp(catalog);

  for (const name of ["First", "Second", "Third"])
    expect(await app.execute(crm, "activate", { name })).toMatchObject({
      status: "success",
    });

  expect(backend.instances("crm").map(({ name }) => name)).toEqual([
    "First",
    "Second",
    "Third",
  ]);
});

test("a listing that allows one instance says activation is blocked, and refuses it with an error rather than a crash", async () => {
  const { app, backend } = await openApp({
    ...catalog,
    instances: [{ id: "books", integrationId: "ledger" }],
  });
  const ledger = { kind: "listing", id: "ledger" } as const;

  expect(await app.readResource("listing", "ledger")).toMatchObject({
    data: { canActivate: false, activationBlockedBy: "INSTANCE_EXISTS" },
  });
  expect(
    await app.execute(ledger, "activate", { name: "Another" }),
  ).toMatchObject({ status: "error" });
  expect(backend.instances("ledger")).toHaveLength(1);
});

test("a marketplace item and the listing's own screen share one activation: a second activate from either is refused as busy", async () => {
  const { app, backend } = await openApp(catalog);
  const item = { list: "marketplace", item: "crm" } as const;
  await app.readResource("listing", "crm");
  await app.readList("marketplace");

  const stalled = backend.hold("marketplace.activate");
  const activating = app.execute(item, "activate", { name: "From the row" });
  await stalled.reached;
  expect(
    await app.execute(crm, "activate", { name: "From the screen" }),
  ).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_ACTION_BUSY" },
  });
  stalled.release();

  expect(await activating).toMatchObject({
    status: "success",
    data: {
      name: "From the row",
      integrationId: "crm",
      lifecycle: "notDeployed",
    },
  });
  expect(backend.instances("crm").map(({ name }) => name)).toEqual([
    "From the row",
  ]);
});

test("a created instance is readable by its id at once", async () => {
  const { app } = await openApp(catalog);

  const activated = await app.execute(crm, "activate", { name: "New CRM" });
  if (activated.status !== "success") throw new Error("activation failed");
  const { id } = activated.data as { id: string };

  expect(await app.readResource("instance", id)).toMatchObject({
    status: "ready",
    data: { name: "New CRM", lifecycle: "notDeployed" },
  });
});

const versioned: World = {
  users: { alice: "admin" },
  integrations: [
    {
      id: "crm-v1",
      name: "CRM",
      listed: false,
      upgradeTo: "crm",
      configurationVersion: "1",
    },
    {
      id: "crm",
      name: "CRM",
      versionNumber: 2,
      allowMultipleInstances: true,
      configurationVersion: "1",
    },
    { id: "ledger", name: "Ledger" },
  ],
  instances: [
    { id: "old", name: "Old", integrationId: "crm-v1" },
    { id: "books", name: "Books", integrationId: "ledger" },
    { id: "fresh", name: "Fresh", integrationId: "crm", deployed: false },
  ],
};

const oldFromCard = { listing: "crm", instance: "old" } as const;
const old = { kind: "instance", id: "old" } as const;

test("a listing carries its instances on every version, never-deployed ones too, newest first, and so does its marketplace item", async () => {
  const { app } = await openApp(versioned);
  const carried = [
    {
      name: "Fresh",
      versionNumber: 2,
      lifecycle: "notDeployed",
      update: null,
    },
    {
      name: "Old",
      versionNumber: 1,
      lifecycle: "active",
      update: { to: "crm", versionNumber: 2, needsReview: false },
    },
  ];

  expect(await app.readResource("listing", "crm")).toMatchObject({
    data: { instances: carried },
  });
  expect(await app.readListItem("marketplace", undefined, "crm")).toMatchObject(
    { data: { instances: carried } },
  );
  expect(await app.readResource("listing", "ledger")).toMatchObject({
    data: { instances: [{ name: "Books" }] },
  });
});

test("carrying instances reads none of them one by one", async () => {
  const { app, backend } = await openApp(versioned);
  const reads = backend.served("instances.get");

  expect(await app.readListItem("marketplace", undefined, "crm")).toMatchObject(
    { data: { instances: [{ name: "Fresh" }, { name: "Old" }] } },
  );
  expect(await app.readResource("listing", "crm")).toMatchObject({
    data: { instances: [{ name: "Fresh" }, { name: "Old" }] },
  });
  expect(backend.served("instances.get")).toBe(reads);
});

test("when the customer's instances can't be read the marketplace still lists, each listing says so, and refreshing brings them back", async () => {
  const { app, backend } = await openApp(versioned);
  backend.failNext("marketplace.instances");

  expect(await app.readList("marketplace")).toMatchObject({
    status: "ready",
    rows: [
      {
        name: "CRM",
        instances: [],
        instancesUnavailable: true,
        canActivate: true,
      },
      {
        name: "Ledger",
        instances: [],
        instancesUnavailable: true,
        canActivate: false,
        activationBlockedBy: "INSTANCES_UNAVAILABLE",
      },
    ],
  });

  expect(await app.refresh({ list: "marketplace" })).toMatchObject({
    status: "success",
  });
  await eventually(async () =>
    expect(await app.readList("marketplace")).toMatchObject({
      rows: [
        {
          name: "CRM",
          instances: [{ name: "Fresh" }, { name: "Old" }],
          instancesUnavailable: false,
          canActivate: true,
        },
        { name: "Ledger", instances: [{ name: "Books" }] },
      ],
    }),
  );
});

test("an instance acted on from its listing is the one its own screen shows, and the reverse", async () => {
  const { app, backend } = await openApp(versioned);
  await app.readResource("instance", "old");

  expect(await app.execute(oldFromCard, "pause")).toMatchObject({
    status: "success",
  });
  expect(backend.instance("old")).toMatchObject({ enabled: false });
  await eventually(async () =>
    expect(await app.readResource("instance", "old")).toMatchObject({
      data: { lifecycle: "paused" },
    }),
  );

  expect(await app.execute(old, "resume")).toMatchObject({
    status: "success",
  });
  await eventually(async () =>
    expect(await app.readResource("listing", "crm")).toMatchObject({
      data: { instances: [{ name: "Fresh" }, { lifecycle: "active" }] },
    }),
  );
});

test("an instance carried by a listing and its own screen share one action: a second deploy from either is refused as busy", async () => {
  const { app, backend } = await openApp(versioned);
  await app.readResource("instance", "old");
  await app.readResource("listing", "crm");

  const stalled = backend.hold("configuration.deploy");
  const deploying = app.execute(oldFromCard, "deploy");
  await stalled.reached;
  expect(await app.execute(old, "deploy")).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_ACTION_BUSY" },
  });
  stalled.release();

  expect(await deploying).toMatchObject({ status: "success" });
});

test("upgrading from a listing moves the instance to the new version, and the listing still carries it", async () => {
  const { app, backend } = await openApp(versioned);

  expect(await app.execute(oldFromCard, "upgrade")).toEqual({
    status: "success",
    data: undefined,
  });

  expect(backend.instance("old")).toMatchObject({
    integrationId: "crm",
    versionNumber: 2,
    needsDeploy: true,
  });
  const upgraded = {
    name: "Old",
    versionNumber: 2,
    lifecycle: "pendingChanges",
    update: null,
  };
  await eventually(async () => {
    expect(await app.readResource("listing", "crm")).toMatchObject({
      data: { instances: [{ name: "Fresh" }, upgraded] },
    });
    expect(await app.readResource("instance", "old")).toMatchObject({
      data: upgraded,
    });
  });
});

test("removing an instance from its own screen drops it from the listing that carried it", async () => {
  const { app, backend } = await openApp(versioned);
  await app.readResource("listing", "crm");

  expect(await app.execute(old, "remove")).toMatchObject({
    status: "success",
  });

  expect(backend.instance("old")).toBeUndefined();
  await eventually(async () =>
    expect(await app.readResource("listing", "crm")).toMatchObject({
      data: { instances: [{ name: "Fresh" }] },
    }),
  );
});

test("categories and labels list the distinct values across the marketplace", async () => {
  const { app } = await openApp(catalog);

  expect(await app.readList("categories")).toMatchObject({
    status: "ready",
    rows: ["Accounting", "Sales"],
  });
  expect(await app.readList("labels")).toMatchObject({
    status: "ready",
    rows: ["finance", "support"],
  });
});

test("filter options pick up a new category on refresh and on a new session", async () => {
  const { app, backend } = await openApp(catalog);
  await app.readList("categories");

  backend.publishListing({ id: "hr", category: "People" });
  await app.refresh({ list: "categories" });
  await eventually(async () =>
    expect((await app.readList("categories")).rows).toEqual([
      "Accounting",
      "People",
      "Sales",
    ]),
  );

  backend.publishListing({ id: "ops", category: "Operations" });
  await app.signInAs("bob:1");
  await eventually(async () =>
    expect((await app.readList("categories")).rows).toEqual([
      "Accounting",
      "Operations",
      "People",
      "Sales",
    ]),
  );
});

test("filter options that failed to load recover through refresh", async () => {
  const { app, backend } = await openApp({ ...catalog, integrations: [] });
  backend.failNext("marketplace.filterOptions");

  expect(await app.readList("labels")).toMatchObject({ status: "error" });
  await app.refresh({ list: "labels" });

  await eventually(async () =>
    expect(await app.readList("labels")).toMatchObject({
      status: "ready",
      rows: [],
    }),
  );
});
