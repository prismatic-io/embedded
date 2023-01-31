import { Options } from "../types";
import { assertInit } from "../utils/assertInit";
import { setIframe } from "../utils/iframe";

type ShowMarketplaceProps = Options & {};

export const showMarketplace = (options: ShowMarketplaceProps) => {
  assertInit("showMarketplace");

  setIframe("integration-marketplace", options, {});
};
