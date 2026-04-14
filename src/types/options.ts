import type { Filters } from "./filters";
import type { ScreenConfiguration } from "./screenConfiguration";
import type { Theme } from "./theme";
import type { Translation } from "./translation";

interface OptionsBase {
  autoFocusIframe?: boolean;
  filters?: Filters;
  screenConfiguration?: ScreenConfiguration;
  theme?: Theme;
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
