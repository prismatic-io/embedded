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

const defaultState: State = {
  filters: {
    category: undefined,
    filterQuery: undefined,
    label: undefined,
  },
  initComplete: false,
  jwt: "",
  prismaticUrl: "https://app.prismatic.io",
  screenConfiguration: undefined,
  theme: undefined,
  translation: undefined,
};

let state: State | null = null;

export const getCopyOfDefaultState = (): State => structuredClone(defaultState);

export const getCopyOfState = (): State =>
  structuredClone(state ?? defaultState);

export const getCurrentState = (): State => {
  // if we do not have a cached state then return a copy of the default state so that it can be safely mutated
  if (!state) return getCopyOfDefaultState();

  return state;
};

export const setCurrentState = (newState: State): void => {
  state = newState;
};
