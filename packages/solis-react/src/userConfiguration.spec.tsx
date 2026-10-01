import type { UserConfigurationResource } from "@prismatic-io/solis-core";
import { createClient } from "@prismatic-io/solis-core";
import { STATE_RELEASE_GRACE_MS } from "@prismatic-io/solis-core/internal";
import {
  type FakeFrame,
  FakePrismaticApi,
  type FakeUserConfigurationSeed,
  fakeInstanceState,
  fakeUserConfigurationRecord,
  installFakeFrame,
  type UserConfigurationRecord,
} from "@prismatic-io/solis-core/testing";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";
import {
  PrismaticProvider,
  useInstance,
  useServerFunction,
  useUserConfiguration,
} from "./index.js";

const origin = "https://app.example.com";
const instanceId = "inst-1";
const integrationId = "int-1";
const principal = "alice";
const Wrapper = ({ children }: { children: ReactNode }) => (
  <PrismaticProvider prismaticUrl={origin} auth={{ token: principal }}>
    {children}
  </PrismaticProvider>
);
let frame: FakeFrame | undefined;
afterEach(() => {
  vi.restoreAllMocks();
  frame?.restore();
  frame = undefined;
});

const seed = (
  configuration: Partial<FakeUserConfigurationSeed> = {},
  records: UserConfigurationRecord[] = [],
) => {
  frame = installFakeFrame({
    origin,
    instances: [
      {
        ...fakeInstanceState({ id: instanceId, integrationId, deployed: true }),
        value: { instanceOnly: true },
      },
    ],
    configurations: { [integrationId]: { schema: { type: "object" } } },
    userConfigurations: {
      [integrationId]: { schema: { type: "object" }, ...configuration },
      "int-2": {
        schema: false,
        serverFunctions: configuration.serverFunctions,
      },
    },
    userConfigurationRecords: records,
  });
  return frame;
};
const success = (resource: UserConfigurationResource) => {
  expect(resource.status).toBe("success");
  if (resource.status !== "success")
    throw new Error("User configuration not loaded");
  return resource;
};
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const loaded = async () => {
  const hook = renderHook(() => useUserConfiguration(instanceId), {
    wrapper: Wrapper,
  });
  await waitFor(() => expect(hook.result.current.status).toBe("success"));
  return hook;
};
/** The user's configuration and server functions of it, each its own action. */
const withFunctions = async (keys: readonly string[]) => {
  const hook = renderHook(
    () => {
      const configuration = useUserConfiguration(instanceId);
      return {
        configuration,
        functions: keys.map((key) => useServerFunction(configuration, key)),
      };
    },
    { wrapper: Wrapper },
  );
  await waitFor(() =>
    expect(hook.result.current.configuration.status).toBe("success"),
  );
  return hook;
};
const functionSeed = (execute = vi.fn(async () => "answer")) => ({
  key: "lookup",
  label: "Lookup",
  description: null,
  inputSchema: null,
  outputSchema: null,
  permission: { allowed: true, reason: null } as const,
  execute,
});

test.each([
  {
    record: { userLevelConfigId: null, configurationId: null, value: null },
    configured: false,
    value: null,
  },
  {
    record: { userLevelConfigId: "ulc", configurationId: null, value: null },
    configured: true,
    value: null,
  },
  {
    record: { userLevelConfigId: "ulc", configurationId: "json", value: {} },
    configured: true,
    value: {},
  },
])("preserves persisted absence distinctions: configured $configured, value $value", async ({
  record,
  configured,
  value,
}) => {
  seed({}, [fakeUserConfigurationRecord({ principal, instanceId, ...record })]);
  const hook = await loaded();
  expect(success(hook.result.current).data).toMatchObject({
    configured,
    value,
  });
  expect(success(hook.result.current).data).not.toHaveProperty(
    "userLevelConfigId",
  );
  expect(success(hook.result.current).data).not.toHaveProperty(
    "configurationId",
  );
  expect(success(hook.result.current).data).not.toHaveProperty("scope");
  expect(hook.result.current).not.toHaveProperty("draft");
  expect(hook.result.current).not.toHaveProperty("stub");
});

