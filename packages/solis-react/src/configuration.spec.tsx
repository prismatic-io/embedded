import type {
  ConfigurationResource,
  SaveConfigurationInput,
} from "@prismatic-io/solis-core";
import {
  type FakeConfigurationSeed,
  type FakeFrame,
  fakeInstanceState,
  fakeIntegrationState,
  installFakeFrame,
} from "@prismatic-io/solis-core/testing";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { type ReactNode, useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import {
  PrismaticProvider,
  useConfiguration,
  useInstance,
  useServerFunction,
} from "./index.js";

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

const seed = (
  configuration: Partial<FakeConfigurationSeed> = {},
  versions: Record<string, FakeConfigurationSeed> = {},
) => {
  frame = installFakeFrame({
    origin,
    integrations: [fakeIntegrationState({ id: "int-1" })],
    instances: [
      {
        ...fakeInstanceState({
          id: "inst-1",
          integrationId: "int-1",
          deployed: true,
        }),
        value: { region: "us" },
      },
    ],
    configurations: {
      "int-1": { schema: { type: "object" }, ...configuration },
      ...versions,
    },
  });
  return frame;
};
const success = (resource: ConfigurationResource) => {
  expect(resource.status).toBe("success");
  if (resource.status !== "success")
    throw new Error("Configuration not loaded");
  return resource;
};
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const current = { instanceId: "inst-1" };
const loaded = async () => {
  const hook = renderHook(() => useConfiguration(current), {
    wrapper: Wrapper,
  });
  await waitFor(() => expect(hook.result.current.status).toBe("success"));
  return hook;
};

test("target-version schedule requirements and schedule saves cross the React RPC boundary", async () => {
  const flows = [
    {
      id: "target-flow",
      name: "Daily sync",
      stableId: "stable-flow",
      scheduleFromDeployer: true,
    },
  ];
  const saves: SaveConfigurationInput[] = [];
  seed(
    {},
    {
      "int-2": {
        schema: {},
        flows,
        beforeSave: (input) => {
          saves.push(input);
        },
      },
    },
  );
  const hook = renderHook(
    () => ({
      configuration: useConfiguration({
        instanceId: "inst-1",
        integrationVersionId: "int-2",
      }),
      instance: useInstance("inst-1"),
    }),
    { wrapper: Wrapper },
  );
  await waitFor(() => {
    expect(hook.result.current.configuration.status).toBe("success");
    expect(hook.result.current.instance.status).toBe("success");
  });
  expect(success(hook.result.current.configuration).data.flows).toEqual(flows);
  const input: SaveConfigurationInput = {
    value: { region: "us" },
    flows: [{ flowId: flows[0].id, schedule: { expression: "none" } }],
  };
  await act(async () => {
    expect(
      await hook.result.current.configuration.actions.save.execute(input),
    ).toEqual({
      status: "success",
      data: undefined,
    });
  });
  expect(saves).toEqual([input]);
  await waitFor(() => {
    const instance = hook.result.current.instance;
    expect(instance.status).toBe("success");
    if (instance.status === "success")
      expect(instance.data.flows[0]).toMatchObject({
        id: flows[0].id,
        schedule: input.flows?.[0].schedule,
      });
  });
  await act(async () => {
    await hook.result.current.configuration.actions.save.execute({
      value: input.value,
    });
  });
  const instance = hook.result.current.instance;
  expect(instance.status).toBe("success");
  if (instance.status === "success")
    expect(instance.data.flows[0].schedule).toEqual(input.flows?.[0].schedule);
});

/** A configuration and server functions of it, each its own action. */
const withFunctions = async (
  keys: readonly string[],
  input: Parameters<typeof useConfiguration>[0] = current,
) => {
  const hook = renderHook(
    () => {
      const configuration = useConfiguration(input);
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

test("configuration data is plain, permissions are frame-derived, actions exist while loading", async () => {
  seed({
    permissions: { save: { allowed: false, reason: "role-restricted" } },
  });
  const hook = renderHook(() => useConfiguration(current), {
    wrapper: Wrapper,
  });
  expect(hook.result.current.actions.save.execute).toBeTypeOf("function");
  await waitFor(() => expect(hook.result.current.status).toBe("success"));
  const resource = success(hook.result.current);
  expect(resource.data).not.toHaveProperty("value");
  expect(resource.data).toMatchObject({
    integrationId: "int-1",
    isUpgrade: false,
  });
  expect(resource.data.permissions.save).toEqual({
    allowed: false,
    reason: "role-restricted",
  });
  expect(resource).not.toHaveProperty("draft");
  expect(resource).not.toHaveProperty("stub");
  expect(resource.actions.save.status).toBe("idle");
});

test("nullish identity stays loading without acquiring configuration", async () => {
  const beforeRead = vi.fn();
  seed({ beforeRead });
  const hook = renderHook(() => useConfiguration({ instanceId: null }), {
    wrapper: Wrapper,
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  expect(hook.result.current.status).toBe("loading");
  expect(beforeRead).not.toHaveBeenCalled();
});

test("readers share persisted data, one stream and refresh, but own their form values", async () => {
  const beforeRead = vi.fn();
  const beforeRefresh = vi.fn();
  const fake = seed({ beforeRead, beforeRefresh });
  const Form = ({ name }: { name: string }) => {
    const config = useConfiguration(current);
    const [value, setValue] = useState("");
    return (
      <>
        <input
          aria-label={name}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        <button onClick={() => void config.actions.refresh.execute()}>
          refresh {name}
        </button>
        <span data-testid={name}>
          {config.status === "success"
            ? config.data.integrationId
            : config.status}
        </span>
      </>
    );
  };
  render(
    <>
      <Form name="first" />
      <Form name="second" />
    </>,
    { wrapper: Wrapper },
  );
  await waitFor(() =>
    expect(screen.getByTestId("second")).toHaveTextContent("int-1"),
  );
  expect(beforeRead).toHaveBeenCalledTimes(1);
  expect(fake.instances.subscriberCount("inst-1")).toBe(1);
  fireEvent.change(screen.getByLabelText("first"), {
    target: { value: "unsaved" },
  });
  fireEvent.click(screen.getByText("refresh second"));
  await waitFor(() => expect(beforeRefresh).toHaveBeenCalledTimes(1));
  expect(screen.getByLabelText("first")).toHaveValue("unsaved");
  expect(screen.getByLabelText("second")).toHaveValue("");
});

test("init passes selected connections despite permission metadata without persisting", async () => {
  const authorData = ["notice", { next: 42 }];
  const init = vi.fn(() => authorData);
  const connections = [{ key: "airtable", id: "selected-connection" }];
  const fake = seed({
    init,
    permissions: { init: { allowed: false, reason: "role-restricted" } },
  });
  const before = fake.instances.get("inst-1");
  const hook = await loaded();
  await act(async () => {
    expect(
      await hook.result.current.actions.init.execute({ connections }),
    ).toEqual({
      status: "success",
      data: authorData,
    });
  });
  expect(init).toHaveBeenCalledWith({ value: before?.value, connections });
  expect(fake.instances.get("inst-1")).toEqual(before);
  expect(hook.result.current.actions.init).toMatchObject({
    status: "success",
    data: authorData,
  });
});

test("save passes schema-incompatible values despite permission metadata", async () => {
  const beforeSave = vi.fn();
  const fake = seed({
    schema: { type: "object", required: ["region"] },
    permissions: { save: { allowed: false, reason: "role-restricted" } },
    beforeSave,
  });
  const hook = await loaded();
  const value = ["host-owned value"];
  await act(async () => {
    expect(await hook.result.current.actions.save.execute({ value })).toEqual({
      status: "success",
      data: undefined,
    });
  });
  expect(beforeSave).toHaveBeenCalledWith({ value });
  expect(fake.instances.get("inst-1")?.value).toEqual(value);
});

test("explicit backend permission refusals remain action errors", async () => {
  const error = {
    name: "Error",
    code: "PRISMATIC_CONFIGURATION_FORBIDDEN" as const,
    message: "Backend authorization denied",
  };
  const fake = seed({ initError: error, saveError: error });
  const before = fake.instances.get("inst-1");
  const hook = await loaded();
  await act(async () => {
    expect(await hook.result.current.actions.init.execute({})).toEqual({
      status: "error",
      error,
    });
    expect(
      await hook.result.current.actions.save.execute({ value: "refused" }),
    ).toEqual({ status: "error", error });
  });
  expect(fake.instances.get("inst-1")).toEqual(before);
});

test("save accepts explicit values, the instance shows them, and nothing deploys", async () => {
  const fake = seed();
  const hook = renderHook(
    () => [useConfiguration(current), useInstance("inst-1")] as const,
    { wrapper: Wrapper },
  );
  await waitFor(() => {
    expect(hook.result.current[0].status).toBe("success");
    expect(hook.result.current[1].status).toBe("success");
  });
  const value = { region: "eu" };
  await act(async () => {
    expect(
      await hook.result.current[0].actions.save.execute({ value }),
    ).toEqual({ status: "success", data: undefined });
  });
  await waitFor(() =>
    expect(hook.result.current[1]).toMatchObject({
      data: { configuration: { value } },
    }),
  );
  expect(fake.instances.get("inst-1")).toMatchObject({
    value,
    needsDeploy: false,
  });
  expect(success(hook.result.current[0]).data.needsDeploy).toBe(false);
});

test("backend validation error preserves loaded data and retry succeeds", async () => {
  let invalid = true;
  seed({
    invalidate: () =>
      invalid ? [{ path: "/region", message: "Invalid region" }] : undefined,
  });
  const hook = await loaded();
  await act(async () => {
    expect(
      await hook.result.current.actions.save.execute({ value: {} }),
    ).toMatchObject({
      status: "error",
      error: {
        code: "PRISMATIC_CONFIGURATION_INVALID",
        fields: [{ path: "/region", message: "Invalid region" }],
      },
    });
  });
  expect(success(hook.result.current).data.integrationId).toBe("int-1");
  expect(hook.result.current.actions.save.status).toBe("error");
  invalid = false;
  await act(async () => {
    await hook.result.current.actions.save.execute({ value: { region: "eu" } });
  });
  expect(hook.result.current.actions.save.status).toBe("success");
});

test("one action rejects overlapping execution with BUSY without replacing its loading state", async () => {
  const gate = deferred<void>();
  const beforeSave = vi.fn(() => gate.promise);
  seed({ beforeSave });
  const hook = await loaded();
  let pending!: ReturnType<typeof hook.result.current.actions.save.execute>;
  act(() => {
    pending = hook.result.current.actions.save.execute({ value: "first" });
  });
  await waitFor(() => expect(beforeSave).toHaveBeenCalledOnce());
  await act(async () => {
    expect(
      await hook.result.current.actions.save.execute({ value: "second" }),
    ).toMatchObject({
      status: "error",
      error: { code: "PRISMATIC_ACTION_BUSY" },
    });
  });
  expect(hook.result.current.actions.save.status).toBe("loading");
  await act(async () => {
    gate.resolve();
    await pending;
  });
  expect(hook.result.current.actions.save.status).toBe("success");
  expect(beforeSave).toHaveBeenCalledOnce();
});

test("refresh preserves successful data on failure and exposes progress", async () => {
  const gate = deferred<void>();
  seed({
    beforeRefresh: () =>
      gate.promise.then(() => {
        throw new Error("read failed");
      }),
  });
  const hook = await loaded();
  let refresh!: Promise<unknown>;
  act(() => {
    refresh = hook.result.current.actions.refresh.execute();
  });
  expect(success(hook.result.current).isRefreshing).toBe(true);
  await act(async () => {
    gate.resolve();
    expect(await refresh).toMatchObject({
      status: "error",
      error: { code: "PRISMATIC_UNKNOWN" },
    });
  });
  expect(success(hook.result.current).data.integrationId).toBe("int-1");
  expect(success(hook.result.current).isRefreshing).toBe(false);
  expect(hook.result.current.actions.refresh).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_UNKNOWN" },
  });
});

const functionDefinition = (
  execute: NonNullable<FakeConfigurationSeed["init"]> = ({ value }) => value,
) => ({
  key: "listTables",
  label: "Tables",
  description: null,
  inputSchema: { type: "object", properties: { baseId: { type: "string" } } },
  outputSchema: { type: "array" },
  permission: { allowed: true as const, reason: null },
  execute: ({ inputs }: { inputs: unknown }) => execute({ value: inputs }),
});

test("server functions are independent actions, expose schemas, and impose no input ordering", async () => {
  const execute = vi.fn(({ value }) => value);
  seed({ serverFunctions: [functionDefinition(execute)] });
  const hook = await withFunctions(["listTables", "listTables"]);
  expect(
    success(hook.result.current.configuration).data.serverFunctions[0],
  ).toMatchObject({
    inputSchema: { type: "object" },
    outputSchema: { type: "array" },
  });
  const [first, second] = hook.result.current.functions;
  await act(async () => {
    expect(
      await first?.execute({ inputs: { baseId: "already-known" } }),
    ).toEqual({
      status: "success",
      data: { baseId: "already-known" },
    });
  });
  expect(hook.result.current.functions[0]?.status).toBe("success");
  expect(hook.result.current.functions[1]?.status).toBe("idle");
  await act(async () => {
    await second?.execute({ inputs: { baseId: "already-known" } });
  });
  expect(execute).toHaveBeenCalledTimes(2);
});

test("a server function keeps its identity across renders and while its configuration loads", async () => {
  seed({ serverFunctions: [functionDefinition(() => "ran")] });
  const hook = renderHook(
    () => {
      const configuration = useConfiguration(current);
      return {
        configuration,
        fn: useServerFunction(configuration, "listTables"),
      };
    },
    { wrapper: Wrapper },
  );
  const execute = hook.result.current.fn.execute;
  expect(await execute({ inputs: {} })).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_CONFIGURATION_UNAVAILABLE" },
  });
  await waitFor(() =>
    expect(hook.result.current.configuration.status).toBe("success"),
  );
  hook.rerender();
  expect(hook.result.current.fn.execute).toBe(execute);
  await act(async () => {
    expect(await hook.result.current.fn.execute({ inputs: {} })).toEqual({
      status: "success",
      data: "ran",
    });
  });
});

test("server functions preserve explicit backend connection refusals", async () => {
  const execute = vi.fn(() => "ok");
  const definition = functionDefinition(execute);
  const beforeFunction = vi.fn();
  seed({
    beforeFunction,
    serverFunctions: [
      definition,
      {
        ...definition,
        key: "requiresConnection",
        error: {
          name: "Error",
          code: "PRISMATIC_CONNECTION_UNAVAILABLE",
          message: "Backend rejected the selected connection",
        },
      },
    ],
  });
  const hook = await withFunctions(["listTables", "requiresConnection"]);
  const [free, required] = hook.result.current.functions;
  await act(async () => {
    expect(await free?.execute({ inputs: {} })).toEqual({
      status: "success",
      data: "ok",
    });
    expect(await required?.execute({ inputs: {} })).toMatchObject({
      status: "error",
      error: { code: "PRISMATIC_CONNECTION_UNAVAILABLE" },
    });
  });
  expect(execute).toHaveBeenCalledOnce();
  expect(beforeFunction).toHaveBeenCalledWith("requiresConnection");
});

test("a server function cannot outlive the component holding it", async () => {
  seed({ serverFunctions: [functionDefinition()] });
  const hook = await withFunctions(["listTables"]);
  const execute = hook.result.current.functions[0]?.execute;
  hook.unmount();
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
  expect(await execute?.({ inputs: {} })).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_ACTION_DISPOSED" },
  });
});

