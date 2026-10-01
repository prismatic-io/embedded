import type {
  ActionHandle,
  ConfigurationError,
  PrismaticError,
} from "@prismatic-io/solis-core";
import { toConfigurationError } from "@prismatic-io/solis-core/internal";
import { useEffect, useMemo, useRef } from "react";
import { useAction } from "../domain/useAction.js";
import { useResourceCache, useSessionToken } from "../PrismaticProvider.js";
import {
  createRefreshAction,
  type RefreshActionValue,
  refreshActionKey,
} from "./entityEntries.js";
import type { Guard } from "./loaders.js";
import { unavailableAction } from "./unavailableAction.js";
import { useRead } from "./useResource.js";

const unavailable = unavailableAction<void, void>("Resource is unavailable.");

/**
 * Refresh outlives a failed acquisition, so every reader can retry through one Action. The
 * action shares one status per key: a second execute while one runs returns busy. It is
 * cached under its own family so invalidating or refreshing the resource's family never
 * replaces it mid-flight.
 */
export const useResourceRefreshAction = <
  E extends PrismaticError = ConfigurationError,
>({
  key,
  name,
  ready = true,
  guard,
  refresh,
  toError = toConfigurationError as unknown as (error: unknown) => E,
}: {
  /** The resource's unscoped cache key; `null` leaves the action unavailable. */
  key: string | null;
  /** Names an action other than refresh that is shared per key the same way. */
  name?: string;
  ready?: boolean;
  guard: Guard;
  /** Defaults to reloading `key` in place. */
  refresh?: () => Promise<void>;
  toError?: (error: unknown) => E;
}) => {
  const cache = useResourceCache();
  const token = useSessionToken();
  const actionKey = key
    ? name
      ? `${name}/${key}`
      : refreshActionKey(key)
    : null;
  // A revocation is reported through the action's error, once the result has published;
  // revoking inside `execute` would dispose the action before its caller saw why.
  const reload = useRef<() => Promise<void>>(() => Promise.resolve());
  reload.current =
    refresh ??
    (() => (key ? cache.refetch(`${token}:${key}`) : Promise.resolve()));
  useEffect(() => {
    if (actionKey) return cache.observe(`${token}:${actionKey}`);
  }, [cache, token, actionKey]);
  const read = useRead<RefreshActionValue<E>>(
    useMemo(
      () =>
        actionKey && ready
          ? {
              key: actionKey,
              load: async () =>
                createRefreshAction({
                  guard,
                  reload: () => reload.current(),
                  toError,
                }),
            }
          : null,
      [actionKey, ready, guard, toError],
    ),
  );
  return useAction(
    read.data?.action ??
      (unavailable as unknown as ActionHandle<void, void, E>),
  );
};
