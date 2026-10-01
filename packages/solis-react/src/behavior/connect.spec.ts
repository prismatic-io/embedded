import { ABANDON_GRACE_MS } from "@prismatic-io/solis-core/internal";
import { afterEach, expect, test, vi } from "vitest";
import { eventually, openApp, type World } from "./harness.js";

afterEach(() => {
  vi.useRealTimers();
});

const CONSENT = /^https:\/\/provider\.example\.test\/authorize/;

const world: World = {
  users: { alice: "admin", una: "user" },
  integrations: [
    {
      id: "crm",
      name: "CRM",
      configuration: {
        connectionRequirements: { slack: ["team-slack"], sheets: [] },
        serverFunctions: { listChannels: () => [] },
        functionConnectionRequirements: {
          listChannels: { slack: ["team-slack"] },
        },
        newConnections: {
          slack: { oauth2Type: "authorization_code" },
          sheets: { oauth2Type: "client_credentials" },
        },
      },
    },
    {
      id: "erp",
      name: "ERP",
      configuration: {
        connectionRequirements: { ledger: ["ledger-key"] },
        newConnections: {
          ledger: { oauth2Type: "client_credentials", connectsAs: "FAILED" },
        },
      },
    },
  ],
  instances: [
    { id: "acme", integrationId: "crm" },
    { id: "books", integrationId: "erp" },
  ],
  connections: [
    { id: "team-slack", status: "PENDING" },
    { id: "gmail", status: "ACTIVE" },
    { id: "expired", status: "ERROR" },
    { id: "ledger-key", oauth2Type: null },
    { id: "service", status: "ACTIVE", oauth2Type: "client_credentials" },
  ],
};

const slack = { kind: "connection", id: "team-slack" } as const;

test("connecting opens the provider's consent screen from the click and lands once the user consents, the status following live", async () => {
  const { app, backend, browser } = await openApp(world);
  expect(await app.readResource("connection", "team-slack")).toMatchObject({
    data: { status: "PENDING", blockedBy: { connect: null } },
  });

  const connecting = app.execute(slack, "connect");
  await eventually(() =>
    expect(browser.consentWindows()).toEqual([
      { url: expect.stringMatching(CONSENT), closed: false },
    ]),
  );
  backend.consent("team-slack", "granted");

  expect(await connecting).toMatchObject({
    status: "success",
    data: { id: "team-slack", status: "ACTIVE" },
  });
  expect(await app.readResource("connection", "team-slack")).toMatchObject({
    data: {
      status: "ACTIVE",
      blockedBy: { connect: "ALREADY_CONNECTED", disconnect: null },
    },
  });
  expect(backend.connection("team-slack")?.status).toBe("ACTIVE");
});

test("a connection connected from the list shows as connected wherever it's read", async () => {
  const { app, backend, browser } = await openApp(world);
  await app.readResource("connection", "team-slack");

  const connecting = app.execute(
    { list: "connections", item: "team-slack" },
    "connect",
  );
  await eventually(() => expect(browser.consentWindows()).toHaveLength(1));
  backend.consent("team-slack", "granted");

  expect(await connecting).toMatchObject({ status: "success" });
  await eventually(async () => {
    expect(await app.readResource("connection", "team-slack")).toMatchObject({
      data: { status: "ACTIVE" },
    });
    expect(
      await app.readListItem("connections", undefined, "team-slack"),
    ).toMatchObject({ data: { status: "ACTIVE" } });
  });
});

test("a browser that blocks the consent window refuses connecting, and nothing changes", async () => {
  const { app, backend, browser } = await openApp(world);
  browser.blockPopups();

  expect(await app.execute(slack, "connect")).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_POPUP_BLOCKED" },
  });
  expect(backend.connection("team-slack")?.status).toBe("PENDING");
  expect(await app.readResource("connection", "team-slack")).toMatchObject({
    data: { status: "PENDING" },
  });
});

test("a host that opens URLs itself is handed the consent screen instead of a popup", async () => {
  const { app, backend, browser } = await openApp(world, {
    hostOpensUrls: true,
  });
  browser.blockPopups();

  const connecting = app.execute(slack, "connect");
  await eventually(() =>
    expect(browser.openedByHost()).toEqual([expect.stringMatching(CONSENT)]),
  );
  backend.consent("team-slack", "granted");

  expect(await connecting).toMatchObject({
    status: "success",
    data: { status: "ACTIVE" },
  });
  expect(browser.consentWindows()).toEqual([]);
});

