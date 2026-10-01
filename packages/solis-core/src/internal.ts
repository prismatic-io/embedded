/**
 * The machinery `@prismatic-io/solis-react` builds on. Not part of the public API:
 * it changes without notice, so hosts use the root export.
 */

export type { DisposableActionHandle } from "./action.js";
export { createAction, toConfigurationError } from "./action.js";
export {
  ABANDON_GRACE_MS,
  CONNECT_TIMEOUT_MS,
  type ConsentWindow,
  connectionFailure,
  openConsentWindow,
  watchConnect,
} from "./connect.js";
export { disposeAll, disposeQuietly } from "./dispose.js";
export {
  toConnectionError,
  toMarketplaceIntegrationError,
  toPrismaticError,
} from "./errors.js";
export type {
  SharedList,
  SharedListStatus,
  SharedState,
  SharedStateStatus,
  Stateful,
} from "./observe.js";
export {
  observeState,
  observeStateList,
  STATE_RELEASE_GRACE_MS,
} from "./observe.js";
export { queryKey } from "./queryKey.js";
