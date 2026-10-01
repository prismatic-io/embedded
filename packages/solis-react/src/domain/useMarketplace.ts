/** Browsing the marketplace. */

import type {
  ConditionalExpression,
  MarketplaceIntegrationState,
  MarketplaceOrdering,
} from "@prismatic-io/solis-core/protocol";
import type {
  ListInput,
  ListResource,
  MarketplaceIntegrationError,
  MarketplaceIntegrationResource,
} from "@prismatic-io/solis-core";
import { toMarketplaceIntegrationError } from "@prismatic-io/solis-core/internal";
import { useCallback } from "react";
import type { ItemSources } from "../internal/useListItems.js";
import { keys } from "../internal/keys.js";
import {
  type LoadedIntegration,
  loadIntegration,
  loadMarketplacePage,
} from "../internal/loaders.js";
import {
  useAdoptInstance,
  useNestedInstanceOwnership,
} from "../internal/instanceEffects.js";
import {
  toIntegrationResource,
  unavailableCreateInstance,
} from "../internal/useIntegrationResource.js";
import { useListResource } from "../internal/useListResource.js";
import {
  useResourceCache,
  useSessionState,
  useSessionToken,
} from "../PrismaticProvider.js";
import { useFeature } from "./useFeature.js";

export type MarketplaceInput = {
  search?: string;
  category?: string;
  label?: string;
  ordering?: readonly MarketplaceOrdering[];
  includeActiveIntegrations?: boolean;
  /** Restrict to activated (`true`) or inactive (`false`) integrations. */
  activated?: boolean;
  filterQuery?: ConditionalExpression;
  /** Require every `filterQuery` term to match rather than any. */
  strictMatchFilterQuery?: boolean;
} & ListInput;

const DEFAULT_PAGE_SIZE = 25;

const stubOf = ({ stub }: LoadedIntegration) => stub;

/** The nested instances count as an owned source: an item re-projects when any of them moves. */
const actionsOf = ({ createInstance, instances }: LoadedIntegration) => [
  createInstance,
  instances,
];

/**
 * The visible marketplace as a list of integration resources. `filter` is compared
 * structurally, so an inline literal does not re-list. Each item is the same resource
 * `useMarketplaceIntegration(id)` returns, sharing its cache entry and action statuses, and
 * carries its instances from one read of the customer's instances rather than one per item.
 */
export const useMarketplace = (
  filter: MarketplaceInput = {},
): ListResource<
  MarketplaceIntegrationResource,
  MarketplaceIntegrationError
> => {
  const {
    pageSize = DEFAULT_PAGE_SIZE,
    onPageLoad = "append",
    search,
    ...rest
  } = filter;
  const guard = useFeature("marketplace");
  const adopt = useAdoptInstance();
  const nested = useNestedInstanceOwnership();
  const cache = useResourceCache();
  const token = useSessionToken();
  const session = useSessionState();
  const filters = search === undefined ? rest : { ...rest, searchTerm: search };
  const key = keys.marketplace({ ...filters, pageSize, onPageLoad });

  // Pinned to the structural key, so an inline literal does not re-acquire.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `filters` is represented by `key`
  const fetchPage = useCallback(
    (
      api: Parameters<typeof loadMarketplacePage>[0]["api"],
      cursor: string | null,
    ) =>
      loadMarketplacePage({
        api,
        guard,
        adopt,
        nested,
        filters,
        pageSize,
        cursor,
        cache,
        token,
      }),
    [key, guard, adopt, nested, cache, token],
  );
  const loadEntity = useCallback(
    (
      api: Parameters<typeof loadIntegration>[0]["api"],
      integrationId: string,
    ) => loadIntegration({ api, guard, adopt, nested, integrationId }),
    [guard, adopt, nested],
  );
  const project = useCallback(
    ({
      entry,
      live,
      liveError,
      refresh,
    }: ItemSources<
      LoadedIntegration,
      MarketplaceIntegrationState,
      MarketplaceIntegrationError
    >) =>
      toIntegrationResource({
        error: session.error ?? entry.error ?? liveError,
        loaded: entry.value,
        live,
        instances: entry.value?.instances.getSnapshot(),
        isRefreshing: entry.isRefetching || refresh.status === "loading",
        actions: {
          refresh,
          createInstance: (
            entry.value?.createInstance ?? unavailableCreateInstance
          ).getSnapshot(),
        },
      }),
    [session.error],
  );

  return useListResource({
    key,
    mode: onPageLoad,
    guard,
    toError: toMarketplaceIntegrationError,
    fetchPage,
    loadEntity,
    stubOf,
    actionsOf,
    project,
  });
};
