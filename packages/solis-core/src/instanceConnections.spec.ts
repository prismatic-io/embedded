import { afterEach, expect, test } from "vitest";
import { type Client, createClient, hasFeature } from "./index.js";
import {
  type FakeFrame,
  fakeConnectionState,
  fakeInstanceState,
  installFakeFrame,
} from "./testing/index.js";

const origin = "https://app.example.com";
let frame: FakeFrame | undefined;
let client: Client | undefined;
afterEach(() => {
  client?.dispose();
  client = undefined;
  frame?.restore();
  frame = undefined;
});

/** A version declaring the customer's Slack, for which the customer holds two credentials. */
const install = () => {
  frame = installFakeFrame({
    origin,
    connections: [
      fakeConnectionState({ id: "slack-ops" }),
      fakeConnectionState({ id: "slack-sales" }),
    ],
    instances: [
      fakeInstanceState({
        id: "enrichment",
        integrationId: "enrich-v1",
        deployed: false,
      }),
    ],
    configurations: {
      "enrich-v1": {
        schema: { type: "object" },
        connectionOptions: () => ({
          instance: [
            { key: "instance.slack", options: ["slack-ops", "slack-sales"] },
          ],
        }),
      },
    },
  });
};

const open = async () => {
  client = await createClient({ prismaticUrl: origin, jwt: "alice" });
  const api = client.authenticated;
  if (!api) throw new Error("Client did not authenticate.");
  const instance = await api.instances.get("enrichment");
  return { api, instance, configuration: await instance.configuration() };
};

test("the frame advertises linking instance connections", async () => {
  install();
  client = await createClient({ prismaticUrl: origin, jwt: "alice" });
  expect(hasFeature(client.serverInfo, "configuration.connections")).toBe(true);
});

test("instance requirements list every credential and none is selected until a save links one", async () => {
  install();
  const { configuration } = await open();
  const options = await configuration.readConnectionOptions();
  expect(
    options.instance?.map(({ key, selected }) => ({ key, selected })),
  ).toEqual([{ key: "instance.slack", selected: null }]);
  expect(options.instance?.[0]?.options).toHaveLength(2);
});

test("deploy fails while a customer connection is unlinked, and succeeds once a save links it", async () => {
  install();
  const { instance, configuration } = await open();
  expect(await configuration.save({ value: {} })).toEqual({
    status: "success",
    data: undefined,
  });
  // A thrown error keeps its code and message across RPC, not its other fields.
  await expect(instance.deploy()).rejects.toMatchObject({
    code: "PRISMATIC_CONNECTION_UNAVAILABLE",
    message: expect.stringContaining("instance.slack"),
  });

  expect(
    await configuration.save({
      value: {},
      connections: [{ key: "instance.slack", id: "slack-sales" }],
    }),
  ).toEqual({ status: "success", data: undefined });
  expect(
    (await configuration.readConnectionOptions()).instance?.[0]?.selected,
  ).toBe("slack-sales");
  await instance.deploy();
  expect(frame?.instances.get("enrichment")).toMatchObject({ deployed: true });
});

test("a later save that omits connections keeps the link", async () => {
  install();
  const { configuration } = await open();
  await configuration.save({
    value: { a: 1 },
    connections: [{ key: "instance.slack", id: "slack-ops" }],
  });
  await configuration.save({ value: { a: 2 } });
  expect(
    (await configuration.readConnectionOptions()).instance?.[0]?.selected,
  ).toBe("slack-ops");
});

test("unknown keys and credentials not offered for the connection are refused without saving", async () => {
  install();
  const { configuration } = await open();
  expect(
    await configuration.save({
      value: { a: 1 },
      connections: [{ key: "instance.crm", id: "slack-ops" }],
    }),
  ).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_CONFIGURATION_INVALID" },
  });
  expect(
    await configuration.save({
      value: { a: 1 },
      connections: [{ key: "instance.slack", id: "someone-elses" }],
    }),
  ).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_CONFIGURATION_INVALID" },
  });
  expect(frame?.instances.get("enrichment")?.value).toBeUndefined();
});