test("a provider that refuses consent fails connecting", async () => {
  const { app, backend, browser } = await openApp(world);

  const connecting = app.execute(slack, "connect");
  await eventually(() => expect(browser.consentWindows()).toHaveLength(1));
  backend.consent("team-slack", "refused");

  expect(await connecting).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_CONNECT_FAILED" },
  });
  expect(await app.readResource("connection", "team-slack")).toMatchObject({
    data: { status: "FAILED", blockedBy: { connect: null } },
  });
});

test("reconnecting a connection that had failed waits for the new consent rather than its old failure", async () => {
  const { app, backend, browser } = await openApp(world);
  const expired = { kind: "connection", id: "expired" } as const;

  const connecting = app.execute(expired, "connect", { timeoutMs: 400 });
  await eventually(() => expect(browser.consentWindows()).toHaveLength(1));
  backend.consent("expired", "granted");

  expect(await connecting).toMatchObject({
    status: "success",
    data: { status: "ACTIVE" },
  });
});

test("a user who closes the consent window abandons connecting once the connection is still pending a while later", async () => {
  const { app, browser } = await openApp(world);
  vi.useFakeTimers({ shouldAdvanceTime: true });

  const connecting = app.execute(slack, "connect");
  await eventually(() => expect(browser.consentWindows()).toHaveLength(1));
  browser.closeConsentWindow();
  await vi.advanceTimersByTimeAsync(ABANDON_GRACE_MS + 1_000);

  expect(await connecting).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_CONNECT_ABANDONED" },
  });
  expect(await app.readResource("connection", "team-slack")).toMatchObject({
    data: { status: "PENDING" },
  });
});

test("consent that lands while the window reads as closed still connects", async () => {
  const { app, backend, browser } = await openApp(world);

  const connecting = app.execute(slack, "connect");
  await eventually(() => expect(browser.consentWindows()).toHaveLength(1));
  browser.closeConsentWindow();
  backend.consent("team-slack", "granted");

  expect(await connecting).toMatchObject({
    status: "success",
    data: { status: "ACTIVE" },
  });
});

test("connecting gives up after its timeout, and the status still follows when consent lands later", async () => {
  const { app, backend } = await openApp(world);

  expect(await app.execute(slack, "connect", { timeoutMs: 150 })).toMatchObject(
    { status: "error", error: { code: "PRISMATIC_CONNECT_TIMEOUT" } },
  );

  backend.consent("team-slack", "granted");
  await eventually(async () =>
    expect(await app.readResource("connection", "team-slack")).toMatchObject({
      data: { status: "ACTIVE" },
    }),
  );
});

test("the user coming back to the app picks up their consent at once", async () => {
  const { app, backend, browser } = await openApp({
    ...world,
    statusRecheckMs: 60_000,
  });

  const connecting = app.execute(slack, "connect", { timeoutMs: 2_000 });
  await eventually(() => expect(browser.consentWindows()).toHaveLength(1));
  backend.consent("team-slack", "granted");
  window.dispatchEvent(new Event("focus"));

  expect(await connecting).toMatchObject({
    status: "success",
    data: { status: "ACTIVE" },
  });
});

test("the user cancels connecting", async () => {
  const { app, browser } = await openApp(world);

  const connecting = app.execute(slack, "connect");
  await eventually(() => expect(browser.consentWindows()).toHaveLength(1));
  await app.execute(slack, "cancelConnect");

  expect(await connecting).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_CONNECT_ABORTED" },
  });
});

test("connecting settles on the user's outcome even when the browser won't let the app close the consent window", async () => {
  const { app, backend, browser } = await openApp(world);
  browser.ignoreCloses();

  const granted = app.execute(slack, "connect");
  await eventually(() => expect(browser.consentWindows()).toHaveLength(1));
  backend.consent("team-slack", "granted");
  expect(await granted).toMatchObject({
    status: "success",
    data: { status: "ACTIVE" },
  });

  const expired = { kind: "connection", id: "expired" } as const;
  const refused = app.execute(expired, "connect");
  await eventually(() => expect(browser.consentWindows()).toHaveLength(2));
  backend.consent("expired", "refused");
  expect(await refused).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_CONNECT_FAILED" },
  });
  expect(await app.readResource("connection", "expired")).toMatchObject({
    data: { status: "FAILED", blockedBy: { connect: null } },
  });
  expect(browser.consentWindows()).toMatchObject([
    { closed: false },
    { closed: false },
  ]);
});

