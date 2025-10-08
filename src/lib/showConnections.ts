import { Options } from "../types/options";
import { assertInit } from "../utils/assertInit";
import { setIframe } from "../utils/iframe";

export type ShowConnectionsProps = Options & {};

export const showConnections = (options: ShowConnectionsProps) => {
  assertInit("showConnections");

  setIframe("/customer-connections/", options, {});
};
