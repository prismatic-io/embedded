import { PostMessageEvent } from "../types/postMessage";
import { postMessage } from "../utils/postMessage";
import {
  ConnectionConfigVarInput,
  DefaultConfigVarInput,
} from "../types/configVars";

interface SetConfigVarsPropsBase {
  configVars: Record<string, DefaultConfigVarInput | ConnectionConfigVarInput>;
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
    event: { event: PostMessageEvent.SET_CONFIG_VAR, data: configVars },
  });
};
