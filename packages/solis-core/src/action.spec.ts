import type { ConfigurationOperationError, Result } from "./protocol/index.js";
import { expect, test, vi } from "vitest";
import { createAction, toConfigurationError } from "./action.js";

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

test("action snapshots and returned results use the same discriminators and stable execute", async () => {
  const action = createAction({
    execute: async ({ value }: { value: string }) => ({
      status: "success" as const,
      data: value,
    }),
  });
  const idle = action.getSnapshot();
  expect(idle.status).toBe("idle");
  const listener = vi.fn();
  const unsubscribe = action.subscribe(listener);
  const pending = idle.execute({ value: "result" });
  expect(action.getSnapshot()).toMatchObject({
    status: "loading",
    execute: idle.execute,
  });
  expect(await pending).toEqual({ status: "success", data: "result" });
  expect(action.getSnapshot()).toEqual({
    status: "success",
    data: "result",
    execute: idle.execute,
  });
  expect(listener).toHaveBeenCalledTimes(2);
  unsubscribe();
  await idle.execute({ value: "again" });
  expect(listener).toHaveBeenCalledTimes(2);
  action.dispose();
});

test("overlapping execution returns BUSY without publishing or replacing the current call", async () => {
  const gate = deferred<Result<string, ConfigurationOperationError>>();
  const execute = vi.fn(() => gate.promise);
  const action = createAction({ execute });
  const first = action.getSnapshot().execute(undefined);
  const loading = action.getSnapshot();
  const listener = vi.fn();
  action.subscribe(listener);
  expect(await loading.execute(undefined)).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_ACTION_BUSY" },
  });
  expect(action.getSnapshot()).toBe(loading);
  expect(listener).not.toHaveBeenCalled();
  expect(execute).toHaveBeenCalledOnce();
  gate.resolve({ status: "success", data: "first" });
  await first;
  expect(action.getSnapshot()).toMatchObject({
    status: "success",
    data: "first",
  });
  action.dispose();
});

test("structural errors retain validation fields and thrown errors permit retry", async () => {
  const error: ConfigurationOperationError = {
    name: "Error",
    message: "Invalid",
    code: "PRISMATIC_CONFIGURATION_INVALID",
    fields: [{ path: "/name", message: "Required" }],
  };
  let fail = true;
  const action = createAction({
    execute: async () => {
      if (fail) throw error;
      return { status: "success" as const, data: "retry" };
    },
  });
  expect(await action.getSnapshot().execute(undefined)).toEqual({
    status: "error",
    error,
  });
  expect(action.getSnapshot()).toMatchObject({ status: "error", error });
  fail = false;
  expect(await action.getSnapshot().execute(undefined)).toEqual({
    status: "success",
    data: "retry",
  });
  expect(toConfigurationError("failure")).toMatchObject({
    code: "PRISMATIC_UNKNOWN",
    message: "failure",
  });
  action.dispose();
});

test("disposing an in-flight action publishes once and suppresses late completions", async () => {
  const gate = deferred<Result<string, ConfigurationOperationError>>();
  const execute = vi.fn(() => gate.promise);
  const action = createAction({ execute });
  const pending = action.getSnapshot().execute(undefined);
  const listener = vi.fn();
  action.subscribe(listener);
  action.dispose();
  const disposed = action.getSnapshot();
  expect(disposed).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_ACTION_DISPOSED" },
  });
  expect(listener).toHaveBeenCalledOnce();
  gate.resolve({ status: "success", data: "late" });
  expect(await pending).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_ACTION_DISPOSED" },
  });
  expect(action.getSnapshot()).toBe(disposed);
  expect(listener).toHaveBeenCalledOnce();
  expect(await disposed.execute(undefined)).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_ACTION_DISPOSED" },
  });
  expect(execute).toHaveBeenCalledOnce();
  action.dispose();
  expect(listener).toHaveBeenCalledOnce();
});

test("independent handles do not deduplicate identical inputs", async () => {
  const execute = vi.fn(async (value: string) => ({
    status: "success" as const,
    data: value,
  }));
  const first = createAction({ execute });
  const second = createAction({ execute });
  await Promise.all([
    first.getSnapshot().execute("same"),
    second.getSnapshot().execute("same"),
  ]);
  expect(execute).toHaveBeenCalledTimes(2);
  expect(first.getSnapshot()).not.toBe(second.getSnapshot());
  first.dispose();
  expect(second.getSnapshot().status).toBe("success");
  second.dispose();
});

test("an action is already released when disposal subscribers run", async () => {
  const execute = vi.fn(async () => ({
    status: "success" as const,
    data: "should not run",
  }));
  const action = createAction({ execute });
  const completions: Promise<Result<string, ConfigurationOperationError>>[] =
    [];
  action.subscribe(() => {
    const snapshot = action.getSnapshot();
    if (
      snapshot.status === "error" &&
      snapshot.error.code === "PRISMATIC_ACTION_DISPOSED"
    )
      completions.push(snapshot.execute(undefined));
  });
  action.dispose();
  expect(await Promise.all(completions)).toEqual([
    expect.objectContaining({
      status: "error",
      error: expect.objectContaining({ code: "PRISMATIC_ACTION_DISPOSED" }),
    }),
  ]);
  expect(execute).not.toHaveBeenCalled();
});

test("disposing from a loading notification prevents the operation from starting", async () => {
  const execute = vi.fn(async () => ({
    status: "success" as const,
    data: "must not run",
  }));
  const action = createAction({ execute });
  action.subscribe(() => {
    if (action.getSnapshot().status === "loading") action.dispose();
  });
  expect(await action.getSnapshot().execute(undefined)).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_ACTION_DISPOSED" },
  });
  expect(execute).not.toHaveBeenCalled();
});

test("a throwing subscriber cannot prevent execution, other notifications, or disposal", async () => {
  const execute = vi.fn(async () => ({
    status: "success" as const,
    data: "result",
  }));
  const action = createAction({ execute });
  action.subscribe(() => {
    throw new Error("observer failure");
  });
  const listener = vi.fn();
  action.subscribe(listener);
  expect(await action.getSnapshot().execute(undefined)).toEqual({
    status: "success",
    data: "result",
  });
  expect(execute).toHaveBeenCalledOnce();
  expect(listener).toHaveBeenCalledTimes(2);
  expect(() => action.dispose()).not.toThrow();
  expect(listener).toHaveBeenCalledTimes(3);
  expect(await action.getSnapshot().execute(undefined)).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_ACTION_DISPOSED" },
  });
  expect(execute).toHaveBeenCalledOnce();
});
