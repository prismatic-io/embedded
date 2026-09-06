import type { Options } from "../types/options";
import { assertInit } from "../utils/assertInit";
import { setIframe } from "../utils/iframe";

export type ShowDashboardProps = Options & {};

/**
 * Renders the customer dashboard, which provides an overview of the customer's
 * deployed instances, logs, connections, and other resources.
 *
 * Specific tabs can be hidden via `screenConfiguration.dashboard.hideTabs`.
 *
 * @param options - Display options for the dashboard.
 *
 * @example
 * // Show dashboard in a popover
 * prismatic.showDashboard({ usePopover: true });
 *
 * @example
 * // Show dashboard inline, hiding certain tabs
 * prismatic.showDashboard({
 *   selector: "#dashboard-container",
 *   screenConfiguration: {
 *     dashboard: { hideTabs: ["Logs", "Credentials"] },
 *   },
 * });
 *
 * @see {@link https://prismatic.io/docs/embed/additional-screens/show-dashboard/ | Embedding the Dashboard}
 */
export const showDashboard = (
  options: ShowDashboardProps = { usePopover: true },
) => {
  assertInit("showDashboard");

  setIframe("/dashboard/", options, {});
};