test("null identity stays loading with usable action shapes and no user acquisition", async () => {
  const beforeRead = vi.fn();
  seed({ beforeRead });
  const hook = renderHook(
    () => {
      const resource = useUserConfiguration(null);
      return { resource, lookup: useServerFunction(resource, "lookup") };
    },
    { wrapper: Wrapper },
  );
  await act(async () => {
    await hook.result.current.resource.actions.refresh.execute();
  });
  expect(hook.result.current.resource.status).toBe("loading");
  expect(beforeRead).not.toHaveBeenCalled();
  await expect(
    hook.result.current.resource.actions.save.execute({ value: {} }),
  ).resolves.toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_CONFIGURATION_UNAVAILABLE" },
  });
  await expect(
    hook.result.current.lookup.execute({ inputs: {} }),
  ).resolves.toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_CONFIGURATION_UNAVAILABLE" },
  });
});

test("siblings share reads, save busy state, and refresh; instance configuration stays separate", async () => {
  const pendingSave = deferred<void>();
  const pendingRefresh = deferred<void>();
  const beforeRead = vi.fn();
  const beforeSave = vi.fn(() => pendingSave.promise);
  const beforeRefresh = vi.fn(() => pendingRefresh.promise);
  seed({ beforeRead, beforeSave, beforeRefresh });
  const hook = renderHook(
    () => ({
      first: useUserConfiguration(instanceId),
      second: useUserConfiguration(instanceId),
      instance: useInstance(instanceId),
    }),
    { wrapper: Wrapper },
  );
  await waitFor(() => {
    expect(hook.result.current.first.status).toBe("success");
    expect(hook.result.current.second.status).toBe("success");
    expect(hook.result.current.instance.status).toBe("success");
  });
  expect(beforeRead).toHaveBeenCalledTimes(1);
  expect(hook.result.current.first.actions.save.execute).toBe(
    hook.result.current.second.actions.save.execute,
  );
  let saved!: Promise<unknown>;
  act(() => {
    saved = hook.result.current.first.actions.save.execute({ value: {} });
  });
  await waitFor(() =>
    expect(hook.result.current.second.actions.save.status).toBe("loading"),
  );
  await act(async () => {
    await expect(
      hook.result.current.second.actions.save.execute({
        value: { second: true },
      }),
    ).resolves.toMatchObject({
      status: "error",
      error: { code: "PRISMATIC_ACTION_BUSY" },
    });
    pendingSave.resolve();
    await saved;
  });
  expect(beforeSave).toHaveBeenCalledTimes(1);
  expect(success(hook.result.current.second).data.value).toEqual({});
  const instance = hook.result.current.instance;
  expect(
    instance.status === "success" && instance.data.configuration.value,
  ).toEqual({
    instanceOnly: true,
  });
  let refreshed!: Promise<void>;
  let resolved = false;
  act(() => {
    refreshed = Promise.all([
      hook.result.current.first.actions.refresh.execute(),
      hook.result.current.second.actions.refresh.execute(),
    ]).then(() => {
      resolved = true;
    });
  });
  await waitFor(() => expect(beforeRefresh).toHaveBeenCalledTimes(1));
  expect(resolved).toBe(false);
  expect(success(hook.result.current.second).isRefreshing).toBe(true);
  await act(async () => {
    pendingRefresh.resolve();
    await refreshed;
  });
  expect(resolved).toBe(true);
  expect(beforeRead).toHaveBeenCalledTimes(1);
});

