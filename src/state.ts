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

class StateService {
  private defaultState: State;
  private state: State | null = null;

  constructor(defaultState: State) {
    this.defaultState = defaultState;
  }

  getInitialState() {
    return JSON.parse(JSON.stringify(this.defaultState));
  }

  /**
   * A function that returns a copy of the current state.  If a mutation is desired, you must call
   * `stateService.setState` afterwards to persist the updated copy.
   * @returns A deep copy of the state to prevent accidental mutations.
   */
  getStateCopy() {
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
