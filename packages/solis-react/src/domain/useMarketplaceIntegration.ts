import type { MarketplaceIntegrationResource } from "@prismatic-io/solis-core";
import { useMemo } from "react";
import {
  useAdoptInstance,
  useNestedInstanceOwnership,
} from "../internal/instanceEffects.js";
import { keys } from "../internal/keys.js";
import {
  type LoadedIntegration,
  loadIntegration,
} from "../internal/loaders.js";
import { useIntegrationResource } from "../internal/useIntegrationResource.js";
import { useRead } from "../internal/useResource.js";
import { useFeature } from "./useFeature.js";

/**
 * Reads a marketplace integration and subscribes to updates. `actions.createInstance` is
 * owned by the integration's entry, so a marketplace item and this resource share its status.
 * `data.instances` are the integration's instances on every version, each the resource
 * `useInstance(id)` returns.
 */
export const useMarketplaceIntegration = (
  integrationId: string | null | undefined,
): MarketplaceIntegrationResource => {
  const guard = useFeature("marketplace");
  const adopt = useAdoptInstance();
  const nested = useNestedInstanceOwnership();
  const read = useRead<LoadedIntegration>(
    useMemo(
      () =>
        integrationId !== null && integrationId !== undefined
          ? {
              key: keys.integration(integrationId),
              load: (api) =>
                loadIntegration({ api, guard, adopt, nested, integrationId }),
            }
          : null,
      [integrationId, guard, adopt, nested],
    ),
  );
  return useIntegrationResource({ read, integrationId });
};
