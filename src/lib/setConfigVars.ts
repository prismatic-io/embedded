import { ConfigVars } from "../types/configVars";
import { PrismaticMessageEvent } from "../types/postMessage";
import { postMessage } from "../utils/postMessage";

interface SetConfigVarsPropsBase {
  configVars: ConfigVars;
}

interface SelectorSetConfigVarProps extends SetConfigVarsPropsBase {
  selector?: string;
}

interface IFrameSetConfigVarProps extends SetConfigVarsPropsBase {
  iframe: Element;
}

export type SetConfigVarsProps =
  | IFrameSetConfigVarProps
  | SelectorSetConfigVarProps;

export const setConfigVars = ({
  configVars,
  ...options
}: SetConfigVarsProps) => {
  postMessage({
    ...options,
    event: { event: PrismaticMessageEvent.SET_CONFIG_VAR, data: configVars },
  });
};