test("save creates and activates, updates the same IDs, uses backend data, and never deploys", async () => {
  const normalize = vi.fn(() => ({ trimmed: true }));
  const beforeCreate = vi.fn();
  const beforeUpdate = vi.fn();
  const beforeActivate = vi.fn();
  const f = seed({
    normalize,
    beforeCreate,
    beforeUpdate,
    beforeActivate,
    schema: false,
    permissions: { save: { allowed: false, reason: "role-restricted" } },
  });
  const instanceBefore = f.instances.get(instanceId);
  const hook = await loaded();
  expect(success(hook.result.current).data.permissions.save.allowed).toBe(
    false,
  );
  const submitted = { extra: "host data" };
  await act(async () => {
    await expect(
      hook.result.current.actions.save.execute({ value: submitted }),
    ).resolves.toEqual({ status: "success", data: undefined });
  });
  const created = success(hook.result.current).data;
  const createdRecord = f.userConfigurationRecords.list()[0];
  expect(created.configured).toBe(true);
  expect(createdRecord?.userLevelConfigId).toBeTypeOf("string");
  expect(createdRecord?.configurationId).toBeTypeOf("string");
  expect(created.value).toEqual({ trimmed: true });
  expect(submitted).toEqual({ extra: "host data" });
  await act(async () => {
    await hook.result.current.actions.save.execute({ value: {} });
  });
  expect(success(hook.result.current).data.configured).toBe(true);
  expect(f.userConfigurationRecords.list()[0]).toMatchObject({
    userLevelConfigId: createdRecord?.userLevelConfigId,
    configurationId: createdRecord?.configurationId,
  });
  expect(f.userConfigurationRecords.list()[0]?.active).toBe(true);
  expect(f.instances.get(instanceId)).toBe(instanceBefore);
  expect(normalize).toHaveBeenCalledTimes(2);
  expect(beforeCreate).toHaveBeenCalledExactlyOnceWith({ value: submitted });
  expect(beforeActivate).toHaveBeenCalledOnce();
  expect(beforeUpdate).toHaveBeenCalledExactlyOnceWith({ value: {} });
});

test("saving an existing inactive user record updates JSON without creating or activating it", async () => {
  const beforeCreate = vi.fn();
  const beforeUpdate = vi.fn();
  const beforeActivate = vi.fn();
  const f = seed({ beforeCreate, beforeUpdate, beforeActivate }, [
    fakeUserConfigurationRecord({
      principal,
      instanceId,
      userLevelConfigId: "existing",
      active: false,
    }),
  ]);
  const hook = await loaded();
  await act(async () => {
    await hook.result.current.actions.save.execute({ value: {} });
  });
  expect(beforeCreate).not.toHaveBeenCalled();
  expect(beforeActivate).not.toHaveBeenCalled();
  expect(beforeUpdate).toHaveBeenCalledExactlyOnceWith({ value: {} });
  expect(f.userConfigurationRecords.list()[0]?.active).toBe(false);
  expect(f.userConfigurationRecords.list()[0]?.userLevelConfigId).toBe(
    "existing",
  );
  expect(success(hook.result.current).data.configured).toBe(true);
});

