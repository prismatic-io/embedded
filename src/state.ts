import type { Filters } from "./types/filters";
import type { FontConfiguration } from "./types/fontConfiguration";
import type { ScreenConfiguration } from "./types/screenConfiguration";
import type { Theme } from "./types/theme";
import type { Translation } from "./types/translation";

export interface State {
  filters: Filters;
  initComplete: boolean;
  jwt: string;
  embeddedDesignerEnabled: boolean;
  prismaticUrl: string;
  screenConfiguration?: ScreenConfiguration;
  skipPreload?: boolean;
  theme?: Theme;
  fontConfiguration?: FontConfiguration;
  translation?: Translation;
}

const defaultState: State = {
  filters: {},
  initComplete: false,
  jwt: "",
  embeddedDesignerEnabled: false,
  prismaticUrl: "https://app.prismatic.io",
  screenConfiguration: undefined,
  theme: undefined,
  fontConfiguration: undefined,
  translation: undefined,
};

export const ValidKeys: ReadonlySet<keyof State> = new Set(
  Object.keys(defaultState) as Array<keyof State>,
);

export const isStateKey = (key: string): key is keyof State =>
  (ValidKeys as ReadonlySet<string>).has(key);

// Assigning `state[key] = value` where `key: keyof State` trips TS's
// correlated-types limitation — the index evaluates to an intersection
// (`never`) instead of the union. Wrapping the assignment in a generic
// function bound to a single `K` lets TS treat `State[K]` as a single
// concrete type, which matches the `value` parameter cleanly.
export const setStateKey = <K extends keyof State>(
  state: State,
  key: K,
  value: State[K],
): void => {
  state[key] = value;
};

class StateService {
  private defaultState: State;
  private state: State | null = null;

  constructor(defaultState: State) {
    this.defaultState = defaultState;
  }

  getInitialState(): State {
    return JSON.parse(JSON.stringify(this.defaultState));
  }

  /**
   * A function that returns a copy of the current state.  If a mutation is desired, you must call
   * `stateService.setState` afterwards to persist the updated copy.
   * @returns A deep copy of the state to prevent accidental mutations.
   */
  getStateCopy(): State {
    if (this.state) {
      return JSON.parse(JSON.stringify(this.state));
    }

    return this.getInitialState();
  }

  setState(state: State) {
    this.state = state;
  }
}

const stateService = new StateService(defaultState);

export default stateService;