test("a newer version's configuration is advisory to init, and saving it moves the instance in one fake operation", async () => {
  let invalid = true;
  const init = vi.fn(() => "author migration advice");
  const fake = seed(
    {},
    {
      "int-2": {
        schema: { type: "object" },
        configurationVersion: "definition-2",
        versionNumber: 2,
        init,
        invalidate: () =>
          invalid ? [{ path: null, message: "Rejected" }] : undefined,
      },
    },
  );
  const original = fake.instances.get("inst-1");
  const hook = renderHook(
    () =>
      useConfiguration({ instanceId: "inst-1", integrationVersionId: "int-2" }),
    { wrapper: Wrapper },
  );
  await waitFor(() => expect(hook.result.current.status).toBe("success"));
  expect(success(hook.result.current).data).toMatchObject({
    integrationId: "int-2",
    versionNumber: 2,
    isUpgrade: true,
    configurationVersion: "definition-2",
  });
  await act(async () => {
    expect(await hook.result.current.actions.init.execute({})).toEqual({
      status: "success",
      data: "author migration advice",
    });
  });
  expect(init).toHaveBeenCalledWith({ value: original?.value });
  expect(fake.instances.get("inst-1")).toEqual(original);
  const input = { value: { region: "eu" } };
  await act(async () => {
    await hook.result.current.actions.save.execute(input);
  });
  expect(fake.instances.get("inst-1")).toEqual(original);
  invalid = false;
  await act(async () => {
    await hook.result.current.actions.save.execute(input);
  });
  expect(fake.instances.get("inst-1")).toMatchObject({
    value: input.value,
    integrationId: "int-2",
    integrationVersionNumber: 2,
    needsDeploy: true,
  });
  await waitFor(() =>
    expect(success(hook.result.current).data).toMatchObject({
      integrationId: "int-2",
      versionNumber: 2,
      isUpgrade: false,
      deployedVersion: original?.integrationVersionNumber,
    }),
  );
});