test.each([
  "alice:rotated",
  "bob:first",
])("private reads and actions remain quarantined until %s scope is confirmed", async (nextJwt) => {
  const beforeRead = vi.fn();
  const beforeSave = vi.fn();
  const beforeFunction = vi.fn();
  seed(
    {
      beforeRead,
      beforeSave,
      beforeFunction,
      serverFunctions: [functionSeed()],
    },
    [
      fakeUserConfigurationRecord({
        principal,
        instanceId,
        userLevelConfigId: "alice-ulc",
        configurationId: "alice-json",
        value: { private: "alice" },
      }),
    ],
  );
  let jwt = "alice:first";
  const renders: UserConfigurationResource[] = [];
  let retainedFunction!: ReturnType<typeof useServerFunction>;
  const DynamicWrapper = ({ children }: { children: ReactNode }) => (
    <PrismaticProvider
      prismaticUrl={origin}
      auth={{ token: jwt }}
      resourceIdleMs={0}
    >
      {children}
    </PrismaticProvider>
  );
  const hook = renderHook(
    () => {
      const resource = useUserConfiguration(instanceId);
      const lookup = useServerFunction(resource, "lookup");
      retainedFunction ??= lookup;
      renders.push(resource);
      return resource;
    },
    { wrapper: DynamicWrapper },
  );
  await waitFor(() => expect(hook.result.current.status).toBe("success"));
  const previous = success(hook.result.current);
  const gate = deferred<void>();
  const original = FakePrismaticApi.prototype.getSessionScope;
  const scopeRead = vi
    .spyOn(FakePrismaticApi.prototype, "getSessionScope")
    .mockImplementation(async function () {
      const scope = await original.call(this);
      await gate.promise;
      return scope;
    });
  const transition = renders.length;
  jwt = nextJwt;
  hook.rerender();
  await waitFor(() => expect(scopeRead).toHaveBeenCalled());
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
    await expect(
      hook.result.current.actions.save.execute({ value: {} }),
    ).resolves.toMatchObject({
      status: "error",
      error: { code: "PRISMATIC_CONFIGURATION_UNAVAILABLE" },
    });
    await expect(
      previous.actions.save.execute({ value: {} }),
    ).resolves.toMatchObject({
      status: "error",
      error: { code: "PRISMATIC_CONFIGURATION_UNAVAILABLE" },
    });
    await expect(
      retainedFunction.execute({ inputs: {} }),
    ).resolves.toMatchObject({
      status: "error",
      error: { code: "PRISMATIC_CONFIGURATION_UNAVAILABLE" },
    });
  });
  for (const resource of renders.slice(transition)) {
    expect(resource.status).toBe("loading");
    expect(resource).not.toHaveProperty("data");
    expect(resource.actions.save.execute).not.toBe(
      previous.actions.save.execute,
    );
  }
  expect(beforeRead).toHaveBeenCalledTimes(1);
  expect(beforeSave).not.toHaveBeenCalled();
  expect(beforeFunction).not.toHaveBeenCalled();
  await act(async () => {
    gate.resolve();
  });
  await waitFor(() => expect(hook.result.current.status).toBe("success"));
  if (nextJwt.startsWith("alice")) {
    expect(beforeRead).toHaveBeenCalledTimes(1);
    expect(hook.result.current.actions.save.execute).toBe(
      previous.actions.save.execute,
    );
    expect(success(hook.result.current).data.value).toEqual({
      private: "alice",
    });
  } else {
    expect(beforeRead).toHaveBeenCalledTimes(2);
    expect(success(hook.result.current).data.value).toBeNull();
    expect(hook.result.current.actions.save.execute).not.toBe(
      previous.actions.save.execute,
    );
  }
});

test("save preserves structured server errors without persisting or deploying", async () => {
  const fields = [{ path: "/name", message: "Required" }];
  const f = seed({ invalidate: () => fields });
  const before = f.instances.get(instanceId);
  const hook = await loaded();
  await act(async () => {
    await expect(
      hook.result.current.actions.save.execute({ value: {} }),
    ).resolves.toMatchObject({
      status: "error",
      error: { code: "PRISMATIC_CONFIGURATION_INVALID", fields },
    });
  });
  expect(success(hook.result.current).data.configured).toBe(false);
  expect(f.instances.get(instanceId)).toBe(before);
});

test("refresh returns failures and recovers an errored subscription", async () => {
  const beforeRefresh = vi
    .fn<() => Promise<void>>()
    .mockRejectedValueOnce(new Error("refresh failed"))
    .mockResolvedValue(undefined);
  const f = seed({ beforeRefresh });
  const hook = await loaded();
  await act(async () => {
    await expect(
      hook.result.current.actions.refresh.execute(),
    ).resolves.toMatchObject({
      status: "error",
      error: { message: "refresh failed" },
    });
  });
  expect(hook.result.current.status).toBe("success");
  expect(hook.result.current.actions.save.execute).toBeTypeOf("function");
  await act(async () => {
    await hook.result.current.actions.refresh.execute();
  });
  expect(hook.result.current.status).toBe("success");
  const record = f.userConfigurationRecords.list()[0];
  if (!record) throw new Error("Expected an acquired user record.");
  act(() => {
    f.userConfigurationRecords.failStreams(
      record.id,
      new Error("stream failed"),
    );
  });
  await waitFor(() => expect(hook.result.current.status).toBe("error"));
  await act(async () => {
    await hook.result.current.actions.refresh.execute();
  });
  expect(hook.result.current.status).toBe("success");
});

