/** Boots the hidden Prismatic frame and hands back the RPC session as a {@link Client}. */

import {
  type ConfigurationState,
  type ConfigurationTarget,
  type Connection,
  type ConnectionState,
  type HostApi,
  headlessPath,
  type Instance,
  type InstanceState,
  type MarketplaceIntegrationState,
  type MarketplaceIntegrationTarget,
  PORT_EVENT,
  PROTOCOL_MISMATCH_CODE,
  PROTOCOL_VERSION,
  type PreAuthApi,
  type PrismaticApi,
  type ProtocolVersion,
  READY_EVENT,
  RPC_LIMITS,
  redactError,
  type ServerInfo,
  type UserConfigurationState,
  type UserConfigurationTarget,
} from "./protocol/index.js";
import { RpcSession, type RpcStub } from "capnweb";
import { disposeQuietly } from "./dispose.js";
import {
  createTelemetry,
  type RpcEventListener,
  type Telemetry,
} from "./telemetry.js";
import { MessagePortTransport, observed } from "./transport.js";
import {
  type OpenVisibleFrameOptions,
  openVisibleFrame,
  type VisibleFrameMount,
} from "./visibleFrame.js";

// Replaced at build time (tsdown and vitest `define`) with this package's own name and version.
declare const __SOLIS_CORE_PACKAGE_NAME__: string;
declare const __SOLIS_CORE_PACKAGE_VERSION__: string;
const packageInfo = {
  name: __SOLIS_CORE_PACKAGE_NAME__,
  version: __SOLIS_CORE_PACKAGE_VERSION__,
};

const DEFAULT_TIMEOUT_MS = 30_000;

export interface CreateClientOptions {
  /** Base URL of the Prismatic app, e.g. `https://app.prismatic.io`. */
  prismaticUrl: string;
  /** Customer-scoped JWT. An eager {@link Client.authenticate}; never placed on the URL. */
  jwt?: string;
  /** Defaults to `document.body`. */
  container?: HTMLElement;
  /** Defaults to 30s. A rejected boot removes the iframe. */
  timeoutMs?: number;
  /** Capabilities to grant the frame. Omitting it leaves the frame unable to call back. */
  host?: HostApi;
  /** Nonsecret, serializable client context for embedded-view telemetry. */
  clientMeta?: Readonly<Record<string, string | number | boolean | null>>;
  /** Receives every wire event, including the boot's own `serverInfo()`. */
  telemetry?: RpcEventListener;
}

/** The pending result of `authenticate()`, so a call on it is one round trip. */
export type AuthedHandle = RpcStub<PrismaticApi>;

/**
 * Live reference to a server-side object; a resource the host disposes, not plain data.
 * `state()` is restated because the capnweb stub type erases the chunk type.
 */
export type StatefulStub<T, S> = Omit<RpcStub<T>, "state"> & {
  state(): Promise<ReadableStream<S>>;
};

export type ConnectionStub = StatefulStub<Connection, ConnectionState>;
export type IntegrationStub = StatefulStub<
  MarketplaceIntegrationTarget,
  MarketplaceIntegrationState
>;
export type InstanceStub = StatefulStub<Instance, InstanceState>;
export type ConfigurationStub = StatefulStub<
  ConfigurationTarget,
  ConfigurationState
>;
export type UserConfigurationStub = StatefulStub<
  UserConfigurationTarget,
  UserConfigurationState
>;

export interface Client {
  /** Pre-auth root. `serverInfo()` needs no token; everything else does. */
  api: RpcStub<PreAuthApi>;
  /** The major is verified; check `features` before using anything newer. */
  serverInfo: ServerInfo;
  /**
   * Supplies a token and returns the authed surface. A refreshed token for the same
   * identity keeps outstanding stubs valid; a different identity revokes the previous
   * session, whose stubs then reject with `code === "PRISMATIC_SESSION_REVOKED"`. Reads
   * must go through the newest handle — a call on an older one is not ordered against
   * the token swap and can answer under the previous token.
   */
  authenticate: (jwt: string) => AuthedHandle;
  authenticated: AuthedHandle | null;
  /** The capabilities the host granted the frame, as passed to {@link createClient}. */
  host: HostApi | undefined;
  telemetry: Telemetry;
  stats: () => { imports: number; exports: number };
  /** Each mount owns an independent channel; embedded events go to the hidden frame. */
  openVisibleFrame: (
    options: OpenVisibleFrameOptions,
  ) => Promise<VisibleFrameMount>;
  /** Releases every stub the session handed out. Idempotent. */
  dispose: () => void;
}

export class ConnectError extends Error {
  override readonly name: string = "ConnectError";
}

/** The frame speaks a protocol identifier this client does not. Carries `code`; class
 * identity dies on the wire. */
export class ProtocolMismatchError extends ConnectError {
  override readonly name = "ProtocolMismatchError";
  readonly code = PROTOCOL_MISMATCH_CODE;

  constructor(
    readonly expected: ProtocolVersion,
    readonly actual: ProtocolVersion,
  ) {
    super(
      `The embedded frame speaks protocol ${actual}, this client speaks ${expected}. ` +
        `Update the SDK or use an application serving ${expected}.`,
    );
  }
}

