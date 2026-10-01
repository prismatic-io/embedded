/** A connection entry: its stub, warmed, and the connect and disconnect actions it owns. */

import type {
  ConnectionAuthorization,
  ConnectionState,
  HostApi,
  Permission,
  Result,
} from "@prismatic-io/solis-core/protocol";
import type {
  ConnectInput,
  ConnectionError,
  ConnectionStub,
} from "@prismatic-io/solis-core";
import {
  connectionFailure,
  createAction,
  type DisposableActionHandle,
  observeState,
  openConsentWindow,
  toConnectionError,
  watchConnect,
} from "@prismatic-io/solis-core/internal";
import type { Guard, LoadedOne } from "./loaders.js";
import { withSettled } from "./loaders.js";
import type { OwnedValue } from "./resourceCache.js";

/** What a connection entry needs to own its actions. */
export interface ConnectionOwnership {
  guard: Guard;
  /** Throws when the frame can't connect connections. */
  guardConnect: Guard;
  /** The capabilities the host granted, read when an action runs. */
  host: () => HostApi | undefined;
  /** Asks the frame to read a connection again, so every open stream sees it now. */
  reread: (id: string) => void;
}

export interface LoadedConnection
  extends LoadedOne<ConnectionStub, ConnectionState> {
  connect: DisposableActionHandle<
    ConnectInput,
    ConnectionState,
    ConnectionError
  >;
  disconnect: DisposableActionHandle<void, ConnectionState, ConnectionError>;
}

export const forbidden = (
  verb: string,
  permission: Permission<string>,
): Result<never, ConnectionError> => ({
  status: "error",
  error: connectionFailure(
    "PRISMATIC_CONNECTION_FORBIDDEN",
    `The connection can't be ${verb}: ${permission.reason}.`,
  ),
});

export const popupBlocked = (): Result<never, ConnectionError> => ({
  status: "error",
  error: connectionFailure(
    "PRISMATIC_POPUP_BLOCKED",
    "The browser blocked the consent window. Start connecting from a click.",
  ),
});

const releasedError = () =>
  connectionFailure(
    "PRISMATIC_ACTION_DISPOSED",
    "The connection was released.",
  );

/** The frame's consent URL, as the result the stub answers. */
export const authorizeThrough =
  (stub: ConnectionStub) =>
  async (): Promise<Result<ConnectionAuthorization, ConnectionError>> =>
    (await stub.authorize()) as Result<
      ConnectionAuthorization,
      ConnectionError
    >;

/**
 * Warms a connection stub and binds its actions, so a listed or offered connection carries
 * the same actions, with the same status, as one read by id.
 */
export const ownConnection = async (
  stub: ConnectionStub,
  { guard, guardConnect, host, reread }: ConnectionOwnership,
): Promise<OwnedValue<LoadedConnection>> => {
  const settled = await withSettled<ConnectionStub, ConnectionState>(
    stub,
    "connection's",
  );
  const released = new AbortController();
  const state = () =>
    observeState<ConnectionState>(stub).latest ?? settled.value.state;
  const assertLive = () => {
    guard();
    if (released.signal.aborted) throw releasedError();
  };
  const connect = createAction<ConnectInput, ConnectionState, ConnectionError>({
    // Synchronous up to `openConsentWindow`: the browser only lets the click open it.
    execute: async (input) => {
      assertLive();
      guardConnect();
      const permission = state().permissions.connect;
      if (!permission.allowed) return forbidden("connected", permission);
      const consent = openConsentWindow(host());
      if (!consent) return popupBlocked();
      return watchConnect({
        stub,
        consent,
        input: input || undefined,
        authorize: authorizeThrough(stub),
        reread,
        released: released.signal,
      });
    },
    toError: toConnectionError,
  });
  const disconnect = createAction<void, ConnectionState, ConnectionError>({
    execute: async () => {
      assertLive();
      guardConnect();
      const permission = state().permissions.disconnect;
      if (!permission.allowed) return forbidden("disconnected", permission);
      const result = (await stub.disconnect()) as Result<
        ConnectionState,
        ConnectionError
      >;
      if (released.signal.aborted) throw releasedError();
      return result;
    },
    toError: toConnectionError,
  });
  return {
    value: { ...settled.value, connect, disconnect },
    release: () => {
      released.abort();
      connect.dispose();
      disconnect.dispose();
      settled.release?.();
    },
  };
};

/** The actions a connection entry owns, whose statuses its item shows. */
export const connectionActionsOf = ({
  connect,
  disconnect,
}: LoadedConnection) => [connect, disconnect];