test("refresh during an initial read awaits that effective read and returns its failure", async () => {
  let fail: ((error: Error) => void) | undefined;
  seed({
    stateStream: () =>
      new ReadableStream({
        start: (controller) => {
          fail = (error) => controller.error(error);
        },
      }),
  });
  const hook = renderHook(() => useUserConfiguration(instanceId), {
    wrapper: Wrapper,
  });
  await waitFor(() => expect(fail).toBeTypeOf("function"));
  let refresh!: ReturnType<typeof hook.result.current.actions.refresh.execute>;
  act(() => {
    refresh = hook.result.current.actions.refresh.execute();
  });
  await act(async () => {
    const rejected = expect(refresh).resolves.toMatchObject({
      status: "error",
      error: { message: "initial read failed" },
    });
    fail?.(new Error("initial read failed"));
    await rejected;
  });
  expect(hook.result.current.status).toBe("error");
});

test("server functions keep their own status, survive save and refresh, and follow the instance to a new version", async () => {
  const definition = functionSeed();
  const f = seed({ serverFunctions: [definition] });
  const hook = await withFunctions([definition.key, definition.key]);
  await act(async () => {
    await hook.result.current.functions[0]?.execute({
      inputs: { host: true },
      connections: [{ key: "service", id: "connection" }],
    });
  });
  expect(hook.result.current.functions[0]?.status).toBe("success");
  expect(hook.result.current.functions[1]?.status).toBe("idle");
  expect(definition.execute).toHaveBeenCalledWith({
    inputs: { host: true },
    connections: [{ key: "service", id: "connection" }],
  });
  const execute = hook.result.current.functions[0]?.execute;
  await act(async () => {
    await hook.result.current.configuration.actions.save.execute({ value: {} });
    await hook.result.current.configuration.actions.refresh.execute();
    await hook.result.current.functions[0]?.execute({ inputs: {} });
  });
  const instance = f.instances.get(instanceId);
  if (!instance) throw new Error("Expected a seeded instance.");
  f.instances.set({
    ...instance,
    integrationId: "int-2",
    integrationVersionNumber: 2,
  });
  await act(async () => {
    await hook.result.current.configuration.actions.refresh.execute();
  });
  await waitFor(() =>
    expect(success(hook.result.current.configuration).data.integrationId).toBe(
      "int-2",
    ),
  );
  expect(hook.result.current.functions[0]?.execute).toBe(execute);
  await act(async () => {
    for (const fn of hook.result.current.functions)
      await expect(fn.execute({ inputs: {} })).resolves.toMatchObject({
        status: "success",
      });
  });
});

test("a pending function acquisition is disposed on a version change, and unmounting releases every action", async () => {
  const pending = deferred<void>();
  const beforeFunction = vi.fn(() => pending.promise);
  const definition = functionSeed();
  const f = seed({ beforeFunction, serverFunctions: [definition] });
  const hook = await withFunctions([definition.key]);
  let result!: Promise<unknown>;
  act(() => {
    result = hook.result.current.functions[0]?.execute({
      inputs: {},
    }) as Promise<unknown>;
  });
  await waitFor(() => expect(beforeFunction).toHaveBeenCalledOnce());
  const instance = f.instances.get(instanceId);
  if (!instance) throw new Error("Expected a seeded instance.");
  f.instances.set({ ...instance, integrationId: "int-2" });
  await act(async () => {
    await hook.result.current.configuration.actions.refresh.execute();
  });
  await waitFor(() =>
    expect(success(hook.result.current.configuration).data.integrationId).toBe(
      "int-2",
    ),
  );
  await act(async () => {
    pending.resolve();
    await expect(result).resolves.toMatchObject({
      status: "error",
      error: { code: "PRISMATIC_ACTION_DISPOSED" },
    });
  });
  expect(definition.execute).not.toHaveBeenCalled();
  const save = hook.result.current.configuration.actions.save.execute;
  const lookup = hook.result.current.functions[0]?.execute;
  hook.unmount();
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  await expect(save({ value: {} })).resolves.toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_ACTION_DISPOSED" },
  });
  await expect(lookup?.({ inputs: {} })).resolves.toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_ACTION_DISPOSED" },
  });
});

