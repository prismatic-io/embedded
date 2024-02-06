import { Filters } from "./types/filters";
import { FontConfiguration } from "./types/fontConfiguration";
import { ScreenConfiguration } from "./types/screenConfiguration";
import { Theme } from "./types/theme";
import { Translation } from "./types/translation";

export interface State {
  filters: Filters;
  initComplete: boolean;
  jwt: string;
  embeddedDesignerEnabled: boolean;
  prismaticUrl: string;
  screenConfiguration?: ScreenConfiguration;
  theme?: Theme;
  fontConfiguration?: FontConfiguration;
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
  embeddedDesignerEnabled: false,
  prismaticUrl: "https://app.prismatic.io",
  screenConfiguration: undefined,
  theme: undefined,
  fontConfiguration: undefined,
  translation: undefined,
};

export const ValidKeys: Set<string> = new Set<string>(
  Object.keys(defaultState)
);

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
