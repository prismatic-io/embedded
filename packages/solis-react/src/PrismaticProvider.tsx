/** The session: one embedded frame and one resource cache, shared with the tree below. */

import {
  type Action,
  type AuthedHandle,
  type Client,
  createClient,
  type FeatureName,
  type HostApi,
  type RpcEventListener,
  hasFeature as hasFeatureOn,
  isSessionRevoked,
  type PrismaticError,
  type Resource,
  type ServerInfo,
} from "@prismatic-io/solis-core";
import {
  createAction,
  type DisposableActionHandle,
  toPrismaticError,
} from "@prismatic-io/solis-core/internal";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { RESOURCE_IDLE_MS, ResourceCache } from "./internal/resourceCache.js";
import { toError } from "./internal/toError.js";

export type SessionState =
  | { status: "connecting"; client: null; api: null; error: null }
  | { status: "ready"; client: Client; api: AuthedHandle | null; error: null }
  | { status: "error"; client: null; api: null; error: Error };

const CONNECTING: SessionState = {
  status: "connecting",
  client: null,
  api: null,
  error: null,
};

/** Read directly by consumers that accept an explicit client and may sit outside a provider. */
export const PrismaticContext =
  /* @__PURE__ */ createContext<SessionState | null>(null);

interface CacheScope {
  cache: ResourceCache;
  /**
   * Prefixes every cache key. Moves when the frame revokes the session, and stays put
   * across a same-identity token refresh, which keeps outstanding stubs valid.
   */
  token: string;
  revoke: () => void;
  ready: boolean;
  isReady: () => boolean;
  /** Why the frame could not confirm the session scope, until a later probe succeeds. */
  probeError: Error | null;
  /** Shared by every `usePrismatic` reader: re-asks the frame for the session scope. */
  refresh: DisposableActionHandle<void, void, PrismaticError>;
}

const CacheContext = /* @__PURE__ */ createContext<CacheScope | null>(null);

/** How the session authenticates. Compared field by field, so an inline literal is fine. */
export interface PrismaticAuth {
  /** Customer-scoped JWT. */
  token: string;
}

interface SharedProviderProps {
  /** Until a token arrives the session is connected but unauthenticated. */
  auth?: PrismaticAuth;
  /**
   * Advanced. How long a cached read outlives its last mounted reader before its stubs are released.
   * Defaults to 10s; `0` releases as soon as the last reader unmounts, at the cost of
   * re-fetching a screen the user navigates back to. Changing it re-arms keys already
   * counting down.
   */
  resourceIdleMs?: number;
  /** Receives boot and session-scope failures. Individual hook errors arrive on those hooks. */
  onError?: (error: Error) => void;
  children: ReactNode;
}

/** The provider boots the session and owns it. */
export interface BootedProviderProps extends SharedProviderProps {
  /** Base URL of the Prismatic app, e.g. `https://app.prismatic.io`. */
  prismaticUrl: string;
  client?: never;
  /**
   * Receives every wire event, including the boot's own. Read when the session boots; while
   * one is set, the latest function is called.
   */
  telemetry?: RpcEventListener;
  /** Nonsecret, serializable context for embedded-view telemetry. Read once, at boot. */
  clientMeta?: Readonly<Record<string, string | number | boolean | null>>;
  /** Advanced. Where the hidden iframe mounts; defaults to `document.body`. */
  container?: HTMLElement;
  /** Advanced. How long the frame has to boot, in ms; defaults to 30s. */
  timeoutMs?: number;
  /**
   * Advanced. Capabilities granted to the frame, such as `openExternalUrl` for native
   * shells that block `window.open`. Compared by reference — see the note below.
   */
  host?: HostApi;
}

/** Advanced: the host booted the session with `createClient` and keeps ownership of it. */
export interface AttachedProviderProps extends SharedProviderProps {
  /**
   * A client from {@link createClient}. Unmounting releases what the tree acquired and
   * leaves the client live, so the host disposes it on its own schedule.
   */
  client: Client;
  prismaticUrl?: never;
  telemetry?: never;
  clientMeta?: never;
  container?: never;
  timeoutMs?: never;
  host?: never;
}

export type PrismaticProviderProps =
  | BootedProviderProps
  | AttachedProviderProps;

/**
 * Publishes one session downward. Children render immediately; this never suspends.
 *
 * Pass `prismaticUrl` and the provider boots the iframe and disposes it on unmount;
 * `container`, `timeoutMs` and `host` rebuild it on identity change, so pass `host` as a
 * module-level or memoized object. Pass `client` instead and the provider attaches to a
 * session the host booted: unmounting then releases only what the tree below acquired,
 * never the client, which stays usable for whatever else the host does with it.
 *
 * A new `auth.token` goes over the live session either way and mints a new handle
 * identity, re-running every domain hook. The token is compared as a string, so
 * `auth={{ token }}` may be written inline.
 */
