import {
  type FakeFrame,
  fakeInstanceState,
  fakeIntegrationState,
  fakeUserConfigurationRecord,
  installFakeFrame,
} from "@prismatic-io/solis-core/testing";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";
import {
  PrismaticProvider,
  useInstance,
  useUserConfiguration,
} from "./index.js";

const origin = "https://app.example.com";
let frame: FakeFrame | undefined;
afterEach(() => {
  frame?.restore();
});
const wrapper = ({ children }: { children: ReactNode }) => (
  <PrismaticProvider prismaticUrl={origin} auth={{ token: "alice" }}>
    {children}
  </PrismaticProvider>
);

test("flow reads share state, selected keys replace and clear, rename streams, and user removal stays user-scoped", async () => {
  frame = installFakeFrame({
    origin,
    instances: [
      {
        ...fakeInstanceState({
          id: "instance",
          integrationId: "integration",
          deployed: true,
        }),
        flows: [
          {
            id: "flow",
            name: "Receive order",
            stableId: null,
            scheduleFromDeployer: false,
            schedule: null,
            webhookUrl: "https://example.com/webhook",
            apiKeys: ["old"],
            endpointSecurityType: "API_KEY",
            permissions: { updateApiKeys: { allowed: true, reason: null } },
          },
        ],
      },
    ],
    configurations: { integration: { schema: true } },
    userConfigurations: { integration: { schema: true } },
    userConfigurationRecords: [
      fakeUserConfigurationRecord({
        principal: "alice",
        instanceId: "instance",
        userLevelConfigId: "alice-config",
        configurationId: "alice-json",
        value: {},
      }),
      fakeUserConfigurationRecord({
        principal: "bob",
        instanceId: "instance",
        userLevelConfigId: "bob-config",
        configurationId: "bob-json",
        value: {},
      }),
    ],
  });
  const hook = renderHook(
    () => {
      const instance = useInstance("instance");
      return {
        instance,
        sibling: useInstance("instance"),
        user: useUserConfiguration("instance"),
      };
    },
    { wrapper },
  );
  await waitFor(() => {
    const resource = hook.result.current.instance;
    expect(resource.status === "success" && resource.data.flows[0].name).toBe(
      "Receive order",
    );
    expect(hook.result.current.user.status).toBe("success");
    expect(hook.result.current.instance.status).toBe("success");
  });
  await act(async () => {
    await hook.result.current.instance.actions.updateDetails.execute({
      name: "Renamed",
      flows: [{ flowId: "flow", apiKeys: ["new"] }],
    });
    await hook.result.current.user.actions.remove.execute();
  });
  await waitFor(() => {
    const sibling = hook.result.current.sibling;
    expect(
      sibling.status === "success" && sibling.data.flows[0].apiKeys,
    ).toEqual(["new"]);
    const instance = hook.result.current.instance;
    expect(instance.status === "success" && instance.data.name).toBe("Renamed");
    const user = hook.result.current.user;
    expect(user.status === "success" ? user.data.configured : null).toBe(false);
  });
  expect(
    frame.userConfigurationRecords
      .list()
      .find((record) => record.principal === "bob")?.userLevelConfigId,
  ).toBe("bob-config");
  await act(async () => {
    await hook.result.current.instance.actions.updateDetails.execute({
      flows: [{ flowId: "flow", apiKeys: [] }],
    });
  });
  await waitFor(() =>
    expect(
      hook.result.current.sibling.status === "success" &&
        hook.result.current.sibling.data.flows[0].apiKeys,
    ).toEqual([]),
  );
  const remove = hook.result.current.user.actions.remove.execute;
  await act(async () => {
    await hook.result.current.instance.actions.remove.execute();
  });
  await waitFor(() => {
    expect(hook.result.current.instance.status).toBe("error");
    expect(hook.result.current.user.status).toBe("error");
  });
  hook.unmount();
  await expect(remove()).resolves.toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_ACTION_DISPOSED" },
  });
});

