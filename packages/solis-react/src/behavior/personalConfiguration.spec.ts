import { expect, test } from "vitest";
import { eventually, openApp, type World } from "./harness.js";

const helpdesk = (overrides: Partial<World> = {}): World => ({
  users: { alice: "user", bob: "user" },
  integrations: [
    {
      id: "helpdesk",
      personalConfiguration: {
        validate: (value) =>
          (value as { name?: string } | null)?.name === ""
            ? [{ path: "/name", message: "Required" }]
            : undefined,
        serverFunctions: { lookup: (inputs) => ({ looked: inputs }) },
        functionConnectionRequirements: {
          lookup: { mailbox: ["alice-mail", "org-mail"] },
        },
      },
    },
  ],
  instances: [
    { id: "desk", integrationId: "helpdesk", value: { instanceOnly: true } },
  ],
  connections: [{ id: "alice-mail", kind: "userActivated" }],
  ...overrides,
});

const personal = { kind: "personalConfiguration", id: "desk" } as const;

test("a user with nothing saved reads an empty personal configuration", async () => {
  const { app } = await openApp(helpdesk());

  expect(await app.readResource("personalConfiguration", "desk")).toMatchObject(
    { status: "ready", data: { saved: false, value: null } },
  );
});

test("without an instance it stays loading, and saving is unavailable", async () => {
  const { app, backend } = await openApp(helpdesk());

  expect(await app.readResource("personalConfiguration", null)).toEqual({
    status: "loading",
  });
  expect(
    await app.execute({ kind: "personalConfiguration", id: null }, "save", {
      value: {},
    }),
  ).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_CONFIGURATION_UNAVAILABLE" },
  });
  expect(backend.served("personalConfiguration.read")).toBe(0);
});

test("the first save creates and activates the user's record; later saves update it; the instance is untouched", async () => {
  const { app, backend } = await openApp(helpdesk());
  const instance = backend.instance("desk");

  expect(
    await app.execute(personal, "save", { value: { name: "Alice" } }),
  ).toEqual({ status: "success", data: undefined });
  expect(backend.personalConfiguration("alice", "desk")).toEqual({
    saved: true,
    active: true,
    value: { name: "Alice" },
  });

  expect(
    await app.execute(personal, "save", { value: { name: "Alice B." } }),
  ).toMatchObject({ status: "success" });
  expect(backend.personalConfiguration("alice", "desk")).toMatchObject({
    value: { name: "Alice B." },
  });
  expect(backend.personalConfiguration("bob", "desk").saved).toBe(false);
  expect(backend.instance("desk")).toEqual(instance);
  await eventually(async () =>
    expect(
      await app.readResource("personalConfiguration", "desk"),
    ).toMatchObject({ data: { saved: true, value: { name: "Alice B." } } }),
  );
});

test("saving over an inactive record updates it without activating it", async () => {
  const { app, backend } = await openApp(
    helpdesk({
      personalConfigurations: [
        { user: "alice", instanceId: "desk", value: {}, active: false },
      ],
    }),
  );

  await app.execute(personal, "save", { value: { name: "Alice" } });

  expect(backend.personalConfiguration("alice", "desk")).toEqual({
    saved: true,
    active: false,
    value: { name: "Alice" },
  });
});

test("a rejected save reports the fields and persists nothing", async () => {
  const { app, backend } = await openApp(helpdesk());

  expect(
    await app.execute(personal, "save", { value: { name: "" } }),
  ).toMatchObject({
    status: "error",
    error: {
      code: "PRISMATIC_CONFIGURATION_INVALID",
      fields: [{ path: "/name", message: "Required" }],
    },
  });
  expect(backend.personalConfiguration("alice", "desk").saved).toBe(false);
});

test("a second save while one is running is refused as busy", async () => {
  const { app, backend } = await openApp(helpdesk());
  await app.readResource("personalConfiguration", "desk");
  const stalled = backend.hold("personalConfiguration.save");

  const first = app.execute(personal, "save", { value: { name: "first" } });
  await stalled.reached;
  expect(
    await app.execute(personal, "save", { value: { name: "second" } }),
  ).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_ACTION_BUSY" },
  });
  stalled.release();

  expect(await first).toMatchObject({ status: "success" });
  expect(backend.personalConfiguration("alice", "desk").value).toEqual({
    name: "first",
  });
});

test("removing clears only the signed-in user's record", async () => {
  const { app, backend } = await openApp(
    helpdesk({
      personalConfigurations: [
        { user: "alice", instanceId: "desk", value: { name: "Alice" } },
        { user: "bob", instanceId: "desk", value: { name: "Bob" } },
      ],
    }),
  );

  expect(await app.execute(personal, "remove")).toMatchObject({
    status: "success",
  });

  expect(backend.personalConfiguration("alice", "desk").saved).toBe(false);
  expect(backend.personalConfiguration("bob", "desk")).toMatchObject({
    saved: true,
    value: { name: "Bob" },
  });
  await eventually(async () =>
    expect(
      await app.readResource("personalConfiguration", "desk"),
    ).toMatchObject({ data: { saved: false } }),
  );
});

