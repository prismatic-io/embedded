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

export const setConfigVars = ({ configVars, ...props }: SetConfigVarsProps) => {
  postMessage({
    ...props,
    event: { event: "SET_CONFIG_VAR", data: configVars },
  });
};