/** Resolves once the iframe posts READY from the expected origin. Always detaches. */
const waitForReady = (
  iframe: HTMLIFrameElement,
  expectedOrigin: string,
  timeoutMs: number,
): Promise<void> =>
  new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const cleanup = () => {
      if (timer !== undefined) clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      iframe.removeEventListener("error", onError);
    };

    const onMessage = (event: MessageEvent) => {
      // Dropping any one of the three checks lets an unrelated frame complete the handshake.
      if (event.source !== iframe.contentWindow) return;
      if (event.origin !== expectedOrigin) return;
      if (event.data?.type !== READY_EVENT) return;
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      reject(new ConnectError("The embedded session failed to load"));
    };

    timer = setTimeout(() => {
      cleanup();
      reject(
        new ConnectError(
          `The embedded session did not become ready within ${timeoutMs}ms. ` +
            `Check that ${expectedOrigin} is reachable.`,
        ),
      );
    }, timeoutMs);

    window.addEventListener("message", onMessage);
    iframe.addEventListener("error", onError);
  });

/**
 * Boots a hidden iframe, exchanges a `MessagePort` with it, and returns the pre-auth root
 * as an RPC stub. The token never touches the iframe URL; `authenticate()` passes it over
 * the established port. `dispose()` releases every stub the session handed out, so hosts
 * need only dispose stubs they drop earlier than the session.
 */
export const createClient = async (
  options: CreateClientOptions,
): Promise<Client> => {
  const {
    prismaticUrl,
    jwt,
    container = document.body,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    host,
    clientMeta,
    telemetry: onEvent,
  } = options;

  let expectedOrigin: string;
  let url: URL;
  try {
    url = new URL(headlessPath(PROTOCOL_VERSION), prismaticUrl);
    expectedOrigin = new URL(prismaticUrl).origin;
  } catch {
    throw new ConnectError("Invalid embedded application URL");
  }
  url.searchParams.set("hostOrigin", window.location.origin);

  const iframe = document.createElement("iframe");
  iframe.src = url.toString();
  iframe.title = "Embedded session";
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:absolute;width:0;height:0;border:0;visibility:hidden;";
  container.appendChild(iframe);

  try {
    await waitForReady(iframe, expectedOrigin, timeoutMs);
  } catch (error) {
    iframe.remove();
    throw error;
  }

  const channel = new MessageChannel();
  iframe.contentWindow?.postMessage(
    {
      type: PORT_EVENT,
      port: channel.port2,
      client: {
        packageName: packageInfo.name,
        packageVersion: packageInfo.version,
        ...(clientMeta ? { meta: clientMeta } : {}),
      },
    },
    expectedOrigin,
    [channel.port2],
  );

  const { observer, telemetry } = createTelemetry();
  if (onEvent) telemetry.subscribe(onEvent);
  const session = new RpcSession<PreAuthApi>(
    observed(new MessagePortTransport(channel.port1), observer),
    host,
    { onSendError: redactError, limits: RPC_LIMITS },
  );
  const api = session.getRemoteMain();

  // Any other order leaks an iframe and a MessagePort per failed handshake.
  const teardown = () => {
    try {
      api[Symbol.dispose]();
    } catch {
      // The session may already be torn down; keep tearing down.
    }
    channel.port1.close();
    iframe.remove();
  };

  // Verified before the client is handed out, so a mismatch names both versions rather
  // than surfacing later as a shape failure on whichever method changed.
  let serverInfo: ServerInfo;
  try {
    serverInfo = await api.serverInfo();
  } catch (error) {
    teardown();
    throw new ConnectError(
      `The embedded frame did not answer serverInfo(): ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (serverInfo.protocol !== PROTOCOL_VERSION) {
    teardown();
    throw new ProtocolMismatchError(PROTOCOL_VERSION, serverInfo.protocol);
  }

  let disposed = false;
  const mounts = new Set<VisibleFrameMount>();
  const mountAbort = new AbortController();
  const client: Client = {
    api,
    serverInfo,
    authenticated: null,
    host,
    telemetry,
    stats: () => session.getStats(),
    openVisibleFrame: async (options) => {
      if (disposed) throw new ConnectError("Client was disposed");
      let closedByFrame: VisibleFrameMount | undefined;
      const mount = await openVisibleFrame(
        {
          ...options,
          onClose: () => {
            if (closedByFrame) mounts.delete(closedByFrame);
            options.onClose?.();
          },
        },
        iframe,
        expectedOrigin,
        () => disposed,
        mountAbort.signal,
      );
      if (disposed) {
        mount.dispose();
        throw new ConnectError("Client was disposed");
      }
      mounts.add(mount);
      closedByFrame = mount;
      return {
        iframe: mount.iframe,
        dispose: () => {
          mount.dispose();
          mounts.delete(mount);
        },
      };
    },
    authenticate: (token: string) => {
      if (!token)
        throw new ConnectError("authenticate requires a non-empty jwt");
      // Awaiting here would hand out a stub whose disposal invalidates this handle.
      const handle = api.authenticate(token) as unknown as AuthedHandle;
      const superseded = client.authenticated;
      client.authenticated = handle;
      // Released only once the replacement is published, so a call already pipelined
      // through the old handle still resolves.
      if (superseded && superseded !== handle) disposeQuietly(superseded);
      return handle;
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      client.authenticated = null;
      mountAbort.abort();
      for (const mount of mounts) mount.dispose();
      mounts.clear();
      teardown();
    },
  };

  if (jwt) client.authenticate(jwt);
  return client;
};
