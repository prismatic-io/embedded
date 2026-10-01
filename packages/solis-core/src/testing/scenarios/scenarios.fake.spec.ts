import {
  type PreAuthApi,
  type PrismaticApi,
  redactError,
} from "../../protocol/index.js";
import { newMessagePortRpcSession, type RpcStub } from "capnweb";
import { afterEach, describe, expect, it } from "vitest";
import { FakePreAuthApi, withConnectionStatus } from "../fakeFrame.js";
import { toFakeStores } from "./fakeWorld.js";
import { type Scenario, scenarios, worldConnectionId } from "./index.js";

const channels: MessageChannel[] = [];

afterEach(() => {
  for (const channel of channels.splice(0)) {
    channel.port1.close();
    channel.port2.close();
  }
});

const runAgainstFake = async (scenario: Scenario) => {
  const channel = new MessageChannel();
  channels.push(channel);
  const stores = toFakeStores(scenario.world);
  newMessagePortRpcSession(channel.port1, new FakePreAuthApi(stores), {
    onSendError: redactError,
  });
  const root: RpcStub<PreAuthApi> = newMessagePortRpcSession<PreAuthApi>(
    channel.port2,
  );
  await scenario.run({
    signIn: async (principal) =>
      (await root.authenticate(
        `${principal}:token`,
      )) as unknown as PrismaticApi,
    expect,
    backend: {
      setConnectionStatus: (name, status) => {
        const connection = scenario.world.connections?.find(
          (candidate) => candidate.name === name,
        );
        const current =
          connection && stores.connections.get(worldConnectionId(connection));
        if (!current) throw new Error(`No connection ${name}`);
        stores.connections.set(withConnectionStatus(current, status));
      },
    },
  });
};

describe("protocol scenarios against the fake frame", () => {
  for (const scenario of scenarios) {
    const name = `${scenario.id}: ${scenario.title}`;
    if (scenario.knownFakeGap)
      it.fails(`${name} (known fake gap: ${scenario.knownFakeGap})`, () =>
        runAgainstFake(scenario));
    else it(name, () => runAgainstFake(scenario));
  }
});
