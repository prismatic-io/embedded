import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ResourceCache } from "./internal/resourceCache.js";
import { useApiHandle } from "./internal/useApiHandle.js";
import { useRead } from "./internal/useResource.js";

let cache = new ResourceCache();
const onRevoked = () => {};
vi.mock(import("./PrismaticProvider.js"), () => ({
  useResourceCache: () => cache,
  useSessionToken: () => "s0",
  useSessionRevoked: () => onRevoked,
}));
vi.mock(import("./internal/useApiHandle.js"), () => ({
  useApiHandle: vi.fn(),
}));

afterEach(() => {
  cache.close();
  cache = new ResourceCache();
});

it.each([
  "initial",
  "refresh",
] as const)("keeps a queued %s loader on its captured key", async (operation) => {
  vi.mocked(useApiHandle, { partial: true }).mockReturnValue({});
  const loads: string[] = [];
  const { result, rerender } = renderHook(
    ({ key, version }) =>
      useRead({
        key,
        load: async () => {
          loads.push(`${key}:${version}`);
          return { value: key };
        },
      }),
    { initialProps: { key: "a", version: 1 } },
  );
  if (operation === "refresh") {
    await act(async () => {
      await cache.refetch("s0:a");
    });
    act(() => {
      result.current.refresh();
    });
  }
  rerender({ key: "b", version: 1 });
  await act(async () => {
    await cache.refetch("s0:b");
  });
  expect(cache.peekSnapshot("s0:a")?.value).toBe("a");
  expect(cache.peekSnapshot("s0:b")?.value).toBe("b");
  expect(loads).toEqual(
    operation === "initial" ? ["a:1", "b:1"] : ["a:1", "a:1", "b:1"],
  );
});

it("uses the latest closure when the queued key and API still match", async () => {
  vi.mocked(useApiHandle, { partial: true }).mockReturnValue({});
  const { rerender } = renderHook(
    ({ value }) => useRead({ key: "a", load: async () => ({ value }) }),
    { initialProps: { value: "old" } },
  );
  rerender({ value: "latest" });
  await act(async () => {
    await cache.refetch("s0:a");
  });
  expect(cache.peekSnapshot("s0:a")?.value).toBe("latest");
});

it("pins the queued API while subsequent refresh uses the replacement handle", async () => {
  const first = {};
  const second = {};
  const handles: unknown[] = [];
  vi.mocked(useApiHandle, { partial: true }).mockReturnValue(first);
  const { rerender } = renderHook(() =>
    useRead({
      key: "a",
      load: async (api) => {
        handles.push(api);
        return { value: "a" };
      },
    }),
  );
  vi.mocked(useApiHandle, { partial: true }).mockReturnValue(second);
  rerender();
  await act(async () => {
    await cache.refetch("s0:a");
    await cache.refetch("s0:a");
  });
  expect(handles).toEqual([first, second]);
});
