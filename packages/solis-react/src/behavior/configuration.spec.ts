import { expect, test } from "vitest";
import { eventually, openApp, type World } from "./harness.js";

const crm = (overrides: Partial<World> = {}): World => ({
  integrations: [
    {
      id: "crm-v1",
      name: "CRM",
      upgradeTo: "crm-v2",
      configuration: {
        init: () => ["notice", { next: 42 }],
        serverFunctions: {
          listTables: (inputs) => inputs,
        },
        functionsNeedingConnection: ["requiresConnection"],
        connectionRequirements: { airtable: ["workspace", "org-airtable"] },
        functionConnectionRequirements: {
          listTables: { airtable: ["workspace"] },
        },
      },
    },
    {
      id: "crm-v2",
      name: "CRM",
      versionNumber: 2,
      listed: false,
      configuration: {
        serverFunctions: { listTables: () => "from v2" },
        connectionRequirements: { sheets: ["spreadsheet"] },
      },
    },
  ],
  instances: [{ id: "acme", integrationId: "crm-v1", value: { region: "us" } }],
  connections: [{ id: "workspace" }, { id: "spreadsheet" }],
  ...overrides,
});

const configuration = { kind: "configuration", id: "acme" } as const;
const nextVersion = { ...configuration, version: "crm-v2" } as const;

test("the app reads the configuration for the instance's version, and the instance holds its saved values and the version on offer", async () => {
  const { app } = await openApp(crm());

  expect(await app.readResource("configuration", "acme")).toMatchObject({
    status: "ready",
    data: {
      integrationId: "crm-v1",
      integrationName: "CRM",
      versionNumber: 1,
      isUpgrade: false,
      configurationExperience: "headless",
      deployedVersion: 1,
      serverFunctions: ["listTables"],
    },
  });
  expect(await app.readResource("instance", "acme")).toMatchObject({
    data: {
      configuration: { value: { region: "us" } },
      update: { to: "crm-v2", versionNumber: 2 },
    },
  });
});

test("without an instance the configuration stays loading and the backend is never asked", async () => {
  const { app, backend } = await openApp(crm());

  expect(await app.readResource("configuration", null)).toEqual({
    status: "loading",
  });
  expect(backend.served("configuration.read")).toBe(0);
});

test("saving persists the value, the instance shows it, and nothing is deployed", async () => {
  const { app, backend } = await openApp(crm());
  const before = backend.instance("acme");

  expect(
    await app.execute(configuration, "save", { value: { region: "eu" } }),
  ).toEqual({ status: "success", data: undefined });

  expect(backend.instance("acme")).toMatchObject({
    value: { region: "eu" },
    lastDeployedAt: before?.lastDeployedAt,
  });
  await eventually(async () =>
    expect(await app.readResource("instance", "acme")).toMatchObject({
      data: { configuration: { value: { region: "eu" } } },
    }),
  );
});

test("init answers with the author's data and persists nothing", async () => {
  const { app, backend } = await openApp(crm());
  const before = backend.instance("acme");

  expect(
    await app.execute(configuration, "init", {
      connections: [{ key: "airtable", id: "workspace" }],
    }),
  ).toEqual({ status: "success", data: ["notice", { next: 42 }] });
  expect(backend.instance("acme")).toEqual(before);
});

test("a rejected save reports the fields, keeps the saved value, and a corrected save lands", async () => {
  const world = crm();
  const [v1, v2] = world.integrations ?? [];
  const { app, backend } = await openApp({
    ...world,
    integrations: [
      {
        ...v1,
        id: "crm-v1",
        configuration: {
          validate: (value) =>
            (value as { region?: string }).region
              ? undefined
              : [{ path: "/region", message: "Invalid region" }],
        },
      },
      { ...v2, id: "crm-v2" },
    ],
  });

  expect(await app.execute(configuration, "save", { value: {} })).toMatchObject(
    {
      status: "error",
      error: {
        code: "PRISMATIC_CONFIGURATION_INVALID",
        fields: [{ path: "/region", message: "Invalid region" }],
      },
    },
  );
  expect(backend.instance("acme")?.value).toEqual({ region: "us" });
  expect(await app.readResource("instance", "acme")).toMatchObject({
    data: { configuration: { value: { region: "us" } } },
  });

  expect(
    await app.execute(configuration, "save", { value: { region: "eu" } }),
  ).toMatchObject({ status: "success" });
  expect(backend.instance("acme")?.value).toEqual({ region: "eu" });
});