test("failed acquisition can retry and shows refresh progress on its error branch", async () => {
  let fail = true;
  seed({
    beforeRead: () => {
      if (fail) throw new Error("temporarily unavailable");
    },
  });
  const hook = renderHook(() => useConfiguration(current), {
    wrapper: Wrapper,
  });
  await waitFor(() => expect(hook.result.current.status).toBe("error"));
  fail = false;
  let refresh!: Promise<unknown>;
  act(() => {
    refresh = hook.result.current.actions.refresh.execute();
  });
  expect(hook.result.current).toMatchObject({
    status: "error",
    isRefreshing: true,
  });
  await act(async () => {
    await refresh;
  });
  expect(hook.result.current.status).toBe("success");
});

test("a server function's late response cannot publish after its component unmounts", async () => {
  const gate = deferred<unknown>();
  const execute = vi.fn(() => gate.promise);
  seed({ serverFunctions: [functionDefinition(execute)] });
  const hook = await withFunctions(["listTables"]);
  let pending!: Promise<unknown>;
  act(() => {
    pending = hook.result.current.functions[0]?.execute({
      inputs: {},
    }) as Promise<unknown>;
  });
  await waitFor(() => expect(execute).toHaveBeenCalledOnce());
  hook.unmount();
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
  await act(async () => {
    gate.resolve("late");
    expect(await pending).toMatchObject({
      status: "error",
      error: { code: "PRISMATIC_ACTION_DISPOSED" },
    });
  });
});

