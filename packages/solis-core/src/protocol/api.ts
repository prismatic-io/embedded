/** The root protocol surface: handshake, capability discovery, and the authenticated API. */

import type { InstancesApi } from "./configuration.js";
import type { ConnectionsApi } from "./connections.js";
import type { MarketplaceApi } from "./marketplace.js";

/** Release candidates use distinct identifiers; stable majors move only for breaking changes.
 * Additive changes go through {@link ServerInfo.features} instead. */
export type ProtocolVersion = number | `rc-${number}`;
/** The protocol this release speaks. */
export type CurrentProtocolVersion = "rc-1";
export const PROTOCOL_VERSION: CurrentProtocolVersion = "rc-1";

/** Error `code` on a rejection from a frame speaking a protocol major the host does not. */
export type ProtocolMismatchCode = "PRISMATIC_PROTOCOL_MISMATCH";
export const PROTOCOL_MISMATCH_CODE: ProtocolMismatchCode =
  "PRISMATIC_PROTOCOL_MISMATCH";

/** Error `code` on a rejection from a stub whose session a re-authentication revoked. */
export type SessionRevokedCode = "PRISMATIC_SESSION_REVOKED";
export const SESSION_REVOKED_CODE: SessionRevokedCode =
  "PRISMATIC_SESSION_REVOKED";

/** Names are permanent once shipped; deprecate by adding a successor. Checking this list is
 * the only feature detection that works — a capnweb stub is a Proxy answering every property
 * access, so `"instances" in api` is always true. */
export type FeatureName =
  | "authenticatedUser"
  | "connections"
  | "connections.listFilter"
  | "connections.connect"
  | "marketplace"
  | "marketplace.filterOptions"
  | "instances"
  | "configuration"
  | "userConfiguration"
  | "instances.updateDetails"
  | "instances.upgrade"
  | "userConfiguration.remove"
  | "host.openExternalUrl";

export interface ServerInfo {
  /** Implementation version of the frame. Informational; do not branch on it. */
  version: string;
  /** Protocol identifier. A host that does not speak this must not proceed. */
  protocol: ProtocolVersion;
  features: FeatureName[];
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
}

/** An interface, not a class: capnweb detects remote-callable targets with
 * `instanceof RpcTarget` and each package installs its own copy, so a base class here would
 * be the wrong `RpcTarget` and the frame's targets would be rejected as non-serializable. */
export interface PrismaticApi {
  serverInfo(): Promise<ServerInfo> | ServerInfo;
  getAuthenticatedUser(): Promise<AuthenticatedUser>;
  /**
   * Opaque cache scope, stable across token refreshes that keep the session live.
   * Changes whenever authentication revokes the previous session, including
   * customer or permission changes for the same user.
   */
  getSessionScope(): Promise<string>;
  connections: ConnectionsApi;
  marketplace: MarketplaceApi;
  instances: InstancesApi;
}

/**
 * The root the frame exposes before any token is supplied. `authenticate()` returns the authed
 * surface as a stub, so `api.authenticate(jwt).marketplace.list()` is one round trip.
 *
 * Re-authenticating as the same identity swaps the token underneath outstanding stubs; as a
 * different identity it revokes the session, whose stubs then reject with an error whose
 * `code` is {@link SESSION_REVOKED_CODE}. Match on that — class identity dies on the wire.
 */
export interface PreAuthApi {
  /** Needs no token, and stays shape-compatible across every major: it is how a host
   * discovers it cannot talk to this frame at all. */
  serverInfo(): Promise<ServerInfo> | ServerInfo;
  authenticate(jwt: string): Promise<PrismaticApi>;
}

/** Capabilities the host grants the frame, the reverse direction of a bidirectional session.
 * Members are required because a stub is a Proxy and no property check could tell whether the
 * host implemented one; granting nothing means passing no `HostApi`, and the frame reads a
 * rejected call as "not granted". */
export interface HostApi {
  /** Open a URL in a new tab — an OAuth consent screen, say. The frame cannot: a cross-origin
   * iframe calling `window.open` is blocked as an unsanctioned popup. Returns whether the host
   * opened it, so the frame can prompt about popup blocking instead of awaiting a callback
   * that never arrives. */
  openExternalUrl(url: string): Promise<boolean> | boolean;
}
