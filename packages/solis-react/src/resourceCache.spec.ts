import { afterEach, describe, expect, it, vi } from "vitest";
import { type OwnedValue, ResourceCache } from "./internal/resourceCache.js";

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

afterEach(() => vi.useRealTimers());

describe("ResourceCache leases and adoption", () => {
  it.each([
    "key",
    "prefix",
    "predicate",
  ] as const)("rejects a late unknown identity after %s invalidation without rejecting unrelated work", async (operation) => {
    const cache = new ResourceCache();
    const acquisition = cache.beginAcquisition();
    const load = async () => ({ value: "fresh" });
    if (operation === "key") cache.invalidate("x");
    else if (operation === "prefix") cache.invalidatePrefix("x");
    else cache.invalidateMatching((key) => key === "x");
    const unrelated = cache.retain({ key: "y", acquisition, load });
    await unrelated.ready;
    const current = cache.retain({ key: "x", load });
    await current.ready;
    const release = vi.fn();
    expect(() =>
      cache.retain({
        key: "x",
        acquisition,
        load,
        incoming: { value: "old", release },
      }),
    ).toThrow("revoked");
    expect(release).toHaveBeenCalledTimes(1);
    expect(current.snapshot().value).toBe("fresh");
    unrelated.release();
    current.release();
    acquisition.release();
    expect(cache.pendingAcquisitions).toBe(0);
    cache.close();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it("revokes old arrivals while preserving mounted subscriptions and retention", async () => {
    vi.useFakeTimers();
    const idleMs = 25;
    const cache = new ResourceCache(idleMs);
    const acquisition = cache.beginAcquisition();
    const listener = vi.fn();
    const off = cache.subscribe(listener);
    const unobserve = cache.observe("x");
    cache.revoke();
    expect(listener).toHaveBeenCalledTimes(1);
    const load = async () => ({ value: "fresh" });
    cache.snapshot("x", load);
    await cache.refetch("x");
    vi.advanceTimersByTime(idleMs * 100);
    expect(cache.peek("x")).toBe("success");
    const release = vi.fn();
    expect(() =>
      cache.retain({
        key: "x",
        acquisition,
        load,
        incoming: { value: "old scope", release },
      }),
    ).toThrow("revoked");
    expect(release).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(cache.pendingAcquisitions).toBe(0);
    acquisition.release();
    unobserve();
    vi.advanceTimersByTime(idleMs);
    expect(cache.size).toBe(0);
    off();
    cache.close();
  });

  it("adopts once, shares ownership, and uses the canonical refresh loader", async () => {
    vi.useFakeTimers();
    const idleMs = 25;
    const cache = new ResourceCache(idleMs);
    const release = vi.fn();
    const redundant = vi.fn();
    const load = vi.fn(async () => ({ value: "fresh" }));
    const first = cache.retain({
      key: "x",
      load,
      incoming: { value: "adopted", release },
    });
    const second = cache.retain({
      key: "x",
      load,
      incoming: { value: "older", release: redundant },
    });
    expect(first.ready).toBe(second.ready);
    await first.ready;
    expect(load).not.toHaveBeenCalled();
    expect(redundant).toHaveBeenCalledTimes(1);
    expect(second.snapshot().value).toBe("adopted");
    first.release();
    first.release();
    vi.advanceTimersByTime(idleMs);
    expect(cache.size).toBe(1);
    await cache.refetch("x");
    expect(second.snapshot().value).toBe("fresh");
    expect(load).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledTimes(1);
    second.release();
    vi.advanceTimersByTime(idleMs - 1);
    const reacquired = cache.retain({ key: "x", load });
    vi.advanceTimersByTime(idleMs);
    expect(cache.size).toBe(1);
    reacquired.release();
    vi.advanceTimersByTime(idleMs);
    expect(cache.size).toBe(0);
  });

  it("reserves before a reentrant loader can compete", async () => {
    const cache = new ResourceCache();
    const redundant = vi.fn();
    const competing = vi.fn(async () => ({ value: "wrong" }));
    const load = vi.fn(async () => {
      const nested = cache.retain({
        key: "x",
        load: competing,
        incoming: { value: "wrong", release: redundant },
      });
      nested.release();
      return { value: "winner" };
    });
    const lease = cache.retain({ key: "x", load });
    await lease.ready;
    expect(load).toHaveBeenCalledTimes(1);
    expect(competing).not.toHaveBeenCalled();
    expect(redundant).toHaveBeenCalledTimes(1);
    expect(lease.snapshot().value).toBe("winner");
    lease.release();
    cache.close();
  });

  it.each([
    "close",
    "invalidate",
  ] as const)("does not let a lease released after %s affect a new entry", async (operation) => {
    vi.useFakeTimers();
    const idleMs = 25;
    const cache = new ResourceCache(idleMs);
    const load = async () => ({ value: "value" });
    const old = cache.retain({ key: "x", load });
    await old.ready;
    if (operation === "close") cache.close();
    else cache.invalidate("x");
    cache.snapshot("x", load);
    const current = cache.retain({ key: "x", load });
    await current.ready;
    old.release();
    vi.advanceTimersByTime(idleMs * 2);
    expect(cache.size).toBe(1);
    current.release();
    vi.advanceTimersByTime(idleMs);
    expect(cache.size).toBe(0);
  });

  it("refuses stale session adoption but not unrelated invalidation", async () => {
    const cache = new ResourceCache();
    const acquisition = cache.beginAcquisition();
    const release = vi.fn();
    const load = async () => ({ value: "new" });
    cache.invalidate("unrelated");
    const valid = cache.retain({ key: "x", load, acquisition });
    await valid.ready;
    cache.close();
    cache.snapshot("x", load);
    expect(() =>
      cache.retain({
        key: "x",
        load,
        acquisition,
        incoming: { value: "stale", release },
      }),
    ).toThrow("revoked");
    expect(release).toHaveBeenCalledTimes(1);
    acquisition.release();
    valid.release();
    cache.close();
  });

  it("unregisters completed acquisition guards and refuses their reuse", () => {
    const cache = new ResourceCache();
    const load = async () => ({ value: "new" });
    for (let round = 0; round < 100; round += 1) {
      const acquisition = cache.beginAcquisition();
      expect(cache.pendingAcquisitions).toBe(1);
      cache.invalidateMatching(() => false);
      acquisition.release();
      acquisition.release();
      expect(cache.pendingAcquisitions).toBe(0);
      const release = vi.fn();
      expect(() =>
        cache.retain({
          key: "x",
          load,
          acquisition,
          incoming: { value: "stale", release },
        }),
      ).toThrow("revoked");
      expect(release).toHaveBeenCalledTimes(1);
    }
    cache.close();
  });

  it("a released lease cannot refresh or change the loader of its replacement", async () => {
    const cache = new ResourceCache();
    const old = cache.retain({
      key: "x",
      load: async () => ({ value: "old" }),
    });
    await old.ready;
    cache.invalidate("x");
    const load = vi.fn(async () => ({ value: "current" }));
    const current = cache.retain({ key: "x", load });
    await current.ready;
    old.setLoader(async () => ({ value: "wrong" }));
    await old.refresh();
    expect(load).toHaveBeenCalledTimes(1);
    expect(old.snapshot().value).toBeUndefined();
    await current.refresh();
    expect(load).toHaveBeenCalledTimes(2);
    expect(current.snapshot().value).toBe("current");
    old.release();
    current.release();
    cache.close();
  });

  it("rolls back failed acquisitions and releases late owned results", async () => {
    vi.useFakeTimers();
    const cache = new ResourceCache(0);
    const error = new Error("failed");
    const failed = cache.retain({
      key: "failed",
      load: async () => {
        throw error;
      },
    });
    await expect(failed.ready).rejects.toBe(error);
    const redundant = vi.fn();
    const existing = cache.retain({
      key: "failed",
      load: async () => ({ value: "retry" }),
      incoming: { value: "stale", release: redundant },
    });
    await expect(existing.ready).rejects.toBe(error);
    expect(redundant).toHaveBeenCalledTimes(1);
    failed.release();
    existing.release();
    vi.advanceTimersByTime(0);
    expect(cache.size).toBe(0);
    const late = deferred<OwnedValue<string>>();
    const release = vi.fn();
    const pending = cache.retain({ key: "late", load: () => late.promise });
    pending.release();
    vi.advanceTimersByTime(0);
    late.resolve({ value: "late", release });
    await pending.ready;
    expect(release).toHaveBeenCalledTimes(1);
    expect(cache.size).toBe(0);
  });

  it("discards incoming state during refresh without replacing its authority", async () => {
    const cache = new ResourceCache();
    const next = deferred<OwnedValue<string>>();
    const load = vi
      .fn()
      .mockResolvedValueOnce({ value: "initial" })
      .mockReturnValueOnce(next.promise);
    const lease = cache.retain({ key: "x", load });
    await lease.ready;
    const refresh = cache.refetch("x");
    const release = vi.fn();
    const incoming = cache.retain({
      key: "x",
      load,
      incoming: { value: "older", release },
    });
    expect(incoming.ready).toBe(refresh);
    expect(incoming.snapshot()).toMatchObject({
      value: "initial",
      isRefetching: true,
    });
    expect(release).toHaveBeenCalledTimes(1);
    next.resolve({ value: "fresh" });
    await refresh;
    expect(incoming.snapshot().value).toBe("fresh");
    lease.release();
    incoming.release();
    cache.close();
  });
});

describe("ResourceCache refresh completion", () => {
  it("shares completion, retains success, and stores the replacement before releasing", async () => {
    const cache = new ResourceCache();
    const next = deferred<OwnedValue<string>>();
    const release = vi.fn(() =>
      expect(cache.peekSnapshot("key")?.value).toBe("new"),
    );
    const load = vi
      .fn()
      .mockResolvedValueOnce({ value: "old", release })
      .mockReturnValueOnce(next.promise);
    cache.snapshot("key", load);
    await cache.refetch("key");
    const first = cache.refetch("key");
    expect(cache.refetch("key")).toBe(first);
    expect(cache.peekSnapshot("key")).toMatchObject({
      status: "success",
      value: "old",
      isRefetching: true,
    });
    expect(release).not.toHaveBeenCalled();
    next.resolve({ value: "new" });
    await first;
    expect(release).toHaveBeenCalledTimes(1);
    expect(cache.peekSnapshot("key")).toMatchObject({
      status: "success",
      value: "new",
      isRefetching: false,
    });
    cache.close();
  });

  it("rejects refresh failure without dropping the last successful acquisition", async () => {
    const cache = new ResourceCache();
    const release = vi.fn();
    const error = new Error("refresh failed");
    const load = vi
      .fn()
      .mockResolvedValueOnce({ value: "old", release })
      .mockRejectedValueOnce(error);
    cache.snapshot("key", load);
    await cache.refetch("key");
    await expect(cache.refetch("key")).rejects.toBe(error);
    expect(cache.peekSnapshot("key")).toMatchObject({
      status: "success",
      value: "old",
      error: undefined,
      isRefetching: false,
    });
    expect(release).not.toHaveBeenCalled();
    cache.close();
    expect(release).toHaveBeenCalledTimes(1);
  });

  it.each([
    "close",
    "invalidate",
    "idle",
  ] as const)("releases a refresh result arriving after %s", async (operation) => {
    vi.useFakeTimers();
    const idleMs = 25;
    const cache = new ResourceCache(idleMs);
    const oldRelease = vi.fn();
    const newRelease = vi.fn();
    const next = deferred<OwnedValue<string>>();
    const load = vi
      .fn()
      .mockResolvedValueOnce({ value: "old", release: oldRelease })
      .mockReturnValueOnce(next.promise);
    cache.snapshot("key", load);
    const unobserve = cache.observe("key");
    await cache.refetch("key");
    const completion = cache.refetch("key");
    if (operation === "close") cache.close();
    else if (operation === "invalidate") cache.invalidate("key");
    else {
      unobserve();
      vi.advanceTimersByTime(idleMs);
    }
    expect(oldRelease).toHaveBeenCalledTimes(1);
    next.resolve({ value: "new", release: newRelease });
    await completion;
    expect(newRelease).toHaveBeenCalledTimes(1);
    expect(cache.size).toBe(0);
    cache.close();
  });

  it("reports synchronous loader failures and permits retry after initial failure", async () => {
    const cache = new ResourceCache();
    const error = new Error("guard failed");
    const load = vi.fn(() => {
      throw error;
    });
    cache.snapshot("key", load);
    await expect(cache.refetch("key")).rejects.toBe(error);
    expect(cache.peekSnapshot("key")?.status).toBe("error");
    cache.snapshot("key", async () => ({ value: "recovered" }));
    await cache.refetch("key");
    expect(cache.peekSnapshot("key")?.value).toBe("recovered");
    cache.close();
  });
});
