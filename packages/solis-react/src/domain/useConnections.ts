/** Reading connections: the list, and one by id. */

import type {
  ConnectionState,
  ListConnectionsFilter,
} from "@prismatic-io/solis-core/protocol";
import type {
  Action,
  ConnectInput,
  ConnectionError,
  ConnectionResource,
  ConnectionStub,
  ListInput,
  ListResource,
} from "@prismatic-io/solis-core";
import {
  disposeQuietly,
  observeState,
  toConnectionError,
} from "@prismatic-io/solis-core/internal";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  type ConnectionOwnership,
  connectionActionsOf,
} from "../internal/connectionResource.js";
import { keys } from "../internal/keys.js";
import {
  type LoadedConnection,
  loadConnection,
  loadConnectionsPage,
} from "../internal/loaders.js";
import { toResource } from "../internal/toResource.js";
import { unavailableAction } from "../internal/unavailableAction.js";
import type { ItemSources } from "../internal/useListItems.js";
import { useListResource } from "../internal/useListResource.js";
import { useRead } from "../internal/useResource.js";
import { useResourceRefreshAction } from "../internal/useResourceRefreshAction.js";
import { useSelector } from "../internal/useSelector.js";
import {
  useResourceCache,
  useServerFeatures,
  useSessionState,
  useSessionToken,
} from "../PrismaticProvider.js";
import { useAction } from "./useAction.js";
import { useFeature } from "./useFeature.js";

export type ConnectionsInput = ListConnectionsFilter & ListInput;

const removedError = (): ConnectionError =>
  Object.assign(new Error("The connection was removed."), {
    code: "PRISMATIC_CONNECTION_REMOVED" as const,
  });

/** The one projection behind a detail read and a list item alike. */
export const toConnectionResource = ({
  enabled = true,
  error,
  loaded,
  live,
  closed,
  isRefreshing,
  actions,
}: {
  enabled?: boolean;
  error: unknown;
  loaded: LoadedConnection | undefined;
  live: ConnectionState | undefined;
  /** The frame closed the live stream: it learned the connection is gone. */
  closed: boolean;
  isRefreshing: boolean;
  actions: ConnectionResource["actions"];
}): ConnectionResource =>
  toResource({
    enabled,
    error: error ?? (closed ? removedError() : null),
    data: loaded && (live ?? loaded.state),
    isRefreshing,
    actions,
    toError: toConnectionError,
  });

const stubOf = ({ stub }: LoadedConnection) => stub;

const NOT_LOADED = "Connection is not loaded.";
const unavailableConnect = unavailableAction<
  ConnectInput,
  LoadedConnection["state"],
  ConnectionError
>(NOT_LOADED, "PRISMATIC_UNKNOWN");
const unavailableDisconnect = unavailableAction<
  void,
  LoadedConnection["state"],
  ConnectionError
>(NOT_LOADED, "PRISMATIC_UNKNOWN");

/** What every connection entry, listed, offered or read by id, owns its actions with. */
export const useConnectionOwnership = (): ConnectionOwnership => {
  const guard = useFeature("connections");
  const guardConnect = useFeature("connections.connect");
  const { client } = useSessionState();
  const host = client?.host;
  return useMemo(
    () => ({
      guard,
      guardConnect,
      host: () => host,
      reread: (id: string) => {
        const api = client?.authenticated;
        if (!api) return;
        api.connections.get(id).then(disposeQuietly, () => {});
      },
    }),
    [guard, guardConnect, host, client],
  );
};

/** A connection held on someone else's behalf, as a list or a configuration holds it. */
export const toConnectionItemResource = ({
  error,
  entry,
  live,
  closed,
  refresh,
}: {
  error: unknown;
  entry: ItemSources<LoadedConnection, unknown, ConnectionError>["entry"];
  live: LoadedConnection["state"] | undefined;
  closed: boolean;
  refresh: Action<void, void, ConnectionError>;
}): ConnectionResource =>
  toConnectionResource({
    error,
    loaded: entry.value,
    live,
    closed,
    isRefreshing: entry.isRefetching || refresh.status === "loading",
    actions: {
      refresh,
      connect: (entry.value?.connect ?? unavailableConnect).getSnapshot(),
      disconnect: (
        entry.value?.disconnect ?? unavailableDisconnect
      ).getSnapshot(),
    },
  });

