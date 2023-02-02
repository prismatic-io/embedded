import { Filters } from "./types/filters";
import { ScreenConfiguration } from "./types/screenConfiguration";
import { Theme } from "./types/theme";
import { Translation } from "./types/translation";

export interface State {
  filters: Filters;
  initComplete: boolean;
  jwt: string;
  prismaticUrl: string;
  screenConfiguration?: ScreenConfiguration;
  theme?: Theme;
  translation?: Translation;
}

export const state: State = {
  filters: {
    category: undefined,
    label: undefined,
  },
  initComplete: false,
  jwt: "",
  prismaticUrl: "https://app.prismatic.io",
  screenConfiguration: undefined,
  theme: undefined,
  translation: undefined,
};
