import {
  authenticate,
  configureIntegration,
  graphqlRequest,
  init,
  setConfigVars,
  showComponent,
  showComponents,
  showDesigner,
  showIntegrations,
  showMarketplace,
} from "./lib";

export {
  ConfigVar,
  ConnectionConfigVar,
  ConnectionConfigVarInput,
  DefaultConfigVar,
  DefaultConfigVarInput,
} from "./lib/setConfigVars";

export {
  MessageData,
  PrismaticMessageEvent,
  getMessageIframe,
} from "./utils/postMessage";

export { ScreenConfiguration } from "./types/screenConfiguration";

export { Translation } from "./types/translation";

export default {
  authenticate,
  configureIntegration,
  graphqlRequest,
  init,
  setConfigVars,
  showComponent,
  showComponents,
  showDesigner,
  showIntegrations,
  showMarketplace,
};
