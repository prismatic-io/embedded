import { ConnectError, type FeatureName } from "@prismatic-io/solis-core";
import { useCallback } from "react";
import { useServerFeatures } from "../PrismaticProvider.js";

/**
 * A guard that throws when the frame does not announce `feature`. Call it inside an
 * acquire so the failure names the feature. Passes while `serverInfo` is unknown.
 */
export const useFeature = (feature: FeatureName): (() => void) => {
  const { hasFeature, serverInfo } = useServerFeatures();

  return useCallback(() => {
    if (!serverInfo) return;
    if (!hasFeature(feature)) {
      throw new ConnectError(
        `The embedded frame does not support "${feature}". Its version is ${serverInfo.version}.`,
      );
    }
  }, [hasFeature, serverInfo, feature]);
};
