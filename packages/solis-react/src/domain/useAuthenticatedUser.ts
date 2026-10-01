import type { AuthenticatedUser } from "@prismatic-io/solis-core/protocol";
import type {
  Action,
  PrismaticError,
  Resource,
} from "@prismatic-io/solis-core";
import { toPrismaticError } from "@prismatic-io/solis-core/internal";
import { useMemo } from "react";
import { keys } from "../internal/keys.js";
import { loadAuthenticatedUser } from "../internal/loaders.js";
import { toResource } from "../internal/toResource.js";
import { useRead } from "../internal/useResource.js";
import { useResourceRefreshAction } from "../internal/useResourceRefreshAction.js";
import { useSessionState } from "../PrismaticProvider.js";
import { useFeature } from "./useFeature.js";

export type AuthenticatedUserResource = Resource<
  AuthenticatedUser,
  PrismaticError,
  { refresh: Action<void, void, PrismaticError> }
>;

const toAuthenticatedUserError =
  /* @__PURE__ */ toPrismaticError<PrismaticError>([]);

/**
 * The user behind the current token. Plain data, not a stub, so nothing needs disposing.
 * Every reader shares one entry.
 */
export const useAuthenticatedUser = (): AuthenticatedUserResource => {
  const session = useSessionState();
  const guard = useFeature("authenticatedUser");

  const read = useRead<AuthenticatedUser>(
    useMemo(
      () => ({
        key: keys.authenticatedUser(),
        load: (api) => loadAuthenticatedUser(api, guard),
      }),
      [guard],
    ),
  );
  const refresh = useResourceRefreshAction({
    key: keys.authenticatedUser(),
    guard,
    toError: toAuthenticatedUserError,
  });
  const actions = useMemo(() => ({ refresh }), [refresh]);

  return useMemo(
    () =>
      toResource({
        error: session.error ?? read.error,
        data: read.data,
        isRefreshing: read.isRefetching || refresh.status === "loading",
        actions,
        toError: toAuthenticatedUserError,
      }),
    [
      session.error,
      read.error,
      read.data,
      read.isRefetching,
      refresh.status,
      actions,
    ],
  );
};
