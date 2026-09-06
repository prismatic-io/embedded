// @vitest-environment jsdom
import merge from "lodash.merge";
import { afterEach, describe, expect, it } from "vitest";
import { dispose } from "./lib/dispose";
import { init } from "./lib/init";
import stateService, { isStateKey } from "./state";

afterEach(() => {
  dispose();
  document.head.innerHTML = "";
  document.body.innerHTML = "";
});

describe("state", () => {
  // ValidKeys derives from the defaultState object literal, so a key present
  // only on the State type is dropped by init and setIframe with no type error.
  it.each([
    "agent",
    "filters",
    "screenConfiguration",
    "theme",
    "translation",
  ])("treats %s as a recognized option", (key) => {
    expect(isStateKey(key)).toBe(true);
  });

  it("keeps agent context supplied to init", () => {
    const context = { glossary: "a deal is an opportunity" };

    init({ agent: { context } });

    expect(stateService.getStateCopy().agent?.context).toEqual(context);
  });

  // Mirrors the merge setIframe performs, which is what lets a show* call add
  // context without dropping what init supplied.
  it("merges per-call agent context over the init context", () => {
    init({ agent: { context: { glossary: "global" } } });

    const state = stateService.getStateCopy();
    const merged = merge(state.agent, {
      context: { components: "per-call" },
    });

    expect(merged?.context).toEqual({
      glossary: "global",
      components: "per-call",
    });
  });
});
