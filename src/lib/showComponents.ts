import { Options } from "../types/options";
import { assertInit } from "../utils/assertInit";
import { setIframe } from "../utils/iframe";

export type ShowComponentsProps = Options & {};

export const showComponents = (options: ShowComponentsProps) => {
  assertInit("showComponents");

  setIframe("/components/", options, {});
};
