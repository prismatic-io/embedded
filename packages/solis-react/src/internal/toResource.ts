import type { PrismaticError, Resource } from "@prismatic-io/solis-core";

/** Every resource hook reports error first, then loading until data lands. */
export const toResource = <T, E extends PrismaticError, A>({
  enabled = true,
  error,
  data,
  isRefreshing,
  actions,
  toError,
}: {
  enabled?: boolean;
  error: unknown;
  data: T | undefined;
  isRefreshing: boolean;
  actions: A;
  toError: (error: unknown) => E;
}): Resource<T, E, A> => {
  if (!enabled) return { status: "loading", actions };
  if (error)
    return { status: "error", error: toError(error), isRefreshing, actions };
  if (data === undefined) return { status: "loading", actions };
  return { status: "success", data, isRefreshing, actions };
};
