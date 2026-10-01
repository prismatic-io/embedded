/** The one projection every list hook returns: a ListResource over shared entity entries. */

import type { ListResource, PrismaticError } from "@prismatic-io/solis-core";
import type { Stateful } from "@prismatic-io/solis-core/internal";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  useResourceCache,
  useSessionState,
  useSessionToken,
} from "../PrismaticProvider.js";
import type { EntityEntry } from "./entityEntries.js";
import type { Guard } from "./loaders.js";
import {
  type ListWindow,
  ListStore,
  type Page,
  type PageLoadMode,
} from "./listStore.js";
import type { OwnedValue } from "./resourceCache.js";
import { toResource } from "./toResource.js";
import { useApiHandle } from "./useApiHandle.js";
import {
  type ItemSources,
  useListItems,
  type WatchedAction,
} from "./useListItems.js";
import { useRead } from "./useResource.js";
import { useResourceRefreshAction } from "./useResourceRefreshAction.js";

type Api = NonNullable<ReturnType<typeof useApiHandle>>;

const noWindow = () => null;
const NO_ENTRIES: readonly never[] = [];
const noSubscription = () => () => {};

export const useListResource = <
  Loaded,
  State,
  E extends PrismaticError,
  R extends object,
>({
  key,
  mode,
  guard,
  toError,
  fetchPage,
  loadEntity,
  stubOf,
  actionsOf,
  project,
}: {
  /** Unscoped, and covering every filter, the page size and `mode`. */
  key: string;
  mode: PageLoadMode;
  guard: Guard;
  toError: (error: unknown) => E;
  /** Pinned to `key`, so a fresh closure every render does not reload. */
  fetchPage: (
    api: Api,
    cursor: string | null,
  ) => Promise<Page<EntityEntry<Loaded, E>>>;
  /** How an item's entry reloads, with the current API handle. */
  loadEntity: (api: Api, id: string) => Promise<OwnedValue<Loaded>>;
  stubOf: (loaded: Loaded) => Stateful<State>;
  /** Actions an entry owns beyond refresh, which its item's statuses follow. */
  actionsOf?: (loaded: Loaded) => readonly WatchedAction[];
  project: (sources: ItemSources<Loaded, State, E>) => R;
}): ListResource<R, E> => {
  const api = useApiHandle();
  const cache = useResourceCache();
  const token = useSessionToken();
  const session = useSessionState();

  const read = useRead<ListStore<EntityEntry<Loaded, E>>>(
    useMemo(
      () => ({
        key,
        load: async (current) => {
          const store = await ListStore.open({
            fetch: (cursor) => fetchPage(current, cursor),
            mode,
          });
          return {
            value: store,
            release: () => store.release(),
            refresh: async () => {
              await store.reload();
              return store;
            },
          };
        },
      }),
      [key, mode, fetchPage],
    ),
  );
  const store = read.data;

  // Same-scope authentication keeps the entry but replaces the API handle; paging and
  // item reloads follow the new one.
  if (api && store) {
    store.setFetch((cursor) => fetchPage(api, cursor));
    for (const entry of store.getSnapshot().entries)
      entry.lease.setLoader(() => loadEntity(api, entry.id));
  }

  const window: ListWindow<EntityEntry<Loaded, E>> | null =
    useSyncExternalStore(
      store?.subscribe ?? noSubscription,
      store?.getSnapshot ?? noWindow,
      noWindow,
    );
  const items = useListItems({
    entries: window?.entries ?? NO_ENTRIES,
    stubOf,
    actionsOf,
    project,
  });

  const storeOf = useCallback(
    () =>
      cache.peekSnapshot<ListStore<EntityEntry<Loaded, E>>>(`${token}:${key}`)
        ?.value,
    [cache, token, key],
  );
  const refresh = useResourceRefreshAction({ key, guard, toError });
  const loadNextPage = useResourceRefreshAction({
    key,
    name: "loadNextPage",
    guard,
    toError,
    refresh: async () => storeOf()?.loadNext(),
  });
  const loadPreviousPage = useResourceRefreshAction({
    key,
    name: "loadPreviousPage",
    guard,
    toError,
    refresh: async () => storeOf()?.loadPrevious(),
  });
  const actions = useMemo(
    () => ({ refresh, loadNextPage, loadPreviousPage }),
    [refresh, loadNextPage, loadPreviousPage],
  );

  const pageInfo = window?.pageInfo;
  const data = useMemo(
    () => (pageInfo ? { items, pageInfo } : undefined),
    [items, pageInfo],
  );

  return useMemo(
    (): ListResource<R, E> =>
      toResource({
        error: session.error ?? read.error,
        data: store ? data : undefined,
        isRefreshing: read.isRefetching || refresh.status === "loading",
        actions,
        toError,
      }),
    [
      session.error,
      read.error,
      store,
      data,
      read.isRefetching,
      refresh.status,
      actions,
      toError,
    ],
  );
};