test("a backend refusal is an error result and persists nothing", async () => {
  const { app, backend } = await openApp({
    ...crm(),
    integrations: [{ id: "crm-v1", configuration: { forbidden: true } }],
  });
  const before = backend.instance("acme");
  const refused = {
    status: "error",
    error: { code: "PRISMATIC_CONFIGURATION_FORBIDDEN" },
  };

  expect(await app.execute(configuration, "init")).toMatchObject(refused);
  expect(
    await app.execute(configuration, "save", { value: "refused" }),
  ).toMatchObject(refused);
  expect(backend.instance("acme")).toEqual(before);
});

test("a second save while one is running is refused as busy, and only the first lands", async () => {
  const { app, backend } = await openApp(crm());
  await app.readResource("configuration", "acme");
  const stalled = backend.hold("configuration.save");

  const first = app.execute(configuration, "save", { value: "first" });
  await stalled.reached;
  expect(
    await app.execute(configuration, "save", { value: "second" }),
  ).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_ACTION_BUSY" },
  });
  stalled.release();

  expect(await first).toMatchObject({ status: "success" });
  expect(backend.instance("acme")?.value).toBe("first");
});

test("a failed refresh keeps the configuration on screen", async () => {
  const { app, backend } = await openApp(crm());
  await app.readResource("configuration", "acme");
  backend.failNext("configuration.refresh");

  expect(await app.refresh(configuration)).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_UNKNOWN" },
  });
  expect(await app.readResource("configuration", "acme")).toMatchObject({
    status: "ready",
    data: { integrationId: "crm-v1" },
    refreshing: false,
  });
});

test("a configuration that failed to load recovers through refresh", async () => {
  const { app, backend } = await openApp(crm());
  backend.failNext("configuration.read");

  expect(await app.readResource("configuration", "acme")).toMatchObject({
    status: "error",
  });
  expect(await app.refresh(configuration)).toMatchObject({
    status: "success",
  });
  expect(await app.readResource("configuration", "acme")).toMatchObject({
    status: "ready",
    data: { integrationId: "crm-v1" },
  });
});

test("after live updates drop, refresh recovers and later saves show up", async () => {
  const { app, backend } = await openApp(crm());
  await app.readResource("configuration", "acme");

  backend.dropLiveUpdates("acme");
  await eventually(async () =>
    expect(await app.readResource("configuration", "acme")).toMatchObject({
      status: "error",
    }),
  );
  await app.refresh(configuration);
  expect(
    await app.execute(nextVersion, "save", { value: { region: "eu" } }),
  ).toMatchObject({ status: "success" });

  await eventually(async () =>
    expect(await app.readResource("configuration", "acme")).toMatchObject({
      status: "ready",
      data: { integrationId: "crm-v2", needsDeploy: true },
    }),
  );
});

test("server functions answer with their result, and the backend's connection refusal comes back as an error", async () => {
  const { app } = await openApp({
    ...crm(),
    integrations: [
      {
        id: "crm-v1",
        configuration: {
          serverFunctions: {
            listTables: (inputs) => inputs,
            requiresConnection: () => "never",
          },
          functionsNeedingConnection: ["requiresConnection"],
        },
      },
    ],
  });

  expect(
    await app.execute(configuration, "serverFunction", {
      key: "listTables",
      inputs: { baseId: "known" },
    }),
  ).toEqual({ status: "success", data: { baseId: "known" } });
  expect(
    await app.execute(configuration, "serverFunction", {
      key: "requiresConnection",
      inputs: {},
    }),
  ).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_CONNECTION_UNAVAILABLE" },
  });
});