export const PrismaticProvider = (props: PrismaticProviderProps) => {
  const { children, auth, resourceIdleMs, onError } = props;
  const attached = props.client;
  const { prismaticUrl, container, timeoutMs, host, telemetry, clientMeta } =
    props as BootedProviderProps;
  const [booted, setBooted] = useState<SessionState>(CONNECTING);
  /** One cache per provider instance; a boot rebuild empties it rather than replacing it. */
  const [cache] = useState(() => new ResourceCache(resourceIdleMs));

  // The string, not the object: every dependency below reads this, so an inline
  // `auth={{ token }}` literal is not a new identity to react to.
  const token = auth?.token;

  const errorRef = useRef(onError);
  errorRef.current = onError;
  const telemetryRef = useRef(telemetry);
  telemetryRef.current = telemetry;
  const clientMetaRef = useRef(clientMeta);
  clientMetaRef.current = clientMeta;
  const reportError = useCallback(
    (error: Error) => errorRef.current?.(error),
    [],
  );

  useUnstableHostWarning(prismaticUrl, host);

  // Read on every render, not once at construction: a host driving it from state would
  // otherwise see later changes silently ignored.
  useEffect(() => {
    cache.setIdleMs(resourceIdleMs ?? RESOURCE_IDLE_MS);
  }, [cache, resourceIdleMs]);

  // The cache owns stubs, so it closes with the tree that reads them. An attached client
  // survives, which is exactly why what the tree borrowed has to go back here.
  useEffect(() => () => cache.close(), [cache]);

  useEffect(() => {
    if (attached) return;
    let cancelled = false;
    let client: Client | undefined;
    setBooted(CONNECTING);

    const boot = async () => {
      try {
        const next = await createClient({
          prismaticUrl,
          container,
          timeoutMs,
          host,
          clientMeta: clientMetaRef.current,
          ...(telemetryRef.current
            ? { telemetry: (event) => telemetryRef.current?.(event) }
            : {}),
        });
        if (cancelled) {
          // Unmounted mid-boot: no consumer, so drop it rather than leak the iframe.
          next.dispose();
          return;
        }
        client = next;
        setBooted({ status: "ready", client: next, api: null, error: null });
      } catch (caught) {
        if (cancelled) return;
        const error = toError(caught);
        setBooted({ status: "error", client: null, api: null, error });
        errorRef.current?.(error);
      }
    };

    void boot();

    return () => {
      cancelled = true;
      client?.dispose();
    };
  }, [attached, prismaticUrl, container, timeoutMs, host]);

  /**
   * The attached handle, tagged with the client it came from. An untagged handle would
   * still read as current for one render after the host swapped clients, and a domain hook
   * would call through the previous session.
   */
  const [attachedApi, setAttachedApi] = useState<{
    client: Client;
    api: AuthedHandle;
  } | null>(null);

  // An attached client is ready on the first render; nothing here waits for a boot. Held
  // by identity, or every consumer re-runs on each render of this provider.
  const state: SessionState = useMemo(
    () =>
      attached
        ? {
            status: "ready",
            client: attached,
            api: attachedApi?.client === attached ? attachedApi.api : null,
            error: null,
          }
        : booted,
    [attached, attachedApi, booted],
  );
  const client = state.status === "ready" ? state.client : null;
  const [authenticatedFor, setAuthenticatedFor] = useState<{
    client: Client;
    token: string | undefined;
    api: AuthedHandle | null;
  } | null>(null);

  useEffect(() => {
    if (!client) return;
    // A call observes the new token only through the promise `authenticate` returned. An
    // attached client the host already authenticated keeps that handle: re-authenticating
    // its own token would revoke the stubs the host is holding.
    const api = token
      ? client.authenticate(token)
      : attached
        ? client.authenticated
        : null;
    setAuthenticatedFor({ client, token, api });
    if (attached) {
      setAttachedApi(api ? { client, api } : null);
      return;
    }
    setBooted((current) =>
      current.status === "ready" && current.client === client
        ? { ...current, api }
        : current,
    );
  }, [attached, client, token]);

  const authenticationCurrent =
    authenticatedFor?.client === client &&
    authenticatedFor?.token === token &&
    authenticatedFor?.api === state.api;
  const scope = useCacheScope(
    cache,
    state.api,
    reportError,
    authenticationCurrent,
  );

  return (
    <PrismaticContext.Provider value={state}>
      <CacheContext.Provider value={scope}>{children}</CacheContext.Provider>
    </PrismaticContext.Provider>
  );
};

