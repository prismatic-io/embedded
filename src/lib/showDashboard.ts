import { Options } from "../types/options";
import { assertInit } from "../utils/assertInit";
import { setIframe } from "../utils/iframe";

export type ShowDashboardProps = Options & {};

export const showDashboard = (
  options: ShowDashboardProps = { usePopover: true }
) => {
  assertInit("showDashboard");

  setIframe("/dashboard/", options, {});
};