test("two screens running the same server function run side by side: the second answers while the first is still running", async () => {
  let finishFirst = () => {};
  const firstRunning = new Promise<void>((resolve) => {
    finishFirst = resolve;
  });
  const world = crm();
  const { app } = await openApp({
    ...world,
    integrations: world.integrations?.map((integration) =>
      integration.id === "crm-v1"
        ? {
            ...integration,
            configuration: {
              ...integration.configuration,
              serverFunctions: {
                listTables: async (inputs) => {
                  if ((inputs as { baseId: string }).baseId === "first")
                    await firstRunning;
                  return inputs;
                },
              },
            },
          }
        : integration,
    ),
  });
  await app.readResource("configuration", "acme");
  const run = (baseId: string) =>
    app.execute(configuration, "serverFunction", {
      key: "listTables",
      inputs: { baseId },
    });

  const first = run("first");
  expect(await run("second")).toEqual({
    status: "success",
    data: { baseId: "second" },
  });
  finishFirst();
  expect(await first).toEqual({
    status: "success",
    data: { baseId: "first" },
  });
});

test("a server function runs from a screen the host hands a copy of the configuration", async () => {
  const { app } = await openApp(crm());
  await app.readResource("configuration", "acme");

  expect(
    await app.execute(configuration, "serverFunction", {
      key: "listTables",
      inputs: { baseId: "copied" },
      copied: true,
    }),
  ).toEqual({ status: "success", data: { baseId: "copied" } });
});

test("one screen's second run while its first is running is refused as busy, and runs again once it's done", async () => {
  const { app, backend } = await openApp(crm());
  await app.readResource("configuration", "acme");
  const stalled = backend.hold("configuration.serverFunction");
  const run = (baseId: string) =>
    app.execute(configuration, "serverFunction", {
      key: "listTables",
      inputs: { baseId },
      caller: "tables picker",
    });

  const first = run("first");
  await stalled.reached;
  expect(await run("second")).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_ACTION_BUSY" },
  });
  stalled.release();

  expect(await first).toEqual({
    status: "success",
    data: { baseId: "first" },
  });
  expect(await run("third")).toEqual({
    status: "success",
    data: { baseId: "third" },
  });
});

test("a server function still running when the user leaves never delivers its answer", async () => {
  const { app, backend } = await openApp(crm());
  await app.readResource("configuration", "acme");
  const stalled = backend.hold("configuration.serverFunction");

  const call = app.execute(configuration, "serverFunction", {
    key: "listTables",
    inputs: {},
  });
  await stalled.reached;
  await app.unmount();
  stalled.release();

  expect(await call).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_ACTION_DISPOSED" },
  });
});

test("a newer version is configured on its own terms; init is advisory and saving moves the instance to it awaiting deploy", async () => {
  const world = crm();
  const [v1, v2] = world.integrations ?? [];
  let accept = false;
  const { app, backend } = await openApp({
    ...world,
    integrations: [
      { ...v1, id: "crm-v1" },
      {
        ...v2,
        id: "crm-v2",
        configuration: {
          init: () => "author migration advice",
          validate: () =>
            accept ? undefined : [{ path: null, message: "Rejected" }],
          serverFunctions: { listTables: () => "from v2" },
        },
      },
    ],
  });
  const before = backend.instance("acme");

  expect(
    await app.readResource("configuration", "acme", { version: "crm-v2" }),
  ).toMatchObject({
    status: "ready",
    data: {
      integrationId: "crm-v2",
      versionNumber: 2,
      isUpgrade: true,
      deployedVersion: 1,
    },
  });
  expect(await app.execute(nextVersion, "init")).toEqual({
    status: "success",
    data: "author migration advice",
  });
  expect(backend.instance("acme")).toEqual(before);

  expect(
    await app.execute(nextVersion, "save", { value: { region: "eu" } }),
  ).toMatchObject({ status: "error" });
  expect(backend.instance("acme")).toEqual(before);

  accept = true;
  expect(
    await app.execute(nextVersion, "save", { value: { region: "eu" } }),
  ).toMatchObject({ status: "success" });
  expect(backend.instance("acme")).toMatchObject({
    value: { region: "eu" },
    integrationId: "crm-v2",
    versionNumber: 2,
    needsDeploy: true,
  });
  const moved = {
    status: "ready",
    data: {
      integrationId: "crm-v2",
      versionNumber: 2,
      isUpgrade: false,
      deployedVersion: 1,
    },
  };
  await eventually(async () => {
    expect(await app.readResource("configuration", "acme")).toMatchObject(
      moved,
    );
    expect(
      await app.readResource("configuration", "acme", { version: "crm-v2" }),
    ).toMatchObject(moved);
  });
  expect(
    await app.execute(configuration, "serverFunction", {
      key: "listTables",
      inputs: {},
    }),
  ).toEqual({ status: "success", data: "from v2" });
});