test("token refresh preserves the cache but changing user resets data and disposes actions", async () => {
  const beforeRead = vi.fn();
  seed({ beforeRead }, [
    fakeUserConfigurationRecord({
      principal,
      instanceId,
      userLevelConfigId: "alice-ulc",
      configurationId: "alice-json",
      value: { private: "alice" },
    }),
  ]);
  let jwt = "alice:first";
  const DynamicWrapper = ({ children }: { children: ReactNode }) => (
    <PrismaticProvider prismaticUrl={origin} auth={{ token: jwt }}>
      {children}
    </PrismaticProvider>
  );
  const hook = renderHook(() => useUserConfiguration(instanceId), {
    wrapper: DynamicWrapper,
  });
  await waitFor(() =>
    expect(success(hook.result.current).data.value).toEqual({
      private: "alice",
    }),
  );
  const save = hook.result.current.actions.save.execute;
  jwt = "alice:rotated";
  hook.rerender();
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
  expect(beforeRead).toHaveBeenCalledTimes(1);
  expect(hook.result.current.actions.save.execute).toBe(save);
  jwt = "bob:first";
  hook.rerender();
  await waitFor(() =>
    expect(success(hook.result.current).data.value).toBeNull(),
  );
  expect(beforeRead).toHaveBeenCalledTimes(2);
  await expect(save({ value: "wrong user" })).resolves.toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_ACTION_DISPOSED" },
  });
});

test("a renewed session for the same user reacquires the resource and releases the old actions", async () => {
  const beforeRead = vi.fn();
  seed({ beforeRead });
  const client = await createClient({
    prismaticUrl: origin,
    jwt: "alice:first",
  });
  let jwt = "alice:first";
  const Attached = ({ children }: { children: ReactNode }) => (
    <PrismaticProvider client={client} auth={{ token: jwt }}>
      {children}
    </PrismaticProvider>
  );
  const hook = renderHook(() => useUserConfiguration(instanceId), {
    wrapper: Attached,
  });
  try {
    await waitFor(() => expect(hook.result.current.status).toBe("success"));
    const oldSave = hook.result.current.actions.save.execute;
    await act(async () => {
      await client.authenticate("temporary-other-session").getSessionScope();
    });
    jwt = "alice:new-session";
    hook.rerender();
    await waitFor(() => {
      expect(hook.result.current.status).toBe("success");
      expect(hook.result.current.actions.save.execute).not.toBe(oldSave);
    });
    expect(beforeRead).toHaveBeenCalledTimes(2);
    await expect(oldSave({ value: {} })).resolves.toMatchObject({
      status: "error",
      error: { code: "PRISMATIC_ACTION_DISPOSED" },
    });
  } finally {
    hook.unmount();
    client.dispose();
  }
});

test("provider disposal releases user streams and independent function stubs without disposing its attached client", async () => {
  const f = seed({ serverFunctions: [functionSeed()] });
  const client = await createClient({ prismaticUrl: origin, jwt: principal });
  const Attached = ({ children }: { children: ReactNode }) => (
    <PrismaticProvider client={client}>{children}</PrismaticProvider>
  );
  const settle = async () => {
    await new Promise((resolve) =>
      setTimeout(resolve, STATE_RELEASE_GRACE_MS * 2),
    );
    await f.flushStreams();
    return { ...client.stats(), streams: f.openStreams() };
  };
  const baseline = await settle();
  try {
    for (let cycle = 0; cycle < 2; cycle += 1) {
      const hook = renderHook(
        () => {
          const resource = useUserConfiguration(instanceId);
          return {
            resource,
            first: useServerFunction(resource, "lookup"),
            second: useServerFunction(resource, "lookup"),
          };
        },
        { wrapper: Attached },
      );
      await waitFor(() =>
        expect(hook.result.current.resource.status).toBe("success"),
      );
      await act(async () => {
        await hook.result.current.first.execute({ inputs: {} });
        await hook.result.current.second.execute({ inputs: {} });
      });
      expect(f.openStreams()).toBeGreaterThan(baseline.streams);
      hook.unmount();
      expect(await settle()).toEqual(baseline);
    }
    expect(await client.authenticated?.getAuthenticatedUser()).toMatchObject({
      id: `user-${principal}`,
    });
  } finally {
    client.dispose();
  }
});
