import { state } from "../state";

export const assertInit = (functionName: string) => {
  if (!state.initComplete) {
    throw new Error(
      `Expected init to be called before calling ${functionName}`
    );
  }
};