test("ignoring a failed action promise still exposes a typed error snapshot", async () => {
  seed({
    init: () => {
      throw new Error("author failed");
    },
  });
  const hook = await loaded();
  act(() => {
    void hook.result.current.actions.init.execute({});
  });
  await waitFor(() =>
    expect(hook.result.current.actions.init.status).toBe("error"),
  );
  expect(hook.result.current.actions.init).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_UNKNOWN" },
  });
  expect(hook.result.current.status).toBe("success");
});

test("revocation fails refresh structurally, disposes old actions and reacquires canonical data", async () => {
  const beforeRead = vi.fn();
  seed({
    beforeRead,
    beforeRefresh: () => {
      throw Object.assign(new Error("session revoked"), {
        code: "PRISMATIC_SESSION_REVOKED",
      });
    },
  });
  const hook = await loaded();
  const oldSave = hook.result.current.actions.save.execute;
  await act(async () => {
    expect(await hook.result.current.actions.refresh.execute()).toMatchObject({
      status: "error",
      error: { code: "PRISMATIC_SESSION_REVOKED" },
    });
  });
  await waitFor(() => expect(beforeRead).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(hook.result.current.status).toBe("success"));
  expect(hook.result.current.actions.save.execute).not.toBe(oldSave);
  expect(await oldSave({ value: {} })).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_ACTION_DISPOSED" },
  });
});

