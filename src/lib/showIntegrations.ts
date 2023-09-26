import { Options } from "../types/options";
import { assertInit } from "../utils/assertInit";
import { setIframe } from "../utils/iframe";

export type ShowIntegrationsProps = Options & {};

export const showIntegrations = (options: ShowIntegrationsProps) => {
  assertInit("showIntegrations");

  setIframe("/integrations/", options, {});
};
