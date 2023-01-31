import { Options } from "../types";
import { assertInit } from "../utils/assertInit";
import { setIframe } from "../utils/iframe";

type ShowDesignerProps = Options & {
  integrationId: string;
};

export const showDesigner = ({
  integrationId,
  ...options
}: ShowDesignerProps) => {
  assertInit("showDesigner");

  setIframe(`integrations/${integrationId}`, options, {});
};