test("a newer version's server function runs before the instance moves to it", async () => {
  const { app, backend } = await openApp(crm());

  expect(
    await app.execute(nextVersion, "serverFunction", {
      key: "listTables",
      inputs: {},
    }),
  ).toEqual({ status: "success", data: "from v2" });
  expect(
    await app.execute(configuration, "serverFunction", {
      key: "listTables",
      inputs: { baseId: "current" },
    }),
  ).toEqual({ status: "success", data: { baseId: "current" } });
  expect(backend.instance("acme")).toMatchObject({
    integrationId: "crm-v1",
    needsDeploy: false,
  });
});

test("a never-deployed instance's configuration can be saved and the instance deployed, and again after that", async () => {
  const { app, backend } = await openApp(
    crm({
      instances: [
        { id: "unfinished", integrationId: "crm-v1", deployed: false },
      ],
    }),
  );
  const configuration = { kind: "configuration", id: "unfinished" } as const;
  const instance = { kind: "instance", id: "unfinished" } as const;

  for (const value of ["first", "second"]) {
    expect(await app.execute(configuration, "save", { value })).toMatchObject({
      status: "success",
    });
    expect(await app.execute(instance, "deploy")).toMatchObject({
      status: "success",
    });
    expect(backend.instance("unfinished")).toMatchObject({
      deployed: true,
      needsDeploy: false,
      value,
    });
  }
});

test("connection choices list what init and each server function need, only from connections the customer may use, and never change the instance", async () => {
  const { app, backend } = await openApp(crm());
  const before = backend.instance("acme");
  const expected = {
    status: "ready",
    data: {
      init: [
        {
          key: "airtable",
          options: ["workspace"],
          createBlockedBy: "NO_TEMPLATE",
        },
      ],
      serverFunctions: {
        listTables: [
          {
            key: "airtable",
            options: ["workspace"],
            createBlockedBy: "NO_TEMPLATE",
          },
        ],
      },
    },
  };

  expect(await app.readResource("connectionOptions", "acme")).toEqual({
    ...expected,
    refreshing: false,
  });
  expect(
    await app.refresh({ kind: "connectionOptions", id: "acme" }),
  ).toMatchObject({ status: "success" });
  expect(await app.readResource("connectionOptions", "acme")).toMatchObject(
    expected,
  );
  expect(backend.instance("acme")).toEqual(before);
});

test("an offered connection reads as that connection, and one removed elsewhere is no longer offered", async () => {
  const { app, backend } = await openApp(crm());
  await app.readResource("connectionOptions", "acme");
  expect(await app.readResource("connection", "workspace")).toMatchObject({
    status: "ready",
    data: { id: "workspace", status: "ACTIVE" },
  });

  backend.removeConnection("workspace");
  expect(
    await app.refresh({ kind: "connectionOptions", id: "acme" }),
  ).toMatchObject({ status: "success" });

  expect(await app.readResource("connectionOptions", "acme")).toMatchObject({
    status: "ready",
    data: { init: [{ key: "airtable", options: [] }] },
  });
});

test("connection choices load on their own once the configuration has, without holding it up", async () => {
  const { app, backend } = await openApp(crm());
  const stalled = backend.hold("configuration.connections");

  expect(await app.readResource("configuration", "acme")).toMatchObject({
    status: "ready",
  });
  await stalled.reached;
  stalled.release();

  expect(await app.readResource("connectionOptions", "acme")).toMatchObject({
    status: "ready",
    data: { init: [{ key: "airtable", options: ["workspace"] }] },
  });
});

test("a newer version's connection choices are that version's", async () => {
  const { app } = await openApp(crm());

  expect(
    await app.readResource("connectionOptions", "acme", { version: "crm-v2" }),
  ).toMatchObject({
    status: "ready",
    data: {
      init: [{ key: "sheets", options: ["spreadsheet"] }],
      serverFunctions: { listTables: [] },
    },
  });
});
