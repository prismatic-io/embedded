import { afterEach, expect, test } from "vitest";
import { type Client, createClient, type Ui } from "./index.js";
import {
  type FakeFrame,
  fakeInstanceState,
  fakeUserConfigurationRecord,
  installFakeFrame,
} from "./testing/index.js";

const origin = "https://app.example.com";
const instanceId = "instance";
let frame: FakeFrame | undefined;
let client: Client | undefined;

afterEach(() => {
  client?.dispose();
  frame?.restore();
});

test.each<{ ui: Ui | null | undefined }>([
  { ui: { type: "uiSchema", value: { type: "VerticalLayout", elements: [] } } },
  {
    ui: {
      type: "custom",
      value: { widgets: ["color", { options: [1, null] }] },
    },
  },
  { ui: { type: "custom", value: ["host", 42, false, null] } },
  { ui: { type: "custom", value: "host-defined" } },
  { ui: { type: "custom", value: null } },
  { ui: null },
  { ui: undefined },
])("carries the full instance and personal UI envelope over RPC: $ui", async ({
  ui,
}) => {
  frame = installFakeFrame({
    origin,
    instances: [
      fakeInstanceState({ id: instanceId, integrationId: "integration" }),
    ],
    configurations: { integration: { schema: {}, ui } },
    userConfigurations: { integration: { schema: {}, ui } },
    userConfigurationRecords: [
      fakeUserConfigurationRecord({
        principal: "alice",
        instanceId,
        userLevelConfigId: "alice-ulc",
        configurationId: "alice-json",
        value: { private: "alice" },
      }),
      fakeUserConfigurationRecord({
        principal: "bob",
        instanceId,
        userLevelConfigId: "bob-ulc",
        configurationId: "bob-json",
        value: { private: "bob" },
      }),
    ],
  });
  client = await createClient({ prismaticUrl: origin, jwt: "alice" });
  const api = client.authenticated;
  if (!api) throw new Error("Client did not authenticate.");
  const instance = await api.instances.get(instanceId);
  const configuration = await instance.configuration();
  const personal = await instance.userConfiguration();
  for (const target of [configuration, personal]) {
    const state = await target.refresh();
    expect(state.ui).toEqual(ui);
    expect(state).not.toHaveProperty("uiSchema");
    if (ui === undefined) expect(state).not.toHaveProperty("ui");
    const reader = (await target.state()).getReader();
    const emission = await reader.read();
    expect(emission.value?.ui).toEqual(ui);
    expect(emission.value).not.toHaveProperty("uiSchema");
    await reader.cancel();
  }
  expect((await personal.refresh()).value).toEqual({ private: "alice" });
  const bob = client.authenticate("bob");
  await bob.getSessionScope();
  const other = await (await bob.instances.get(instanceId)).userConfiguration();
  expect(await other.refresh()).toMatchObject({ value: { private: "bob" } });
  expect((await other.refresh()).ui).toEqual(ui);
});