/**
 * Connections the caller may use, as a list of connection resources. Connections are not
 * paged, so `hasNextPage` is always false. `filter` is compared structurally and goes to
 * the frame when it announces `connections.listFilter`; otherwise it is applied here, to
 * each connection's state as listed.
 *
 * Each item is the same resource `useConnection(id)` returns, sharing its cache entry and
 * refresh status.
 */
export const useConnections = (
  filter: ConnectionsInput = {},
): ListResource<ConnectionResource, ConnectionError> => {
  const { pageSize: _pageSize, onPageLoad = "append", ...criteria } = filter;
  const { hasFeature } = useServerFeatures();
  const serverSide = hasFeature("connections.listFilter");
  const ownership = useConnectionOwnership();
  const { guard } = ownership;
  const cache = useResourceCache();
  const token = useSessionToken();
  const session = useSessionState();
  const key = keys.connections({ ...criteria, onPageLoad });

  // Pinned to the structural key, so an inline literal does not re-acquire.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `criteria` is represented by `key`
  const fetchPage = useCallback(
    (api: Parameters<typeof loadConnectionsPage>[0]["api"]) =>
      loadConnectionsPage({
        api,
        ownership,
        filter: criteria,
        serverSide,
        cache,
        token,
      }),
    [key, ownership, serverSide, cache, token],
  );
  const loadEntity = useCallback(
    (api: Parameters<typeof loadConnection>[0], id: string) =>
      loadConnection(api, ownership, id),
    [ownership],
  );
  const project = useCallback(
    ({
      entry,
      live,
      liveError,
      closed,
      refresh,
    }: ItemSources<LoadedConnection, ConnectionState, ConnectionError>) =>
      toConnectionItemResource({
        error: session.error ?? entry.error ?? liveError,
        entry,
        live,
        closed,
        refresh,
      }),
    [session.error],
  );

  return useListResource({
    key,
    mode: onPageLoad,
    guard,
    toError: toConnectionError,
    fetchPage,
    loadEntity,
    stubOf,
    actionsOf: connectionActionsOf,
    project,
  });
};

/**
 * One connection by its id. While it's being authorized the frame watches it, so the
 * stream carries `PENDING` → `ACTIVE` as the user consents. Once the frame learns the
 * connection is gone, the resource goes to error with `PRISMATIC_CONNECTION_REMOVED`.
 */
export const useConnection = (
  id: string | null | undefined,
): ConnectionResource => {
  const ownership = useConnectionOwnership();
  const { guard } = ownership;
  const session = useSessionState();
  const enabled = id !== null && id !== undefined;

  const read = useRead<LoadedConnection>(
    useMemo(
      () =>
        enabled
          ? {
              key: keys.connection(id),
              load: (api) => loadConnection(api, ownership, id),
            }
          : null,
      [enabled, id, ownership],
    ),
  );

  const stub = read.data?.stub ?? null;
  const selection = useSelector<ConnectionState>(stub);
  const closed = useIsClosed(stub);
  const refresh = useResourceRefreshAction({
    key: enabled ? keys.connection(id) : null,
    guard,
    toError: toConnectionError,
  });
  const connect = useAction(read.data?.connect ?? unavailableConnect);
  const disconnect = useAction(read.data?.disconnect ?? unavailableDisconnect);
  const actions = useMemo(
    () => ({ refresh, connect, disconnect }),
    [refresh, connect, disconnect],
  );

  return useMemo(
    () =>
      toConnectionResource({
        enabled,
        error:
          session.error ??
          read.error ??
          (selection.status === "error" ? selection.error : null),
        loaded: read.data,
        live: selection.status === "ready" ? selection.value : undefined,
        closed,
        isRefreshing: read.isRefetching || refresh.status === "loading",
        actions,
      }),
    [
      enabled,
      session.error,
      read.error,
      read.data,
      read.isRefetching,
      refresh.status,
      selection,
      closed,
      actions,
    ],
  );
};

/** `useSelector` collapses `closed` into the retained value; removal needs the bit itself. */
const useIsClosed = (stub: ConnectionStub | null): boolean => {
  const subscribe = useCallback(
    (listener: () => void) =>
      stub ? observeState(stub).subscribe(listener) : () => {},
    [stub],
  );
  const getSnapshot = () =>
    stub ? observeState<ConnectionState>(stub).status === "closed" : false;
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
};
