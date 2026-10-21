import type { FeatureName } from "@prismatic-io/solis-core";
import {
  type FakeConfigurationSeed,
  type FakeFrame,
  fakeConnectionState,
  fakeInstanceState,
  fakeIntegrationState,
  installFakeFrame,
} from "@prismatic-io/solis-core/testing";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";
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

const install = (
  features?: FeatureName[],
  configuration: Partial<FakeConfigurationSeed> = {},
) => {
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
      fakeInstanceState({
        id: "inst-2",
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
        ...configuration,
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
  await waitFor(() =>
    expect(instanceRequirements()?.[0]?.selected).toBe("slack-ops"),
  );
});

test.each([
  { name: "value-only", input: { value: {} } },
  { name: "empty selections", input: { value: {}, connections: [] } },
])("$name saves also reload connection choices", async ({ input }) => {
  const connectionOptions = vi.fn(() => ({
    instance: [{ key: "instance.slack", options: ["slack-ops"] }],
  }));
  install(undefined, { connectionOptions });
  const hook = await loaded();
  await waitFor(() => {
    const current = hook.result.current;
    expect(
      current.status === "success" && current.data.connections.status,
    ).toBe("success");
  });
  const reads = connectionOptions.mock.calls.length;
  await act(async () => {
    await hook.result.current.actions.save.execute(input);
  });
  await waitFor(() =>
    expect(connectionOptions).toHaveBeenCalledTimes(reads + 1),
  );
});

test("a linking save refreshes current and pinned readers of the same instance", async () => {
  install();
  const hook = renderHook(
    () => ({
      current: useConfiguration({ instanceId: "inst-1" }),
      pinned: useConfiguration({
        instanceId: "inst-1",
        integrationVersionId: "int-1",
      }),
    }),
    { wrapper: Wrapper },
  );
  const selected = (kind: "current" | "pinned") => {
    const configuration = hook.result.current[kind];
    if (configuration.status !== "success") return undefined;
    const connections = configuration.data.connections;
    return connections.status === "success"
      ? connections.data.instance?.[0]?.selected
      : undefined;
  };
  await waitFor(() => {
    expect(selected("current")).toBe(null);
    expect(selected("pinned")).toBe(null);
  });
  await act(async () => {
    await hook.result.current.pinned.actions.save.execute(linking);
  });
  await waitFor(() => {
    expect(selected("current")).toBe("slack-ops");
    expect(selected("pinned")).toBe("slack-ops");
  });
});

test("a save finishing after navigation refreshes the saved instance, not the new screen", async () => {
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const connectionOptions = vi.fn(() => ({
    instance: [{ key: "instance.slack", options: ["slack-ops"] }],
  }));
  install(undefined, {
    connectionOptions,
    beforeSave: () => pending,
  });
  const screen = renderHook(
    ({ instanceId }) => ({
      screen: useConfiguration({ instanceId }),
      retained: useConfiguration({ instanceId: "inst-1" }),
    }),
    { wrapper: Wrapper, initialProps: { instanceId: "inst-1" } },
  );
  const selected = () => {
    const configuration = screen.result.current.screen;
    if (configuration.status !== "success") return undefined;
    const connections = configuration.data.connections;
    return connections.status === "success"
      ? connections.data.instance?.[0]?.selected
      : undefined;
  };
  await waitFor(() => expect(selected()).toBe(null));
  // Keep A mounted through a second reader in the same provider while navigating to B.
  let saving!: ReturnType<
    typeof screen.result.current.screen.actions.save.execute
  >;
  act(() => {
    saving = screen.result.current.screen.actions.save.execute(linking);
  });
  screen.rerender({ instanceId: "inst-2" });
  await waitFor(() => expect(selected()).toBe(null));
  const reads = connectionOptions.mock.calls.length;
  await act(async () => {
    finish();
    await saving;
  });
  await waitFor(() => {
    const configuration = screen.result.current.retained;
    const connections =
      configuration.status === "success"
        ? configuration.data.connections
        : undefined;
    expect(
      connections?.status === "success"
        ? connections.data.instance?.[0]?.selected
        : undefined,
    ).toBe("slack-ops");
  });
  expect(selected()).toBe(null);
  // One backend read validates the links; the other refreshes A's cached choices.
  expect(connectionOptions).toHaveBeenCalledTimes(reads + 2);
});

test("a rejected save does not refresh connection choices", async () => {
  const connectionOptions = vi.fn(() => ({
    instance: [{ key: "instance.slack", options: ["slack-ops"] }],
  }));
  install(undefined, {
    connectionOptions,
    saveError: {
      name: "Error",
      code: "PRISMATIC_CONFIGURATION_FORBIDDEN",
      message: "Save denied",
    },
  });
  const hook = await loaded();
  await waitFor(() => {
    const configuration = hook.result.current;
    expect(
      configuration.status === "success" &&
        configuration.data.connections.status,
    ).toBe("success");
  });
  const reads = connectionOptions.mock.calls.length;
  await act(async () => {
    expect(
      await hook.result.current.actions.save.execute(linking),
    ).toMatchObject({
      status: "error",
    });
  });
  expect(connectionOptions).toHaveBeenCalledTimes(reads);
});