test("a refreshed token for the same user keeps their data without reloading it", async () => {
  const { app, backend } = await openApp(
    helpdesk({
      personalConfigurations: [
        { user: "alice", instanceId: "desk", value: { name: "Alice" } },
      ],
    }),
  );
  await app.readResource("personalConfiguration", "desk");
  const reads = backend.served("personalConfiguration.read");

  await app.signInAs("alice:2");

  expect(await app.readResource("personalConfiguration", "desk")).toMatchObject(
    { status: "ready", data: { value: { name: "Alice" } } },
  );
  expect(backend.served("personalConfiguration.read")).toBe(reads);
});

test("a different user sees their own personal configuration and saves only theirs", async () => {
  const { app, backend } = await openApp(
    helpdesk({
      personalConfigurations: [
        { user: "alice", instanceId: "desk", value: { name: "Alice" } },
      ],
    }),
  );
  await app.readResource("personalConfiguration", "desk");

  await app.signInAs("bob:1");

  await eventually(async () =>
    expect(
      await app.readResource("personalConfiguration", "desk"),
    ).toMatchObject({ status: "ready", data: { saved: false, value: null } }),
  );
  expect(
    await app.execute(personal, "save", { value: { name: "Bob" } }),
  ).toMatchObject({ status: "success" });
  expect(backend.personalConfiguration("bob", "desk").value).toEqual({
    name: "Bob",
  });
  expect(backend.personalConfiguration("alice", "desk").value).toEqual({
    name: "Alice",
  });
});

test("after live updates drop, refresh recovers the personal configuration", async () => {
  const { app, backend } = await openApp(
    helpdesk({
      personalConfigurations: [
        { user: "alice", instanceId: "desk", value: { name: "Alice" } },
      ],
    }),
  );
  await app.readResource("personalConfiguration", "desk");

  backend.dropLiveUpdates("desk");
  await eventually(async () =>
    expect(
      await app.readResource("personalConfiguration", "desk"),
    ).toMatchObject({ status: "error" }),
  );
  expect(await app.refresh(personal)).toMatchObject({ status: "success" });

  expect(await app.readResource("personalConfiguration", "desk")).toMatchObject(
    { status: "ready", data: { value: { name: "Alice" } } },
  );
});

test("personal server functions answer with their result and survive a save", async () => {
  const { app } = await openApp(helpdesk());
  const lookup = { key: "lookup", inputs: { host: true } };

  expect(await app.execute(personal, "serverFunction", lookup)).toEqual({
    status: "success",
    data: { looked: { host: true } },
  });
  await app.execute(personal, "save", { value: { name: "Alice" } });
  expect(await app.execute(personal, "serverFunction", lookup)).toEqual({
    status: "success",
    data: { looked: { host: true } },
  });
});

test("the instance configuration stays separate from the personal one", async () => {
  const { app } = await openApp(helpdesk());

  await app.execute(personal, "save", { value: { name: "Alice" } });

  expect(await app.readResource("instance", "desk")).toMatchObject({
    data: {
      configuration: { value: { instanceOnly: true } },
      personalConfiguration: { value: { name: "Alice" } },
    },
  });
});

test("personal connection choices list what each server function needs, from connections the user may use", async () => {
  const { app } = await openApp(helpdesk());

  expect(
    await app.readResource("personalConnectionOptions", "desk"),
  ).toMatchObject({
    status: "ready",
    data: {
      init: [],
      serverFunctions: {
        lookup: [{ key: "mailbox", options: ["alice-mail"] }],
      },
    },
  });
  expect(
    await app.execute(personal, "serverFunction", {
      key: "lookup",
      inputs: { host: true },
      connections: [{ key: "mailbox", id: "alice-mail" }],
    }),
  ).toEqual({ status: "success", data: { looked: { host: true } } });
});

test("saving and removing personal settings show on the instance without opening them again", async () => {
  const { app } = await openApp(helpdesk());
  expect(await app.readResource("instance", "desk")).toMatchObject({
    data: { personalConfiguration: { saved: false, value: null } },
  });

  await app.execute(personal, "save", { value: { name: "Alice" } });
  await eventually(async () =>
    expect(await app.readResource("instance", "desk")).toMatchObject({
      data: {
        personalConfiguration: { saved: true, value: { name: "Alice" } },
      },
    }),
  );

  await app.execute(personal, "remove");
  await eventually(async () =>
    expect(await app.readResource("instance", "desk")).toMatchObject({
      data: { personalConfiguration: { saved: false, value: null } },
    }),
  );
});
