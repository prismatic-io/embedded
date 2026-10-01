/** A user leaves a screen while its work is still in flight. */

import { expect, test } from "vitest";
import { openApp, type World } from "./harness.js";

const world: World = {
  integrations: [
    { id: "crm", name: "CRM", allowMultipleInstances: true },
    ...["A", "B", "C", "D", "E"].map((name) => ({
      id: `listing-${name}`,
      name,
    })),
  ],
  instances: [
    { id: "store", integrationId: "crm", value: { region: "us" } },
    { id: "unfinished", integrationId: "crm", deployed: false },
  ],
};

test("an activation still running when the user leaves creates the instance anyway", async () => {
  const { app, backend } = await openApp(world);
  await app.readResource("listing", "crm");
  const stalled = backend.hold("marketplace.activate");

  const activation = app.execute({ kind: "listing", id: "crm" }, "activate", {
    name: "Late",
  });
  await stalled.reached;
  await app.unmount();
  stalled.release();
  await activation;

  expect(backend.instances("crm").map(({ name }) => name)).toContain("Late");
});

test("a deploy still running when the user leaves still deploys", async () => {
  const { app, backend } = await openApp(world);
  const unfinished = { kind: "instance", id: "unfinished" } as const;
  await app.readResource("instance", "unfinished");
  const stalled = backend.hold("configuration.deploy");

  const deploying = app.execute(unfinished, "deploy");
  await stalled.reached;
  await app.unmount();
  stalled.release();
  await deploying;

  expect(backend.instance("unfinished")?.deployed).toBe(true);
});

test("a save still running when the user leaves still saves", async () => {
  const { app, backend } = await openApp(world);
  await app.readResource("configuration", "store");
  const stalled = backend.hold("configuration.save");

  const saving = app.execute({ kind: "configuration", id: "store" }, "save", {
    value: { region: "eu" },
  });
  await stalled.reached;
  await app.unmount();
  stalled.release();
  await saving;

  expect(backend.instance("store")?.value).toEqual({ region: "eu" });
});

test("a marketplace page still loading when the user leaves reports the paging released and lands on nothing", async () => {
  const { app, backend } = await openApp(world);
  const paged = { list: "marketplace", filter: { pageSize: 2 } } as const;
  await app.readList("marketplace", { pageSize: 2 });
  const stalled = backend.hold("marketplace.list");

  const paging = app.execute(paged, "nextPage");
  await stalled.reached;
  await app.unmount();
  stalled.release();

  // The hygiene check after every spec shows the page that landed late was released too.
  expect(await paging).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_ACTION_DISPOSED" },
  });
});
