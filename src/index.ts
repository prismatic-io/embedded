import {
  authenticate,
  configureInstance,
  graphqlRequest,
  init,
  setConfigVars,
  showComponent,
  showComponents,
  showDesigner,
  showIntegrations,
  showLogs,
  showMarketplace,
} from "./lib";

export { getMessageIframe } from "./utils/postMessage";

export * from "./types";

export default {
  authenticate,
  configureInstance,
  /**
   * @deprecated Use configureInstance instead
   */
  configureIntegration: configureInstance, // alias for backwards compatibility
  graphqlRequest,
  init,
  setConfigVars,
  showComponent,
  showComponents,
  showDesigner,
  showIntegrations,
  showLogs,
  showMarketplace,
};
