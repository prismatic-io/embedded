import type { MarketplaceFilterOptions } from "@prismatic-io/solis-core/protocol";
import type {
  Action,
  PrismaticError,
  Resource,
} from "@prismatic-io/solis-core";
import { toPrismaticError } from "@prismatic-io/solis-core/internal";
import { useMemo } from "react";
import { keys } from "../internal/keys.js";
import { toResource } from "../internal/toResource.js";
import { useRead } from "../internal/useResource.js";
import { useResourceRefreshAction } from "../internal/useResourceRefreshAction.js";
import { useSessionState } from "../PrismaticProvider.js";
import { useFeature } from "./useFeature.js";

export type MarketplaceFilterOptionsResource = Resource<
  MarketplaceFilterOptions,
  PrismaticError,
  { refresh: Action<void, void, PrismaticError> }
>;

const toFilterOptionsError = /* @__PURE__ */ toPrismaticError<PrismaticError>(
  [],
);

/**
 * Complete, distinct categories and labels, shared by readers within the authenticated
 * session. Loading these does not acquire marketplace row stubs.
 */
export const useMarketplaceFilterOptions =
  (): MarketplaceFilterOptionsResource => {
    const session = useSessionState();
    const guard = useFeature("marketplace.filterOptions");
    const read = useRead<MarketplaceFilterOptions>(
      useMemo(
        () => ({
          key: keys.marketplaceFilterOptions(),
          load: async (api) => {
            guard();
            return { value: await api.marketplace.filterOptions() };
          },
        }),
        [guard],
      ),
    );
    const refresh = useResourceRefreshAction({
      key: keys.marketplaceFilterOptions(),
      guard,
      toError: toFilterOptionsError,
    });
    const actions = useMemo(() => ({ refresh }), [refresh]);

    return useMemo(
      () =>
        toResource({
          error: session.error ?? read.error,
          data: read.data,
          isRefreshing: read.isRefetching || refresh.status === "loading",
          actions,
          toError: toFilterOptionsError,
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
