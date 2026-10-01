/** Runtime predicates over the protocol's error codes. */

import {
  type FeatureName,
  PROTOCOL_MISMATCH_CODE,
  SESSION_REVOKED_CODE,
  type ServerInfo,
} from "./protocol/index.js";
import type {
  ConnectionError,
  MarketplaceIntegrationError,
  PrismaticError,
} from "./resource.js";

const codeOf = (error: unknown): unknown =>
  typeof error === "object" && error !== null
    ? (error as { code?: unknown }).code
    : undefined;

/** Matched on `code`: class identity does not survive the wire. */
export const isProtocolMismatch = (error: unknown): boolean =>
  codeOf(error) === PROTOCOL_MISMATCH_CODE;

/** True for a rejection from a stub whose session a re-authentication revoked. */
export const isSessionRevoked = (error: unknown): boolean =>
  codeOf(error) === SESSION_REVOKED_CODE;

/** Whether the frame implements a named capability. */
export const hasFeature = (info: ServerInfo, feature: FeatureName): boolean =>
  info.features.includes(feature);

export const toMarketplaceIntegrationError = (
  caught: unknown,
): MarketplaceIntegrationError => {
  const error = caught instanceof Error ? caught : new Error(String(caught));
  const code = codeOf(error);
  switch (code) {
    case SESSION_REVOKED_CODE:
    case PROTOCOL_MISMATCH_CODE:
    case "PRISMATIC_MARKETPLACE_INTEGRATION_NOT_FOUND":
    case "PRISMATIC_MARKETPLACE_INTEGRATION_UNAVAILABLE":
    case "PRISMATIC_ACTION_DISPOSED":
    case "PRISMATIC_ACTION_BUSY":
      return Object.assign(new Error(error.message, { cause: error }), {
        code,
      });
    default:
      return Object.assign(new Error(error.message, { cause: error }), {
        code: "PRISMATIC_UNKNOWN" as const,
      });
  }
};

/** Codes any action or resource can fail with, whatever its domain. */
export const baseErrorCodes = [
  SESSION_REVOKED_CODE,
  PROTOCOL_MISMATCH_CODE,
  "PRISMATIC_ACTION_DISPOSED",
  "PRISMATIC_ACTION_BUSY",
  "PRISMATIC_UNKNOWN",
] as const;

export type BaseErrorCode = (typeof baseErrorCodes)[number];

/** Keeps a wire error whose code belongs to the domain or the base set; anything else becomes UNKNOWN. */
export const toPrismaticError = <E extends PrismaticError>(
  codes: readonly Exclude<E["code"], BaseErrorCode>[],
): ((error: unknown) => E) => {
  const known = new Set<string>([...codes, ...baseErrorCodes]);
  return (error) => {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      typeof error.code === "string" &&
      known.has(error.code) &&
      "message" in error &&
      typeof error.message === "string"
    ) {
      return error as E;
    }
    return {
      name: "Error",
      message: error instanceof Error ? error.message : String(error),
      code: "PRISMATIC_UNKNOWN",
    } as E;
  };
};

export const toConnectionError =
  /* @__PURE__ */ toPrismaticError<ConnectionError>([
    "PRISMATIC_CONNECTION_NOT_FOUND",
    "PRISMATIC_CONNECTION_REMOVED",
    "PRISMATIC_CONNECTION_FORBIDDEN",
    "PRISMATIC_CONNECTION_INVALID",
    "PRISMATIC_CONNECT_FAILED",
    "PRISMATIC_CONNECT_TIMEOUT",
    "PRISMATIC_CONNECT_ABORTED",
    "PRISMATIC_CONNECT_ABANDONED",
    "PRISMATIC_POPUP_BLOCKED",
  ]);
