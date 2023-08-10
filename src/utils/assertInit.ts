import stateService from "../state";

export const assertInit = (functionName: string) => {
  if (!stateService.getStateCopy().initComplete) {
    throw new Error(
      `Expected init to be called before calling ${functionName}`
    );
  }
};
