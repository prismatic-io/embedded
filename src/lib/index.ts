import {
  configureInstance,
  isConfigureInstanceWithInstanceId,
  isConfigureInstanceWithIntegrationId,
  isConfigureInstanceWithIntegrationName,
} from "./configureInstance";

export { authenticate } from "./authenticate";
export {
  configureInstance,
  /**
   * @deprecated Use configureInstance instead, this will be removed in the next major version (v3.0.0)
   */
  configureInstance as configureIntegration, // alias for backwards compatibility
  isConfigureInstanceWithInstanceId,
  isConfigureInstanceWithIntegrationId,
  isConfigureInstanceWithIntegrationName,
};
export { graphqlRequest } from "./graphqlRequest";
export { init, EMBEDDED_DEFAULTS } from "./init";
export { setConfigVars } from "./setConfigVars";
export { showComponent } from "./showComponent";
export { showComponents } from "./showComponents";
export { showDashboard } from "./showDashboard";
export { showDesigner } from "./showDesigner";
export { showIntegrations } from "./showIntegrations";
export { showLogs } from "./showLogs";
export { showMarketplace } from "./showMarketplace";
