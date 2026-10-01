/** Structural identity for a query input, so a caller need not memoize an inline literal. */

/** Identity-compared values, keyed by an integer the key string can carry. */
class IdentityTable {
  // Symbols are valid WeakMap keys at runtime; the lib's key type does not say so.
  #ids = new WeakMap<object, number>();
  #next = 0;

  keyFor(value: object | symbol): number {
    const key = value as object;
    const existing = this.#ids.get(key);
    if (existing !== undefined) return existing;
    this.#next += 1;
    const id = this.#next;
    this.#ids.set(key, id);
    return id;
  }
}

const identities = /* @__PURE__ */ new IdentityTable();

/** Past this, a literal is keyed by identity. Deeper than any filter the protocol takes. */
const MAX_DEPTH = 12;

const encode = (value: unknown, depth: number, seen: Set<object>): string => {
  if (value === null) return "n";
  if (value === undefined) return "u";
  switch (typeof value) {
    case "string":
      return `s${JSON.stringify(value)}`;
    case "number":
    case "boolean":
      return `p${String(value)}`;
    // JSON.stringify throws on a bigint and drops a function or symbol, so each is handled
    // before the object walk rather than left to blow up mid-key.
    case "bigint":
      return `b${value.toString()}`;
    case "symbol":
      return `y${identities.keyFor(value)}`;
    case "function":
      return `f${identities.keyFor(value)}`;
  }

  const object = value as object;
  if (depth >= MAX_DEPTH || seen.has(object))
    return `i${identities.keyFor(object)}`;

  if (Array.isArray(value)) {
    seen.add(object);
    try {
      return `[${value.map((element) => encode(element, depth + 1, seen)).join(",")}]`;
    } finally {
      seen.delete(object);
    }
  }

  // A capnweb stub is a Proxy whose prototype is not Object.prototype, and enumerating one
  // is a remote property access — from a render, that is RPC where a caller expects none.
  // A Date, a Map, a class instance land here too, and identity is the honest answer for
  // all of them.
  const prototype = Object.getPrototypeOf(object);
  if (prototype !== Object.prototype && prototype !== null)
    return `i${identities.keyFor(object)}`;

  seen.add(object);
  try {
    const record = object as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .filter((key) => record[key] !== undefined)
      .map((key) => `${key}:${encode(record[key], depth + 1, seen)}`)
      .join(",")}}`;
  } catch {
    // A getter or a Proxy trap that throws. Identity is all this value can honestly be
    // keyed by, and a key builder that throws would take a render down with it.
    return `i${identities.keyFor(object)}`;
  } finally {
    seen.delete(object);
  }
};

/**
 * A string that changes exactly when `input`'s meaning does.
 *
 * Plain JSON is compared by value with object keys sorted, so `{ limit: 25, searchTerm: "" }`
 * written inline on every render is one key. Array order is preserved, which the protocol's
 * positional filter tuples depend on. An absent key and one set to `undefined` are the same
 * key, matching what reaches the wire; `null` is its own value.
 *
 * Anything that does not describe as data — a stub, a callback, a class instance, a cycle —
 * falls back to an identity token, so a caller may mix one into an inline literal without
 * either half being mis-compared. Never throws: every value has a key.
 */
export const queryKey = (input: unknown): string => encode(input, 0, new Set());
