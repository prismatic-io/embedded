/**
 * Calls `Symbol.dispose` when present, swallowing a double-dispose after session teardown.
 * A capnweb stub is a Proxy around a function, so narrowing to `"object"` here would
 * silently skip every stub.
 */
export const disposeQuietly = (value: unknown): void => {
  if (
    value === null ||
    (typeof value !== "object" && typeof value !== "function")
  )
    return;
  try {
    (value as { [Symbol.dispose]?: () => void })[Symbol.dispose]?.();
  } catch {
    // Already released with its session.
  }
};

/**
 * Disposes a collection of stubs: the container first, then each element. An array that
 * arrives as a stub releases every row when disposed; rows that each hold their own import
 * are released individually. Doing both covers either shape.
 */
export const disposeAll = (
  values: Iterable<unknown> | null | undefined,
): void => {
  if (!values) return;
  disposeQuietly(values);
  for (const value of values) {
    if (
      typeof value === "object" &&
      value !== null &&
      Symbol.iterator in value
    ) {
      disposeAll(value as Iterable<unknown>);
      continue;
    }
    disposeQuietly(value);
  }
};
