import { getCurrentState } from "../state";

export const assertInit = (functionName: string) => {
  if (!getCurrentState().initComplete) {
    throw new Error(
      `Expected init to be called before calling ${functionName}`
    );
  }
};
