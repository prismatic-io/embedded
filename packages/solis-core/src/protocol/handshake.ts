/** The `postMessage` exchange that establishes the port, before any RPC. */

import type { ProtocolVersion } from "./api.js";

/** Posted by the frame at its expected host origin once it can accept a port. */
export type ReadyEvent = "PRISMATIC_HEADLESS_READY";
export const READY_EVENT: ReadyEvent = "PRISMATIC_HEADLESS_READY";

export interface ReadyMessage {
  type: ReadyEvent;
}

/** Posted by the host, carrying the `MessagePort` the session then speaks over. */
export type PortEvent = "PRISMATIC_HEADLESS_PORT";
export const PORT_EVENT: PortEvent = "PRISMATIC_HEADLESS_PORT";

/** The host's SDK, which the frame may use to pick compatible behavior. */
export interface HandshakeClient {
  packageName: string;
  packageVersion: string;
  meta?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface PortMessage {
  type: PortEvent;
  port: MessagePort;
  client?: HandshakeClient;
}

/**
 * Versioned by protocol identifier so an old tab cannot load a frame speaking something else.
 * The trailing slash matters: vite's dev server 404s the bare form of a directory index.
 */
export const headlessPath = (protocol: ProtocolVersion): string =>
  `/headless/${typeof protocol === "number" ? `v${protocol}` : protocol}/`;
