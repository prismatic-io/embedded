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

export {
  MessageData,
  PrismaticMessageEvent,
  getMessageIframe,
} from "./utils/postMessage";

export {
  ConfigVar,
  ConnectionConfigVar,
  ConnectionConfigVarInput,
  DefaultConfigVar,
  DefaultConfigVarInput,
} from "./types/configVars";

export { ScreenConfiguration } from "./types/screenConfiguration";

export { Translation } from "./types/translation";

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