test("refresh recovers a failed state stream and subsequent persisted emissions remain live", async () => {
  const fake = seed();
  const hook = await loaded();
  const save = hook.result.current.actions.save.execute;
  act(() => fake.instances.failStreams("inst-1", new Error("stream failed")));
  await waitFor(() => expect(hook.result.current.status).toBe("error"));
  await act(async () => {
    await hook.result.current.actions.refresh.execute();
  });
  expect(success(hook.result.current).data.needsDeploy).toBe(false);
  expect(hook.result.current.actions.save.execute).toBe(save);
  const record = fake.instances.get("inst-1");
  if (record) act(() => fake.instances.set({ ...record, needsDeploy: true }));
  await act(async () => {
    const saved = await save({ value: { region: "eu" } });
    expect(saved.status).toBe("success");
  });
  await waitFor(() =>
    expect(success(hook.result.current).data.needsDeploy).toBe(true),
  );
});

test("canonical init and save progress is shared and survives refresh", async () => {
  const init = deferred<unknown>();
  const save = deferred<void>();
  seed({
    init: () => init.promise,
    beforeSave: () => save.promise,
  });
  const hook = renderHook(
    () => [useConfiguration(current), useConfiguration(current)] as const,
    { wrapper: Wrapper },
  );
  await waitFor(() => expect(hook.result.current[0].status).toBe("success"));
  const operations = [
    {
      key: "init" as const,
      execute: () => hook.result.current[0].actions.init.execute({}),
      complete: () => init.resolve("author data"),
    },
    {
      key: "save" as const,
      execute: () =>
        hook.result.current[0].actions.save.execute({
          value: { region: "eu" },
        }),
      complete: () => save.resolve(),
    },
  ];
  for (const operation of operations) {
    const execute = hook.result.current[0].actions[operation.key].execute;
    let pending!: ReturnType<typeof operation.execute>;
    act(() => {
      pending = operation.execute();
    });
    await waitFor(() => {
      expect(hook.result.current[0].actions[operation.key].status).toBe(
        "loading",
      );
      expect(hook.result.current[1].actions[operation.key].status).toBe(
        "loading",
      );
    });
    await act(async () => {
      await hook.result.current[1].actions.refresh.execute();
    });
    expect(hook.result.current[0].actions[operation.key].execute).toBe(execute);
    expect(hook.result.current[1].actions[operation.key].status).toBe(
      "loading",
    );
    await act(async () => {
      operation.complete();
      expect((await pending).status).toBe("success");
    });
    expect(hook.result.current[0].actions[operation.key].status).toBe(
      "success",
    );
    expect(hook.result.current[1].actions[operation.key].status).toBe(
      "success",
    );
  }
});

