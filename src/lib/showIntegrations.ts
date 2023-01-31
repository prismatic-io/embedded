import { Options } from "../types";
import { assertInit } from "../utils/assertInit";
import { setIframe } from "../utils/iframe";

type ShowIntegrationsProps = Options & {};

export const showIntegrations = (options: ShowIntegrationsProps) => {
  assertInit("showIntegrations");

  setIframe("integrations", options, {});
};
