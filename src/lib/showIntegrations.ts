import { Options } from "../types/options";
import { assertEmbeddedDesigner } from "../utils/assertEmbeddedDesigner";
import { assertInit } from "../utils/assertInit";
import { setIframe } from "../utils/iframe";

export type ShowIntegrationsProps = Options & {};

export const showIntegrations = (options: ShowIntegrationsProps) => {
  assertInit("showIntegrations");
  assertEmbeddedDesigner("showIntegrations");

  setIframe("/integrations/", options, {});
};
