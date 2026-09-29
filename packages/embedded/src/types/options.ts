import type { AgentConfiguration } from "./agent";
import type { Filters } from "./filters";
import type { ScreenConfiguration } from "./screenConfiguration";
import type { ThemeOption } from "./theme";
import type { Translation } from "./translation";

interface OptionsBase {
  agent?: AgentConfiguration;
  autoFocusIframe?: boolean;
  filters?: Filters;
  screenConfiguration?: ScreenConfiguration;
  theme?: ThemeOption;
  translation?: Translation;
}

export interface SelectorOptions extends OptionsBase {
  selector: string;
  usePopover?: false;
}

export interface PopoverOptions extends OptionsBase {
  usePopover: true;
}

export type Options = PopoverOptions | SelectorOptions;

export const isPopover = (options: Options): options is PopoverOptions =>
  options.usePopover === true;