test("same-id readers share all action executions and status across a first deployment", async () => {
  let finish!: () => void;
  const waiting = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const beforeDeploy = vi.fn(() => waiting);
  frame = installFakeFrame({
    origin,
    integrations: [fakeIntegrationState({ id: "integration" })],
    instances: [
      fakeInstanceState({
        id: "undeployed",
        integrationId: "integration",
        deployed: false,
      }),
    ],
    configurations: { integration: { schema: true, beforeDeploy } },
  });
  const hook = renderHook(
    () => [useInstance("undeployed"), useInstance("undeployed")],
    { wrapper },
  );
  await waitFor(() =>
    expect(
      hook.result.current.every((resource) => resource.status === "success"),
    ).toBe(true),
  );
  for (const key of [
    "deploy",
    "pause",
    "resume",
    "remove",
    "refresh",
    "updateDetails",
  ] as const) {
    expect(hook.result.current[0].actions[key].execute).toBe(
      hook.result.current[1].actions[key].execute,
    );
  }
  await act(async () => {
    await expect(
      hook.result.current[0].actions.pause.execute(),
    ).resolves.toMatchObject({
      status: "error",
      error: { code: "PRISMATIC_CONFIGURATION_INVALID" },
    });
  });
  expect(hook.result.current[1].actions.pause.status).toBe("error");
  let deploying!: ReturnType<
    (typeof hook.result.current)[0]["actions"]["deploy"]["execute"]
  >;
  act(() => {
    deploying = hook.result.current[0].actions.deploy.execute();
  });
  await waitFor(() =>
    expect(hook.result.current[1].actions.deploy.status).toBe("loading"),
  );
  await act(async () => {
    await expect(
      hook.result.current[1].actions.deploy.execute(),
    ).resolves.toMatchObject({
      status: "error",
      error: { code: "PRISMATIC_ACTION_BUSY" },
    });
    finish();
    await expect(deploying).resolves.toEqual({
      status: "success",
      data: undefined,
    });
  });
  await waitFor(() => {
    const resource = hook.result.current[1];
    expect(resource.status === "success" && resource.data.deployed).toBe(true);
    expect(resource.actions.deploy.status).toBe("success");
  });
  const refresh = hook.result.current[0].actions.refresh.execute;
  vi.spyOn(frame.instances, "get").mockImplementationOnce(() => {
    throw new Error("Refresh failed");
  });
  await act(async () => {
    await expect(refresh()).resolves.toMatchObject({
      status: "error",
      error: { message: "Refresh failed", code: "PRISMATIC_UNKNOWN" },
    });
  });
  expect(hook.result.current[1].actions.refresh.status).toBe("error");
  expect(hook.result.current[1].status).toBe("success");
  await act(async () => {
    await hook.result.current[1].actions.resume.execute();
    await expect(refresh()).resolves.toEqual({
      status: "success",
      data: undefined,
    });
    await hook.result.current[1].actions.deploy.execute();
  });
  expect(beforeDeploy).toHaveBeenCalledTimes(2);
  expect(hook.result.current[1].actions.refresh.status).toBe("success");
  hook.unmount();
});

test("instance actions cannot execute across a changed authenticated session", async () => {
  frame = installFakeFrame({
    origin,
    instances: [fakeInstanceState({ id: "instance", deployed: true })],
  });
  let jwt = "alice";
  const authenticated = ({ children }: { children: ReactNode }) => (
    <PrismaticProvider prismaticUrl={origin} auth={{ token: jwt }}>
      {children}
    </PrismaticProvider>
  );
  const hook = renderHook(() => useInstance("instance"), {
    wrapper: authenticated,
  });
  await waitFor(() => expect(hook.result.current.status).toBe("success"));
  const previous = hook.result.current.actions.updateDetails.execute;
  const previousRefresh = hook.result.current.actions.refresh.execute;
  jwt = "bob";
  hook.rerender();
  await waitFor(() => {
    expect(hook.result.current.status).toBe("success");
    expect(hook.result.current.actions.updateDetails.execute).not.toBe(
      previous,
    );
  });
  await expect(previous({ name: "Stale write" })).resolves.toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_ACTION_DISPOSED" },
  });
  await expect(previousRefresh()).resolves.toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_ACTION_DISPOSED" },
  });
  expect(frame.instances.get("instance")?.name).not.toBe("Stale write");
  hook.unmount();
});

test("an unchanged instance keeps the same resource and actions across rerenders", async () => {
  frame = installFakeFrame({
    origin,
    instances: [fakeInstanceState({ id: "instance", deployed: true })],
  });
  const hook = renderHook(() => useInstance("instance"), { wrapper });
  await waitFor(() => expect(hook.result.current.status).toBe("success"));
  const settled = hook.result.current;
  hook.rerender();
  expect(hook.result.current).toBe(settled);
  expect(hook.result.current.actions).toBe(settled.actions);
  hook.unmount();
});