test("late completion for a previous instance cannot replace the next instance state", async () => {
  const gate = deferred<unknown>();
  const init = vi.fn(() => gate.promise);
  const fake = seed({ init });
  fake.instances.set({
    ...fakeInstanceState({
      id: "inst-2",
      integrationId: "int-1",
      deployed: true,
    }),
    value: { region: "other" },
  });
  const hook = renderHook(({ id }) => useConfiguration({ instanceId: id }), {
    initialProps: { id: "inst-1" },
    wrapper: Wrapper,
  });
  await waitFor(() => expect(hook.result.current.status).toBe("success"));
  let pending!: ReturnType<typeof hook.result.current.actions.init.execute>;
  act(() => {
    pending = hook.result.current.actions.init.execute({});
  });
  await waitFor(() => expect(init).toHaveBeenCalledOnce());
  hook.rerender({ id: "inst-2" });
  await waitFor(() =>
    expect(success(hook.result.current).data.instanceId).toBe("inst-2"),
  );
  await act(async () => {
    gate.resolve("old result");
    await pending;
  });
  expect(success(hook.result.current).data.instanceId).toBe("inst-2");
  expect(hook.result.current.actions.init.status).toBe("idle");
});

test("two holders of the same server function run concurrently without deduplicating calls", async () => {
  const gate = deferred<unknown>();
  const execute = vi.fn(() => gate.promise);
  seed({ serverFunctions: [functionDefinition(execute)] });
  const hook = await withFunctions(["listTables", "listTables"]);
  let pending!: Promise<unknown[]>;
  act(() => {
    pending = Promise.all(
      hook.result.current.functions.map((fn) =>
        fn.execute({ inputs: { baseId: "same" } }),
      ),
    );
  });
  await waitFor(() => expect(execute).toHaveBeenCalledTimes(2));
  expect(hook.result.current.functions.map(({ status }) => status)).toEqual([
    "loading",
    "loading",
  ]);
  await act(async () => {
    gate.resolve(["table"]);
    await pending;
  });
  for (const fn of hook.result.current.functions)
    expect(fn).toMatchObject({ status: "success", data: ["table"] });
});

