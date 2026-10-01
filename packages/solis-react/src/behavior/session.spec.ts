import { expect, test } from "vitest";
import { eventually, openApp, type World } from "./harness.js";

const world: World = {
  users: { alice: "admin", bob: "admin" },
  integrations: [{ id: "crm", name: "CRM" }],
  connections: [
    { id: "slack" },
    { id: "airtable", status: "PENDING", kind: "manualCustomerActivated" },
  ],
};

test("re-rendering the host with the same token neither reboots the frame nor signs in again", async () => {
  const { app, backend } = await openApp(world);
  await app.readList("marketplace");
  const boots = backend.frameBoots();
  const signIns = backend.signIns();

  for (let render = 0; render < 5; render += 1) await app.rerender();

  expect(backend.frameBoots()).toBe(boots);
  expect(backend.signIns()).toBe(signIns);
  expect(await app.readList("marketplace")).toMatchObject({
    rows: [{ name: "CRM" }],
  });
});

test("a new token signs in once more over the same frame", async () => {
  const { app, backend } = await openApp(world);
  await app.readList("marketplace");
  const boots = backend.frameBoots();
  const signIns = backend.signIns();

  await app.signInAs("alice:2");

  await eventually(() => expect(backend.signIns()).toBe(signIns + 1));
  expect(backend.frameBoots()).toBe(boots);
});

test("a refreshed token for the same user keeps what is on screen rather than re-listing it", async () => {
  const { app, backend } = await openApp(world);
  await app.readList("connections");
  const lists = backend.served("connections.list");

  await app.signInAs("alice:2");

  expect(await app.readList("connections")).toMatchObject({
    status: "ready",
    rows: [{ id: "slack" }, { id: "airtable" }],
  });
  expect(backend.served("connections.list")).toBe(lists);
});

test("a different user drops what is on screen and lists it again under their session", async () => {
  const { app, backend } = await openApp(world);
  await app.readList("connections");
  const lists = backend.served("connections.list");

  await app.signInAs("bob:1");

  await eventually(() =>
    expect(backend.served("connections.list")).toBe(lists + 1),
  );
  await eventually(async () =>
    expect(await app.readList("connections")).toMatchObject({
      status: "ready",
      rows: [{ id: "slack" }, { id: "airtable" }],
    }),
  );
});

test("connections list with their status and kind on one page, and refresh keeps them listed", async () => {
  const { app } = await openApp(world);
  const expected = {
    status: "ready",
    rows: [
      {
        id: "slack",
        label: "slack",
        kind: "customerActivated",
        status: "ACTIVE",
      },
      {
        id: "airtable",
        label: "airtable",
        kind: "manualCustomerActivated",
        status: "PENDING",
      },
    ],
    hasMore: false,
    hasPrevious: false,
  };

  expect(await app.readList("connections")).toMatchObject(expected);
  for (let round = 0; round < 3; round += 1) {
    expect(await app.refresh({ list: "connections" })).toMatchObject({
      status: "success",
    });
    expect(await app.readList("connections")).toMatchObject(expected);
  }
});

test("one connection reads, and refresh keeps it on screen", async () => {
  const { app } = await openApp(world);
  const expected = {
    status: "ready",
    data: { id: "airtable", status: "PENDING" },
  };

  expect(await app.readResource("connection", "airtable")).toMatchObject(
    expected,
  );
  for (let round = 0; round < 3; round += 1) {
    await app.refresh({ kind: "connection", id: "airtable" });
    expect(await app.readResource("connection", "airtable")).toMatchObject(
      expected,
    );
  }
});

test("connections narrow to one kind or one status", async () => {
  const { app } = await openApp(world);

  expect(
    await app.readList("connections", { kind: "manualCustomerActivated" }),
  ).toMatchObject({ status: "ready", rows: [{ id: "airtable" }] });
  expect(
    (await app.readList("connections", { status: "ACTIVE" })).rows.map(
      ({ id }) => id,
    ),
  ).toEqual(["slack"]);
});

test("a connection listed and read on its own is the same connection, refreshed together", async () => {
  const { app } = await openApp(world);
  await app.readList("connections");

  expect(await app.readResource("connection", "slack")).toMatchObject({
    status: "ready",
    data: { label: "slack", kind: "customerActivated" },
  });
  expect(
    await app.refresh({ list: "connections", item: "slack" }),
  ).toMatchObject({ status: "success" });
  expect(
    await app.readListItem("connections", undefined, "slack"),
  ).toMatchObject({ status: "ready", data: { id: "slack", status: "ACTIVE" } });
});

test("an unknown connection reads as not found", async () => {
  const { app } = await openApp(world);

  expect(await app.readResource("connection", "nope")).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_CONNECTION_NOT_FOUND" },
  });
});

test("a connection removed elsewhere reads as removed once the app reads it again, and leaves the list", async () => {
  const { app, backend } = await openApp(world);
  expect(await app.readResource("connection", "airtable")).toMatchObject({
    status: "ready",
  });
  await app.readList("connections");

  backend.removeConnection("airtable");
  await app.refresh({ kind: "connection", id: "airtable" });

  await eventually(async () =>
    expect(await app.readResource("connection", "airtable")).toMatchObject({
      status: "error",
      error: { code: "PRISMATIC_CONNECTION_REMOVED" },
    }),
  );
  expect(await app.refresh({ list: "connections" })).toMatchObject({
    status: "success",
  });
  expect(await app.readList("connections")).toMatchObject({
    status: "ready",
    rows: [{ id: "slack" }],
  });
});

test("nothing reads a connection without an id", async () => {
  const { app } = await openApp(world);

  expect(await app.readResource("connection", null)).toMatchObject({
    status: "loading",
  });
});
