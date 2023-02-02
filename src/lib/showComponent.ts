import { Options } from "../types/options";
import { assertInit } from "../utils/assertInit";
import { setIframe } from "../utils/iframe";

type ShowComponentProps = Options & {
  componentId: string;
};

export const showComponent = ({
  componentId,
  ...options
}: ShowComponentProps) => {
  assertInit("showComponent");

  setIframe(`components/${componentId}`, options, {});
};
