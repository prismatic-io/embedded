import stateService from "../state";

export const assertEmbeddedDesigner = (functionName: string) => {
  if (!stateService.getStateCopy().embeddedDesignerEnabled) {
    throw new Error(
      `Embedded designer must be enabled for this customer in order to call ${functionName}`
    );
  }
};
