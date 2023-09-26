import { Options } from "../types/options";
import { assertInit } from "../utils/assertInit";
import { setIframe } from "../utils/iframe";

export type ShowMarketplaceProps = Options & {};

export const showMarketplace = (
  options: ShowMarketplaceProps = { usePopover: true }
) => {
  assertInit("showMarketplace");

  setIframe("/integration-marketplace/", options, {});
};