test("a consent screen that isn't served over https is refused before the user is sent there", async () => {
  const { app, browser } = await openApp({
    ...world,
    consentUrl: "http://provider.example.test/authorize",
  });

  expect(await app.execute(slack, "connect")).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_CONNECT_FAILED" },
  });
  expect(browser.consentWindows()).toEqual([
    { url: "about:blank", closed: true },
  ]);
});

test("each connection says why it can't be connected or disconnected, and refuses without opening a window", async () => {
  const { app, browser } = await openApp(world);

  expect(await app.readList("connections")).toMatchObject({
    rows: [
      {
        id: "team-slack",
        blockedBy: { connect: null, disconnect: "NOT_CONNECTED" },
      },
      {
        id: "gmail",
        blockedBy: { connect: "ALREADY_CONNECTED", disconnect: null },
      },
      { id: "expired", blockedBy: { connect: null, disconnect: null } },
      {
        id: "ledger-key",
        blockedBy: { connect: "NOT_OAUTH", disconnect: "NOT_OAUTH" },
      },
      {
        id: "service",
        blockedBy: { connect: "CLIENT_CREDENTIALS", disconnect: null },
      },
    ],
  });

  for (const id of ["gmail", "ledger-key", "service"])
    expect(
      await app.execute({ kind: "connection", id }, "connect"),
    ).toMatchObject({
      status: "error",
      error: { code: "PRISMATIC_CONNECTION_FORBIDDEN" },
    });
  expect(
    await app.execute({ kind: "connection", id: "team-slack" }, "disconnect"),
  ).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_CONNECTION_FORBIDDEN" },
  });
  expect(browser.consentWindows()).toEqual([]);
});

test("disconnecting puts a connection back to pending, on the backend and on screen", async () => {
  const { app, backend } = await openApp(world);
  const gmail = { kind: "connection", id: "gmail" } as const;

  expect(await app.execute(gmail, "disconnect")).toMatchObject({
    status: "success",
    data: { status: "PENDING", blockedBy: { connect: null } },
  });
  expect(backend.connection("gmail")?.status).toBe("PENDING");
  await eventually(async () =>
    expect(await app.readResource("connection", "gmail")).toMatchObject({
      data: { status: "PENDING", blockedBy: { disconnect: "NOT_CONNECTED" } },
    }),
  );
});

test("a client-credentials connection disconnects from the list", async () => {
  const { app, backend } = await openApp(world);

  expect(
    await app.execute({ list: "connections", item: "service" }, "disconnect"),
  ).toMatchObject({ status: "success" });
  expect(backend.connection("service")?.status).toBe("PENDING");
});

test("making a connection for a requirement consents in one click, and the new connection is offered for it", async () => {
  const { app, backend, browser } = await openApp(world);
  expect(await app.readResource("connectionOptions", "acme")).toMatchObject({
    data: {
      init: [
        { key: "slack", options: ["team-slack"], createBlockedBy: null },
        { key: "sheets", options: [], createBlockedBy: null },
      ],
    },
  });

  const creating = app.execute(
    { kind: "connectionOptions", id: "acme" },
    "createConnection",
    { requirement: "slack", label: "Sales Slack" },
  );
  await eventually(() =>
    expect(browser.consentWindows()).toEqual([
      { url: expect.stringMatching(CONSENT), closed: false },
    ]),
  );
  const [made] = backend.connectionsFor("slack");
  expect(made).toMatchObject({ label: "Sales Slack" });
  expect(backend.connection(made?.id ?? "")?.status).toBe("PENDING");
  backend.consent(made?.id ?? "", "granted");

  expect(await creating).toMatchObject({
    status: "success",
    data: { id: made?.id, label: "Sales Slack", status: "ACTIVE" },
  });
  await eventually(async () =>
    expect(await app.readResource("connectionOptions", "acme")).toMatchObject({
      data: {
        init: [
          { key: "slack", options: ["team-slack", made?.id] },
          { key: "sheets", options: [] },
        ],
        serverFunctions: {
          listChannels: [{ key: "slack", options: ["team-slack", made?.id] }],
        },
      },
    }),
  );
  expect(await app.readResource("connection", made?.id ?? "")).toMatchObject({
    data: { label: "Sales Slack", status: "ACTIVE" },
  });
});

