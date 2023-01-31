import { Options } from "../types";
import { assertInit } from "../utils/assertInit";
import { setIframe } from "../utils/iframe";

type ShowComponentsProps = Options & {};

export const showComponents = (options: ShowComponentsProps) => {
  assertInit("showComponents");

  setIframe("components", options, {});
};