test("function metadata does not gate invocation or rewrite selected connections", async () => {
  const execute = vi.fn(() => "ok");
  const definition = functionDefinition(execute);
  const connections = [{ key: "airtable", id: "selected-connection" }];
  const inputs = ["not an object"];
  seed({
    serverFunctions: [
      { ...definition, execute, key: "allowed" },
      {
        ...definition,
        execute,
        key: "restricted",
        permission: { allowed: false, reason: "role-restricted" },
      },
    ],
  });
  const hook = await withFunctions(["allowed", "restricted"]);
  for (const fn of hook.result.current.functions) {
    await act(async () => {
      expect(await fn.execute({ inputs, connections })).toEqual({
        status: "success",
        data: "ok",
      });
    });
  }
  expect(execute).toHaveBeenCalledTimes(2);
  expect(execute).toHaveBeenNthCalledWith(1, { inputs, connections });
  expect(execute).toHaveBeenNthCalledWith(2, { inputs, connections });
});

test("refresh after a failed stream fails if its replacement closes before emitting", async () => {
  let failStream = () => {};
  let closed = false;
  seed({
    stateStream: (state) =>
      new ReadableStream({
        start: (controller) => {
          if (closed) {
            controller.close();
            return;
          }
          controller.enqueue(state);
          failStream = () => controller.error(new Error("stream failed"));
        },
      }),
  });
  const hook = await loaded();
  act(() => {
    failStream();
  });
  await waitFor(() => expect(hook.result.current.status).toBe("error"));
  closed = true;
  await act(async () => {
    expect(await hook.result.current.actions.refresh.execute()).toMatchObject({
      status: "error",
      error: { code: "PRISMATIC_UNKNOWN" },
    });
  });
  expect(hook.result.current.status).toBe("error");
  expect(hook.result.current).not.toHaveProperty("data");
  closed = false;
  await act(async () => {
    await hook.result.current.actions.refresh.execute();
  });
  expect(success(hook.result.current).data.integrationId).toBe("int-1");
});

test("when the instance moves to another version, a server function runs the new version and an in-flight call on the old one never delivers", async () => {
  const gate = deferred<unknown>();
  let delayed = false;
  const oldExecute = vi.fn(() => (delayed ? gate.promise : "old"));
  seed(
    { serverFunctions: [functionDefinition(oldExecute)] },
    {
      "int-2": {
        schema: {},
        versionNumber: 2,
        serverFunctions: [functionDefinition(() => "new")],
      },
    },
  );
  const hook = renderHook(
    () => {
      const configuration = useConfiguration(current);
      const next = useConfiguration({
        instanceId: "inst-1",
        integrationVersionId: "int-2",
      });
      return {
        configuration,
        next,
        first: useServerFunction(configuration, "listTables"),
        second: useServerFunction(configuration, "listTables"),
      };
    },
    { wrapper: Wrapper },
  );
  await waitFor(() => {
    expect(hook.result.current.configuration.status).toBe("success");
    expect(hook.result.current.next.status).toBe("success");
  });
  const save = hook.result.current.configuration.actions.save.execute;
  await act(async () => {
    expect(
      await hook.result.current.first.execute({ inputs: {} }),
    ).toMatchObject({ status: "success", data: "old" });
  });
  delayed = true;
  let pending!: Promise<unknown>;
  act(() => {
    pending = hook.result.current.second.execute({ inputs: {} });
  });
  await waitFor(() => expect(oldExecute).toHaveBeenCalledTimes(2));
  await act(async () => {
    await hook.result.current.next.actions.save.execute({ value: {} });
  });
  await waitFor(() =>
    expect(success(hook.result.current.configuration).data.integrationId).toBe(
      "int-2",
    ),
  );
  expect(hook.result.current.configuration.actions.save.execute).toBe(save);
  await act(async () => {
    gate.resolve("stale");
    expect(await pending).toMatchObject({
      status: "error",
      error: { code: "PRISMATIC_ACTION_DISPOSED" },
    });
  });
  await act(async () => {
    expect(await hook.result.current.first.execute({ inputs: {} })).toEqual({
      status: "success",
      data: "new",
    });
  });
});