test("making a client-credentials connection connects as it's made, with no consent window", async () => {
  const { app, backend, browser } = await openApp(world);

  expect(
    await app.execute(
      { kind: "connectionOptions", id: "acme" },
      "createConnection",
      { requirement: "sheets", label: "Reporting" },
    ),
  ).toMatchObject({
    status: "success",
    data: { label: "Reporting", status: "ACTIVE" },
  });
  expect(browser.consentWindows()).toEqual([]);
  expect(backend.connectionsFor("sheets")).toMatchObject([
    { label: "Reporting" },
  ]);
});

test("a client-credentials connection the provider refuses is made but fails to connect, and is still offered for its requirement", async () => {
  const { app, backend } = await openApp(world);

  expect(
    await app.execute(
      { kind: "connectionOptions", id: "books" },
      "createConnection",
      { requirement: "ledger" },
    ),
  ).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_CONNECT_FAILED" },
  });
  const [made] = backend.connectionsFor("ledger");
  expect(backend.connection(made?.id ?? "")?.status).toBe("PENDING");
  await eventually(async () =>
    expect(await app.readResource("connectionOptions", "books")).toMatchObject({
      data: { init: [{ key: "ledger", options: ["ledger-key", made?.id] }] },
    }),
  );
});

test("making a connection is blocked outside a popup-enabled click, and leaves nothing behind", async () => {
  const { app, backend, browser } = await openApp(world);
  browser.blockPopups();

  expect(
    await app.execute(
      { kind: "connectionOptions", id: "acme" },
      "createConnection",
      { requirement: "slack" },
    ),
  ).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_POPUP_BLOCKED" },
  });
  expect(backend.connectionsFor("slack")).toEqual([]);
});

test("a marketplace user can't make connections", async () => {
  const { app, backend } = await openApp(world, { as: "una" });

  expect(await app.readResource("connectionOptions", "acme")).toMatchObject({
    data: {
      init: [
        { key: "slack", createBlockedBy: "ROLE_RESTRICTED" },
        { key: "sheets", createBlockedBy: "ROLE_RESTRICTED" },
      ],
    },
  });
  expect(
    await app.execute(
      { kind: "connectionOptions", id: "acme" },
      "createConnection",
      { requirement: "slack" },
    ),
  ).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_CONNECTION_FORBIDDEN" },
  });
  expect(backend.connectionsFor("slack")).toEqual([]);
});

test("a requirement no customer-activated connection backs offers no new connection", async () => {
  const { app } = await openApp({
    ...world,
    integrations: [
      {
        id: "crm",
        name: "CRM",
        configuration: { connectionRequirements: { slack: ["team-slack"] } },
      },
    ],
    instances: [{ id: "acme", integrationId: "crm" }],
  });

  expect(await app.readResource("connectionOptions", "acme")).toMatchObject({
    data: { init: [{ key: "slack", createBlockedBy: "NO_TEMPLATE" }] },
  });
});

test("a user connects and disconnects their own user-level connection, and nobody else is served it", async () => {
  const personal: World = {
    ...world,
    connections: [
      { id: "alice-crm", kind: "userLevel", owner: "alice", status: "PENDING" },
      { id: "una-crm", kind: "userLevel", owner: "una", status: "ACTIVE" },
    ],
  };
  const { app, backend, browser } = await openApp(personal);
  const mine = { kind: "connection", id: "alice-crm" } as const;
  expect(await app.readList("connections")).toMatchObject({
    rows: [
      {
        id: "alice-crm",
        kind: "userLevel",
        status: "PENDING",
        blockedBy: { connect: null, disconnect: "NOT_CONNECTED" },
      },
    ],
  });
  expect(await app.readResource("connection", "una-crm")).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_CONNECTION_NOT_FOUND" },
  });

  const connecting = app.execute(mine, "connect");
  await eventually(() =>
    expect(browser.consentWindows()).toEqual([
      { url: expect.stringMatching(CONSENT), closed: false },
    ]),
  );
  backend.consent("alice-crm", "granted");
  expect(await connecting).toMatchObject({
    status: "success",
    data: { status: "ACTIVE" },
  });

  expect(await app.execute(mine, "disconnect")).toMatchObject({
    status: "success",
    data: { status: "PENDING" },
  });
  expect(backend.connection("alice-crm")?.status).toBe("PENDING");
  expect(backend.connection("una-crm")?.status).toBe("ACTIVE");
});
