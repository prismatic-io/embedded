import { expect, test } from "vitest";
import { queryKey } from "./queryKey.js";

test("an inline literal produces one key regardless of how it was written", () => {
  const keys = new Set([
    queryKey({ limit: 25, searchTerm: "" }),
    queryKey({ searchTerm: "", limit: 25 }),
    queryKey({ limit: 25, searchTerm: "", missing: undefined }),
  ]);
  expect(keys.size).toBe(1);
});

test("a changed value produces a different key", () => {
  expect(queryKey({ limit: 25 })).not.toBe(queryKey({ limit: 26 }));
  expect(queryKey({ searchTerm: "" })).not.toBe(queryKey({ searchTerm: "a" }));
  // A nested change has to reach the key, or a filter object silently misses its refetch.
  expect(queryKey({ f: { a: 1 } })).not.toBe(queryKey({ f: { a: 2 } }));
});

test("array order is preserved", () => {
  expect(queryKey([["a", "eq", 1]])).not.toBe(queryKey([["a", "eq", 2]]));
  expect(queryKey(["a", "b"])).not.toBe(queryKey(["b", "a"]));
});

test("a stub compares by identity, not by value", () => {
  // Two stubs for the same entity are separate subscriptions; keying them the same would
  // collapse two live views into one.
  const one = fakeStub();
  const two = fakeStub();
  expect(queryKey({ stub: one })).toBe(queryKey({ stub: one }));
  expect(queryKey({ stub: one })).not.toBe(queryKey({ stub: two }));
});

test("a stub mixed into a literal is keyed without being enumerated", () => {
  const stub = fakeStub();
  // Enumerating a stub is a remote property access, so a key builder that walks it throws
  // — or worse, issues RPC from a render.
  expect(() => queryKey({ limit: 25, stub })).not.toThrow();
  expect(queryKey({ limit: 25, stub })).not.toBe(queryKey({ limit: 26, stub }));
});

test("a callback compares by identity and does not throw", () => {
  const fn = () => {};
  expect(queryKey({ onPick: fn })).toBe(queryKey({ onPick: fn }));
  expect(queryKey({ onPick: fn })).not.toBe(queryKey({ onPick: () => {} }));
});

test("values JSON cannot carry still produce a key", () => {
  const cyclic: Record<string, unknown> = { a: 1 };
  cyclic.self = cyclic;
  expect(() => queryKey(cyclic)).not.toThrow();
  expect(() => queryKey({ n: 1n })).not.toThrow();
  expect(queryKey({ n: 1n })).toBe(queryKey({ n: 1n }));
  expect(queryKey({ n: 1n })).not.toBe(queryKey({ n: 2n }));
  expect(() => queryKey({ s: Symbol.iterator })).not.toThrow();
});

test("a class instance compares by identity", () => {
  class Filter {
    constructor(readonly status: string) {}
  }
  const a = new Filter("ACTIVE");
  expect(queryKey({ f: a })).toBe(queryKey({ f: a }));
  expect(queryKey({ f: a })).not.toBe(queryKey({ f: new Filter("ACTIVE") }));
});

test("null and undefined are distinguished from each other and from absence", () => {
  const keys = new Set([
    queryKey({ a: null }),
    queryKey({ a: undefined }),
    queryKey({}),
  ]);
  // `{a: undefined}` and `{}` mean the same thing on the wire; `null` does not.
  expect(keys.size).toBe(2);
  expect(queryKey({ a: undefined })).toBe(queryKey({}));
});

test("a deep literal is keyed structurally rather than by identity", () => {
  const deep = (leaf: number) => ({
    a: { b: { c: { d: { e: { f: leaf } } } } },
  });
  expect(queryKey(deep(1))).toBe(queryKey(deep(1)));
  expect(queryKey(deep(1))).not.toBe(queryKey(deep(2)));
});

/**
 * A capnweb stub's shape where keying is concerned: a Proxy over a class instance, so its
 * prototype is not `Object.prototype`, and every property read is a round trip.
 */
class RpcStub {}
const fakeStub = () =>
  new Proxy(new RpcStub(), {
    get: (_target, key) => {
      throw new Error(`remote property access: ${String(key)}`);
    },
    ownKeys: () => {
      throw new Error("remote enumerate");
    },
  });
