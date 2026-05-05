// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  EMBEDDED_ID,
  EMBEDDED_IFRAME_PRELOAD_ID,
  EMBEDDED_STYLE_ID,
} from "../utils/iframe";
import { dispose } from "./dispose";
import { init } from "./init";

const captureKeyupSignal = (): AbortSignal | undefined => {
  const spy = vi.spyOn(document, "addEventListener");
  init();
  const keyupCall = spy.mock.calls.find(([type]) => type === "keyup");
  spy.mockRestore();
  return (keyupCall?.[2] as AddEventListenerOptions | undefined)?.signal;
};

afterEach(() => {
  dispose();
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("dispose", () => {
  it("removes every node and aborts every listener init added", () => {
    const headBefore = document.head.innerHTML;
    const bodyBefore = document.body.innerHTML;

    const signal = captureKeyupSignal();

    expect(document.getElementById(EMBEDDED_ID)).not.toBeNull();
    expect(document.getElementById(EMBEDDED_IFRAME_PRELOAD_ID)).not.toBeNull();
    expect(document.getElementById(EMBEDDED_STYLE_ID)).not.toBeNull();
    expect(signal?.aborted).toBe(false);

    dispose();

    expect(signal?.aborted).toBe(true);
    expect(document.head.innerHTML).toBe(headBefore);
    expect(document.body.innerHTML).toBe(bodyBefore);
  });

  it("resets in-memory state so initComplete flips back to false", async () => {
    const { default: stateService } = await import("../state");

    init();
    expect(stateService.getStateCopy().initComplete).toBe(true);

    dispose();
    expect(stateService.getStateCopy().initComplete).toBe(false);
  });

  it("is a no-op when called before init", () => {
    const headBefore = document.head.innerHTML;
    const bodyBefore = document.body.innerHTML;

    expect(() => dispose()).not.toThrow();
    expect(document.head.innerHTML).toBe(headBefore);
    expect(document.body.innerHTML).toBe(bodyBefore);
  });

  it("supports init → dispose → init → dispose cycles cleanly", () => {
    const headBefore = document.head.innerHTML;
    const bodyBefore = document.body.innerHTML;

    init();
    dispose();
    init();
    dispose();

    expect(document.head.innerHTML).toBe(headBefore);
    expect(document.body.innerHTML).toBe(bodyBefore);
    expect(document.querySelectorAll(`#${EMBEDDED_ID}`)).toHaveLength(0);
    expect(
      document.querySelectorAll(`#${EMBEDDED_IFRAME_PRELOAD_ID}`),
    ).toHaveLength(0);
    expect(document.querySelectorAll(`#${EMBEDDED_STYLE_ID}`)).toHaveLength(0);
  });

  it("is idempotent when called many times in a row", () => {
    const headBefore = document.head.innerHTML;
    const bodyBefore = document.body.innerHTML;

    const signal = captureKeyupSignal();

    expect(() => {
      for (let i = 0; i < 5; i += 1) {
        dispose();
      }
    }).not.toThrow();

    expect(signal?.aborted).toBe(true);
    expect(document.head.innerHTML).toBe(headBefore);
    expect(document.body.innerHTML).toBe(bodyBefore);
  });

  it("issues a fresh AbortController per init so prior dispose can't cancel later listeners", () => {
    const firstSignal = captureKeyupSignal();
    dispose();
    expect(firstSignal?.aborted).toBe(true);

    const secondSignal = captureKeyupSignal();
    expect(secondSignal).not.toBe(firstSignal);
    expect(secondSignal?.aborted).toBe(false);
  });
});
