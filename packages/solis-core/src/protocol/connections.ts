/** Connections: the credentials an instance runs against, and the templates that seed them. */

import type { ProtocolMismatchCode, SessionRevokedCode } from "./api.js";
import type { Result } from "./configuration.js";
import type { Permission } from "./permissions.js";

export type ConnectionManagedBy = "org" | "customer" | "system" | "user";
export type ConnectionScope = "org" | "customer" | "user";
/**
 * Who activates the connection. Connections the organization activates are never served
 * to a customer, so they have no kind here. `userActivated` is a personal connection the
 * user can reuse; `userLevel` is the user's own credential for a connection one instance's
 * user-level configuration needs. Both are served only to the user they belong to.
 */
export type ConnectionKind =
  | "customerActivated"
  | "manualCustomerActivated"
  | "userActivated"
  | "userLevel";
export type ConnectionStatus =
  | "PENDING"
  | "ACTIVE"
  | "ERROR"
  | "FAILED"
  | "UNKNOWN";

/** Why a connection can't be connected or disconnected by this user right now. */
export type ConnectionPermissionReason =
  /** Only OAuth 2 connections authorize; the rest are saved with their inputs. */
  | "NOT_OAUTH"
  /** Client-credentials connections connect when they're saved, with no consent screen. */
  | "CLIENT_CREDENTIALS"
  /** The user's role can't change it. */
  | "ROLE_RESTRICTED"
  /** Already connected: disconnect it first to authorize again. */
  | "ALREADY_CONNECTED"
  /** Nothing to disconnect. */
  | "NOT_CONNECTED";

export interface ConnectionPermissions {
  connect: Permission<ConnectionPermissionReason>;
  disconnect: Permission<ConnectionPermissionReason>;
}

export interface ConnectionOperationError extends Error {
  code:
    | "PRISMATIC_CONNECTION_NOT_FOUND"
    | "PRISMATIC_CONNECTION_REMOVED"
    | "PRISMATIC_CONNECTION_FORBIDDEN"
    | "PRISMATIC_CONNECTION_INVALID"
    | "PRISMATIC_CONNECT_FAILED"
    | SessionRevokedCode
    | ProtocolMismatchCode
    | "PRISMATIC_UNKNOWN";
}

/** Where to send the user to consent. */
export interface ConnectionAuthorization {
  /** The provider's consent screen, always `https:`. */
  url: string;
}

/** A new credential for a customer-activated connection, made by the session's customer. */
export interface CreateConnectionInput {
  /** {@link ConnectionTemplateRef.id} of the requirement it's for. */
  templateId: string;
  /** The name the customer gives it. */
  label?: string;
  /** Input values by name, beside the ones the template supplies. */
  inputs?: Readonly<Record<string, string>>;
}

/** The customer-activated connection a requirement's new credentials are made from. */
export interface ConnectionTemplateRef {
  id: string;
  /** OAuth 2 grant name, or `null` for a connection that is not OAuth-based. */
  oauth2Type: string | null;
}

export type CreateConnectionPermissionReason =
  /** The user's role can't make connections for the customer. */
  | "ROLE_RESTRICTED"
  /** The requirement isn't for a customer-activated connection. */
  | "NO_TEMPLATE";

export interface ConnectionComponentSummary {
  key: string;
  label: string;
  iconUrl: string | null;
}

export interface ConnectionTypeSummary {
  key: string;
  label: string;
  /** OAuth 2 grant name, or `null` for a connection that is not OAuth-based. */
  oauth2Type: string | null;
  iconUrl: string | null;
}

export interface ConnectionInputValue {
  name: string;
  type: string;
  /** `null` for a write-only input; secrets are never read back. */
  value: string | null;
  meta: Record<string, unknown> | null;
}

/** One emission from {@link Connection.state}: the connection's readable properties as plain data. */
export interface ConnectionState {
  /** Opaque: pass it back as-is, never parse it. */
  id: string;
  kind: ConnectionKind;
  /** The name a customer gave the credential, or the connection's own name. */
  label: string;
  /**
   * The connection the author declared, which every credential for it shares.
   * `stableKey` survives a version bump; match on it to find "the same connection".
   */
  definition: ConnectionDefinition;
  description: string | null;
  status: ConnectionStatus;
  managedBy: ConnectionManagedBy;
  variableScope: ConnectionScope;
  component: ConnectionComponentSummary;
  connection: ConnectionTypeSummary;
  inputs: ConnectionInputValue[];
  oAuthRedirectConfig: {
    successRedirectUri: string | null;
    failureRedirectUri: string | null;
  } | null;
  permissions: ConnectionPermissions;
}

export interface ConnectionDefinition {
  id: string;
  stableKey: string;
}

export interface ConnectionTemplate {
  id: string;
  name: string;
  /** Input names the template supplies; the rest are the customer's to fill. */
  templatedInputKeys: string[];
  connection: {
    id: string;
    key: string;
    component: {
      id: string;
      key: string;
      public: boolean;
    };
  };
}

/**
 * Live reference to one connection on the server, as returned by
 * {@link ConnectionsApi.list} and {@link ConnectionsApi.get}.
 *
 * The host must dispose stubs it holds (`using`, or `stub[Symbol.dispose]()`) so
 * the frame can drop its export-table entry.
 */
export interface Connection {
  /**
   * The connection's readable properties, emitted on subscribe and again on every
   * change until the stream is cancelled. Cancel the reader to release the
   * server-side subscription.
   *
   * A value reflects the server as of this session's last interaction: the frame
   * emits after its own mutations, not on a timer, so a change made in another tab
   * or by a flow run is not observed until this session reads again. The exception is
   * an authorization in flight, which the frame re-reads until it settles (see
   * {@link Connection.authorize}).
   */
  state(): ReadableStream<ConnectionState>;
  /**
   * Starts an OAuth authorization and returns the consent URL. Until the status settles or
   * 15 minutes pass, the frame re-reads the connection every 2 seconds, and at once when
   * the page becomes visible again, and emits each change on `state()`. The frame never
   * sees the host window regain focus, so a host that wants the outcome sooner, when a
   * consent popup closes, reads the connection again with {@link ConnectionsApi.get}.
   * Refused as `PRISMATIC_CONNECTION_FORBIDDEN` when `permissions.connect` is denied.
   */
  authorize(): Promise<
    Result<ConnectionAuthorization, ConnectionOperationError>
  >;
  /** Clears the credential's token and answers the connection, back to `PENDING`. */
  disconnect(): Promise<Result<ConnectionState, ConnectionOperationError>>;
}

/** Narrows {@link ConnectionsApi.list} server-side; omitted fields do not constrain. */
export interface ListConnectionsFilter {
  componentKey?: string;
  kind?: ConnectionKind;
  status?: ConnectionStatus;
}

export interface ConnectionsApi {
  /** Connections the JWT's customer or user may use, filtered server-side. */
  list(filter?: ListConnectionsFilter): Promise<Connection[]>;
  /**
   * Lookup by {@link ConnectionState.id}. Rejects with `PRISMATIC_CONNECTION_NOT_FOUND`
   * when the caller can't see it; a connection this session saw before closes its open
   * `state()` streams as well.
   */
  get(id: string): Promise<Connection>;
  /**
   * Makes a credential for a customer-activated connection, owned by the session's customer.
   * A client-credentials connection connects as it's made, and the frame watches its status
   * as {@link Connection.authorize} does.
   */
  create(
    input: CreateConnectionInput,
  ): Promise<Result<Connection, ConnectionOperationError>>;
  templates: {
    list(filter?: { componentKey?: string }): Promise<ConnectionTemplate[]>;
  };
}
