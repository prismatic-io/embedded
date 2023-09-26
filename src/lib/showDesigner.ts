import { Options } from "../types/options";
import { assertInit } from "../utils/assertInit";
import { setIframe } from "../utils/iframe";

export type ShowDesignerProps = Options & {
  integrationId: string;
};

export const showDesigner = ({
  integrationId,
  ...options
}: ShowDesignerProps) => {
  assertInit("showDesigner");

  setIframe(`/integrations/${integrationId}/`, options, {});
};