test("a function target acquired across a version change cannot execute", async () => {
  const gate = deferred<void>();
  const beforeFunction = vi.fn(() => gate.promise);
  const execute = vi.fn(() => "must not run");
  seed(
    { beforeFunction, serverFunctions: [functionDefinition(execute)] },
    {
      "int-2": {
        schema: {},
        versionNumber: 2,
        serverFunctions: [functionDefinition(execute)],
      },
    },
  );
  const hook = renderHook(
    () => {
      const configuration = useConfiguration(current);
      const next = useConfiguration({
        instanceId: "inst-1",
        integrationVersionId: "int-2",
      });
      return {
        configuration,
        next,
        fn: useServerFunction(configuration, "listTables"),
      };
    },
    { wrapper: Wrapper },
  );
  await waitFor(() => {
    expect(hook.result.current.configuration.status).toBe("success");
    expect(hook.result.current.next.status).toBe("success");
  });
  let pending!: Promise<unknown>;
  act(() => {
    pending = hook.result.current.fn.execute({ inputs: {} });
  });
  await waitFor(() => expect(beforeFunction).toHaveBeenCalledOnce());
  await act(async () => {
    await hook.result.current.next.actions.save.execute({ value: {} });
  });
  await waitFor(() =>
    expect(success(hook.result.current.configuration).data.integrationId).toBe(
      "int-2",
    ),
  );
  await act(async () => {
    gate.resolve();
    expect(await pending).toMatchObject({
      status: "error",
      error: { code: "PRISMATIC_ACTION_DISPOSED" },
    });
  });
  expect(execute).not.toHaveBeenCalled();
});

test("function target acquisition failure can retry on the same action handle", async () => {
  let fail = true;
  const beforeFunction = vi.fn(() => {
    if (fail) throw new Error("temporary factory failure");
  });
  seed({
    beforeFunction,
    serverFunctions: [functionDefinition(() => "retry worked")],
  });
  const hook = await withFunctions(["listTables"]);
  await act(async () => {
    expect(
      await hook.result.current.functions[0]?.execute({ inputs: {} }),
    ).toMatchObject({
      status: "error",
      error: { code: "PRISMATIC_UNKNOWN" },
    });
  });
  fail = false;
  await act(async () => {
    expect(
      await hook.result.current.functions[0]?.execute({ inputs: {} }),
    ).toEqual({
      status: "success",
      data: "retry worked",
    });
  });
  expect(beforeFunction).toHaveBeenCalledTimes(2);
});

test("a configuration remains usable for subsequent save and instance deploy after initial deployment", async () => {
  const fake = seed();
  const instance = fakeInstanceState({
    id: "inst-1",
    integrationId: "int-1",
    deployed: false,
  });
  fake.instances.set({ ...instance, value: {} });
  const hook = renderHook(
    () =>
      [
        useConfiguration({ instanceId: instance.id }),
        useInstance(instance.id),
      ] as const,
    { wrapper: Wrapper },
  );
  await waitFor(() => {
    expect(hook.result.current[0].status).toBe("success");
    expect(hook.result.current[1].status).toBe("success");
  });
  for (const value of ["first", "second"]) {
    await act(async () => {
      expect(
        (await hook.result.current[0].actions.save.execute({ value })).status,
      ).toBe("success");
      expect(
        (await hook.result.current[1].actions.deploy.execute()).status,
      ).toBe("success");
    });
    expect(fake.instances.get("inst-1")).toMatchObject({
      deployed: true,
      needsDeploy: false,
      value,
    });
  }
});
