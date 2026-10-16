import type { FeatureName } from "@prismatic-io/solis-core";
import {
  type FakeFrame,
  fakeConnectionState,
  fakeInstanceState,
  fakeIntegrationState,
  installFakeFrame,
} from "@prismatic-io/solis-core/testing";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, test } from "vitest";
import { PrismaticProvider, useConfiguration } from "./index.js";

const origin = "https://app.example.com";
const Wrapper = ({ children }: { children: ReactNode }) => (
  <PrismaticProvider prismaticUrl={origin} auth={{ token: "jwt-1" }}>
    {children}
  </PrismaticProvider>
);
let frame: FakeFrame | undefined;
afterEach(() => {
  frame?.restore();
  frame = undefined;
});

const install = (features?: FeatureName[]) => {
  frame = installFakeFrame({
    origin,
    ...(features ? { features } : {}),
    connections: [fakeConnectionState({ id: "slack-ops" })],
    integrations: [fakeIntegrationState({ id: "int-1" })],
    instances: [
      fakeInstanceState({
        id: "inst-1",
        integrationId: "int-1",
        deployed: false,
      }),
    ],
    configurations: {
      "int-1": {
        schema: { type: "object" },
        connectionOptions: () => ({
          instance: [{ key: "instance.slack", options: ["slack-ops"] }],
        }),
      },
    },
  });
  return frame;
};

const loaded = async () => {
  const hook = renderHook(() => useConfiguration({ instanceId: "inst-1" }), {
    wrapper: Wrapper,
  });
  await waitFor(() => expect(hook.result.current.status).toBe("success"));
  return hook;
};

const linking = {
  value: { tone: "brief" },
  connections: [{ key: "instance.slack", id: "slack-ops" }],
} as const;

test("save passes connection links through to the frame", async () => {
  const fake = install();
  const hook = await loaded();
  let result: unknown;
  await act(async () => {
    result = await hook.result.current.actions.save.execute(linking);
  });
  expect(result).toEqual({ status: "success", data: undefined });
  expect(fake.instances.get("inst-1")).toMatchObject({
    connections: { "instance.slack": "slack-ops" },
  });
});

test("a frame without configuration.connections refuses links instead of dropping them", async () => {
  const fake = install([
    "authenticatedUser",
    "connections",
    "marketplace",
    "instances",
    "configuration",
  ]);
  const hook = await loaded();
  let result: unknown;
  await act(async () => {
    result = await hook.result.current.actions.save.execute(linking);
  });
  expect(result).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_CONFIGURATION_UNAVAILABLE" },
  });
  expect(fake.instances.get("inst-1")?.value).toBeUndefined();

  // A save without links is unaffected.
  await act(async () => {
    result = await hook.result.current.actions.save.execute({
      value: { tone: "brief" },
    });
  });
  expect(result).toEqual({ status: "success", data: undefined });
});

test("the configuration's connections list the instance's own, with the linked credential", async () => {
  install();
  const hook = await loaded();
  const instanceRequirements = () => {
    const current = hook.result.current;
    if (current.status !== "success") return undefined;
    const { connections } = current.data;
    return connections.status === "success"
      ? connections.data.instance
      : undefined;
  };
  await waitFor(() => expect(instanceRequirements()).toBeDefined());
  expect(
    instanceRequirements()?.map(({ key, selected }) => ({ key, selected })),
  ).toEqual([{ key: "instance.slack", selected: null }]);
  expect(instanceRequirements()?.[0]?.options.map(({ id }) => id)).toEqual([
    "slack-ops",
  ]);

  await act(async () => {
    await hook.result.current.actions.save.execute(linking);
  });
  const current = hook.result.current;
  if (current.status !== "success") throw new Error("not loaded");
  await act(async () => {
    await current.data.connections.actions.refresh.execute();
  });
  await waitFor(() =>
    expect(instanceRequirements()?.[0]?.selected).toBe("slack-ops"),
  );
});
