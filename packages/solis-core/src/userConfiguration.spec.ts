import {
  type FakeFrame,
  fakeInstanceState,
  fakeUserConfigurationRecord,
  installFakeFrame,
} from "./testing/index.js";
import { afterEach, expect, test } from "vitest";
import { type Client, createClient, hasFeature } from "./index.js";
import { createAction, disposeQuietly } from "./internal.js";

const origin = "https://app.example.com";
const instanceId = "instance";
let frame: FakeFrame | undefined;
let client: Client | undefined;
afterEach(() => {
  client?.dispose();
  client = undefined;
  frame?.restore();
  frame = undefined;
});

const connect = async () => {
  client = await createClient({ prismaticUrl: origin, jwt: "alice" });
  const api = client.authenticated;
  if (!api) throw new Error("Client did not authenticate.");
  const instance = await api.instances.get(instanceId);
  const target = await instance.userConfiguration();
  return { api, instance, target, client };
};

test("wire discovery and user save update the existing record without deploying", async () => {
  frame = installFakeFrame({
    origin,
    instances: [
      fakeInstanceState({
        id: instanceId,
        deployed: true,
        integrationId: "integration",
      }),
    ],
    userConfigurationRecords: [
      fakeUserConfigurationRecord({
        principal: "alice",
        instanceId,
        userLevelConfigId: "existing-ulc",
      }),
    ],
  });
  const { client: connected, instance, target } = await connect();
  expect(hasFeature(connected.serverInfo, "userConfiguration")).toBe(true);
  expect(await target.refresh()).toMatchObject({
    configured: true,
    value: null,
    schema: null,
  });
  const before = frame.instances.get(instanceId);
  const action = createAction({
    execute: (input: { value: unknown }) => target.save(input),
  });
  expect(await action.getSnapshot().execute({ value: {} })).toEqual({
    status: "success",
    data: undefined,
  });
  const saved = await target.refresh();
  expect(saved.configured).toBe(true);
  expect(saved.value).toEqual({});
  expect(
    frame.userConfigurationRecords
      .list()
      .find((record) => record.principal === "alice")?.userLevelConfigId,
  ).toBe("existing-ulc");
  expect(frame.instances.get(instanceId)).toBe(before);
  action.dispose();
  disposeQuietly(target);
  disposeQuietly(instance);
});

test("user target and functions reject after session revocation; another user sees no saved value", async () => {
  frame = installFakeFrame({
    origin,
    instances: [
      fakeInstanceState({
        id: instanceId,
        deployed: true,
        integrationId: "integration",
      }),
    ],
    userConfigurations: {
      integration: {
        schema: true,
        serverFunctions: [
          {
            key: "echo",
            label: "Echo",
            description: null,
            inputSchema: null,
            outputSchema: null,
            permission: { allowed: true, reason: null },
            execute: ({ inputs }) => inputs,
          },
        ],
      },
    },
  });
  const { client: connected, target } = await connect();
  await target.save({ value: { private: true } });
  const fn = await target.createServerFunction({ key: "echo" });
  expect(await fn.execute({ inputs: 42 })).toEqual({
    status: "success",
    data: 42,
  });
  const bob = connected.authenticate("bob");
  await bob.getSessionScope();
  await expect(target.refresh()).rejects.toMatchObject({
    code: "PRISMATIC_SESSION_REVOKED",
  });
  await expect(fn.execute({ inputs: 42 })).rejects.toMatchObject({
    code: "PRISMATIC_SESSION_REVOKED",
  });
  const otherInstance = await bob.instances.get(instanceId);
  const other = await otherInstance.userConfiguration();
  expect(await other.refresh()).toMatchObject({
    configured: false,
    value: null,
  });
});
