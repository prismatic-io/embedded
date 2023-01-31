import { Filters, ScreenConfiguration, Theme, Translation } from "./types";

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
