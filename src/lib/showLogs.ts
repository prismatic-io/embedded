import { Options } from "../types/options";
import { assertInit } from "../utils/assertInit";
import { setIframe } from "../utils/iframe";

export type ShowLogsProps = Options & {};

export const showLogs = (options: ShowLogsProps) => {
  assertInit("showLogs");

  setIframe("logs", options, {});
};