/**
 * The cache and the token its keys are prefixed with.
 *
 * A token change does not move the prefix on its own. Re-authenticating as the same
 * identity swaps the token underneath outstanding stubs, so the cached stubs stay live and
 * dropping them would refetch a screen the user is looking at; a *different* identity
 * revokes the session, and then every cached stub is dead. Which of the two happened is the
 * frame's decision, not a claim the SDK can read off the JWT, so each new handle is asked:
 * `getSessionScope()` identifies the live session, including its customer and permissions.
 * An unchanged scope keeps the cache, a changed one drops it.
 *
 * Ordinary resources retain their existing cache behavior during confirmation.
 * User-private resources quarantine reads and actions until the requested authentication
 * has a confirmed scope, without discarding same-session cached ownership.
 */
const useCacheScope = (
  cache: ResourceCache,
  api: AuthedHandle | null,
  reportError: (error: Error) => void,
  authenticationCurrent: boolean,
): CacheScope => {
  const [generation, setGeneration] = useState(0);
  const [confirmedApi, setConfirmedApi] = useState<AuthedHandle | null>(null);
  const ready = authenticationCurrent && api !== null && confirmedApi === api;
  const readyRef = useRef(ready);
  readyRef.current = ready;
  const isReady = useCallback(() => readyRef.current, []);
  const liveGeneration = useRef(generation);
  const revoke = useCallback(
    (expectedGeneration = liveGeneration.current) => {
      if (liveGeneration.current !== expectedGeneration) return;
      liveGeneration.current++;
      cache.revoke();
      setGeneration(liveGeneration.current);
    },
    [cache],
  );

  /** The last live session scope. `null` until the first handle answers. */
  const sessionScope = useRef<string | null>(null);
  const [probeError, setProbeError] = useState<Error | null>(null);

  const confirm = useCallback(
    (confirmed: AuthedHandle, scope: string) => {
      const previous = sessionScope.current;
      sessionScope.current = scope;
      // A revoked session already invalidated every cached stub; a same-identity refresh
      // left them all usable.
      if (previous !== null && previous !== scope) revoke();
      setConfirmedApi(() => confirmed);
      setProbeError(null);
    },
    [revoke],
  );

  const reject = useCallback(
    (caught: unknown) => {
      // Without a scope answer, cached targets cannot be assumed to be live.
      const error = toError(caught);
      revoke();
      setConfirmedApi(null);
      setProbeError(error);
      reportError(error);
    },
    [revoke, reportError],
  );

  useEffect(() => {
    if (!api) return;
    let cancelled = false;
    void api.getSessionScope().then(
      (scope) => {
        if (!cancelled) confirm(api, scope);
      },
      (error: unknown) => {
        if (!cancelled) reject(error);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [api, confirm, reject]);

  const liveApi = useRef(api);
  liveApi.current = api;
  const liveConfirmedApi = useRef(confirmedApi);
  liveConfirmedApi.current = confirmedApi;
  const probe = useRef(async () => {});
  probe.current = async () => {
    if (!api) return;
    try {
      const scope = await api.getSessionScope();
      if (liveApi.current === api) confirm(api, scope);
    } catch (error) {
      // A failed re-probe of a confirmed session reports on the refresh action alone; the
      // session and its cache stay as they were.
      const wasConfirmed = liveConfirmedApi.current === api;
      if (liveApi.current === api && !wasConfirmed) reject(error);
      throw error;
    }
  };
  // Holds nothing that needs releasing, so it lives as long as the provider.
  const [refresh] = useState(() =>
    createAction<void, void, PrismaticError>({
      execute: async () => {
        await probe.current();
        return { status: "success", data: undefined };
      },
      toError: toSessionError,
    }),
  );

  return useMemo(
    () => ({
      cache,
      token: `s${generation}`,
      revoke: () => revoke(generation),
      ready,
      isReady,
      probeError,
      refresh,
    }),
    [cache, generation, revoke, ready, isReady, probeError, refresh],
  );
};

/** The cache every read hook shares. */
export const useResourceCache = (): ResourceCache => useCacheContext().cache;

/** What read keys are prefixed with, so a revoked session cannot answer under the new one. */
export const useSessionToken = (): string => useCacheContext().token;

/** User-private resources must not expose a previous identity during scope confirmation. */
export const useConfirmedSessionScope = () => {
  const { ready, isReady } = useCacheContext();
  return { ready, isReady };
};

/** Drops every cached read and moves the key prefix. Called when a stub reports revocation. */
export const useSessionRevoked = (): ((error: unknown) => void) => {
  const revoke = useContext(CacheContext)?.revoke;
  return useCallback(
    (error: unknown) => {
      if (isSessionRevoked(error)) revoke?.();
    },
    [revoke],
  );
};

const useCacheContext = (): CacheScope => {
  const scope = useContext(CacheContext);
  if (!scope)
    throw new Error("Prismatic hooks must be used within a PrismaticProvider");
  return scope;
};

/** Observation is also usable outside a provider; only scoped errors revoke its cache. */
export const useResourceError = (error: Error | null | undefined): void => {
  const errors = useMemo(() => [error], [error]);
  useResourceErrors(errors);
};

export const useResourceErrors = (
  errors: readonly (Error | null | undefined)[],
): void => {
  const onRevoked = useSessionRevoked();
  useEffect(() => {
    for (const error of errors) if (error) onRevoked(error);
  }, [errors, onRevoked]);
};

const useUnstableHostWarning = (
  prismaticUrl: string | undefined,
  host: HostApi | undefined,
) => {
  const seen = useRef({ prismaticUrl, host, warned: false });
  useEffect(() => {
    const previous = seen.current;
    if (
      process.env.NODE_ENV !== "production" &&
      !previous.warned &&
      previous.host !== host &&
      previous.prismaticUrl === prismaticUrl
    ) {
      seen.current.warned = true;
      console.warn(
        "PrismaticProvider: `host` changed identity while `prismaticUrl` did not, which " +
          "rebuilds the iframe. Pass a module-level or memoized object.",
      );
    }
    seen.current.prismaticUrl = prismaticUrl;
    seen.current.host = host;
  }, [prismaticUrl, host]);
};

const toSessionError = /* @__PURE__ */ toPrismaticError<PrismaticError>([]);

/** The whole session, including why it is not ready. Internal: hosts read `usePrismatic`. */
export const useSessionState = (): SessionState => {
  const state = useContext(PrismaticContext);
  if (!state)
    throw new Error("Prismatic hooks must be used within a PrismaticProvider");
  return state;
};

/**
 * What the frame announced, as soon as it is connected and before any token. Internal
 * hooks gate on it; hosts read the same through `usePrismatic`.
 */
export const useServerFeatures = () => {
  const state = useSessionState();
  const serverInfo = state.status === "ready" ? state.client.serverInfo : null;
  // Stable while the session is, so a caller may put it in a deps array.
  const hasFeature = useCallback(
    (feature: FeatureName) =>
      serverInfo ? hasFeatureOn(serverInfo, feature) : false,
    [serverInfo],
  );
  return { serverInfo, hasFeature };
};

export interface PrismaticSession {
  serverInfo: ServerInfo;
  /** Bound to the live `serverInfo`, so callers never thread it. */
  hasFeature: (feature: FeatureName) => boolean;
}

export interface PrismaticSessionActions {
  /** Asks the frame again whether the session is live and who it belongs to. */
  refresh: Action<void, void, PrismaticError>;
}

export type PrismaticSessionResource = Resource<
  PrismaticSession,
  PrismaticError,
  PrismaticSessionActions
>;

/**
 * The session as a resource: `loading` until the frame is connected and has confirmed the
 * session behind the token, `error` when it cannot boot or confirm it, then `success`. A
 * new token re-confirms in place, so a session that has been ready stays `success` with
 * `isRefreshing` until the frame answers.
 */
export const usePrismatic = (): PrismaticSessionResource => {
  const state = useSessionState();
  const { ready, probeError, refresh: handle } = useCacheContext();
  const { serverInfo, hasFeature } = useServerFeatures();
  const refresh = useSyncExternalStore(
    handle.subscribe,
    handle.getSnapshot,
    handle.getSnapshot,
  );
  const actions = useMemo(() => ({ refresh }), [refresh]);
  const client = state.client;

  const [readyFor, setReadyFor] = useState<Client | null>(null);
  useEffect(() => {
    if (ready && client) setReadyFor(client);
  }, [ready, client]);
  const settled = ready || (client !== null && readyFor === client);

  return useMemo((): PrismaticSessionResource => {
    if (state.status === "error")
      return {
        status: "error",
        error: toSessionError(state.error),
        isRefreshing: false,
        actions,
      };
    if (!ready && probeError)
      return {
        status: "error",
        error: toSessionError(probeError),
        isRefreshing: refresh.status === "loading",
        actions,
      };
    if (!settled || !serverInfo) return { status: "loading", actions };
    return {
      status: "success",
      data: { serverInfo, hasFeature },
      isRefreshing: !ready || refresh.status === "loading",
      actions,
    };
  }, [
    state,
    ready,
    probeError,
    settled,
    serverInfo,
    hasFeature,
    refresh.status,
    actions,
  ]);
};

/**
 * The sdk-core client behind the provider, or `null` until the frame is connected. An
 * advanced escape hatch for calls no hook covers; pair it with `useAction` to observe a
 * core action handle.
 */
export const usePrismaticClient = (): Client | null => useSessionState().client;
