import { configureInstance } from "./configureInstance";

export { authenticate } from "./authenticate";
export {
  configureInstance,
  /**
   * @deprecated Use configureInstance instead
   */
  configureInstance as configureIntegration, // alias for backwards compatibility
};
export { graphqlRequest } from "./graphqlRequest";
export { init } from "./init";
export { setConfigVars } from "./setConfigVars";
export { showComponent } from "./showComponent";
export { showComponents } from "./showComponents";
export { showDesigner } from "./showDesigner";
export { showIntegrations } from "./showIntegrations";
export { showLogs } from "./showLogs";
export { showMarketplace } from "./showMarketplace";
