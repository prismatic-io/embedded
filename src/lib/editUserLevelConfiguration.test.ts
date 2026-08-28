// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import stateService from "../state";
import { PrismaticMessageEvent } from "../types/postMessage";
import { EMBEDDED_IFRAME_ID } from "../utils/iframe";
import { dispose } from "./dispose";
import { editInstanceConfiguration } from "./editInstanceConfiguration";
import { editUserLevelConfiguration } from "./editUserLevelConfiguration";
import { init } from "./init";

const SELECTOR = "#config";
const INSTANCE_ID = "SW5zdGFuY2U6MQ==";

const ready = () => {
  init({ prismaticUrl: "https://app.example.com" });

  // Stand in for authenticate(), which these assertions do not exercise.
  const state = stateService.getStateCopy();
  state.jwt = "test-jwt";
  stateService.setState(state);

  document.body.innerHTML = `<div id="${SELECTOR.slice(1)}"></div>`;
};

const params = () => {
  const iframe = document.getElementById(
    EMBEDDED_IFRAME_ID,
  ) as HTMLIFrameElement | null;

  return new URL(iframe?.src ?? "").searchParams;
};

const emit = (event: PrismaticMessageEvent) =>
  window.dispatchEvent(new MessageEvent("message", { data: { event } }));

afterEach(() => {
  dispose();
  document.head.innerHTML = "";
  document.body.innerHTML = "";
});

describe("editUserLevelConfiguration", () => {
  it("asks for the person's own configuration", () => {
    ready();
    editUserLevelConfiguration({ instanceId: INSTANCE_ID, selector: SELECTOR });

    expect(params().get("userLevelConfigured")).toBe("true");
  });

  it("names the instance so it is not asked for again", () => {
    ready();
    editUserLevelConfiguration({ instanceId: INSTANCE_ID, selector: SELECTOR });

    expect(params().get("reconfigure")).toBe("true");
  });

  it("reports the user level lifecycle rather than the instance one", () => {
    ready();
    const onSuccess = vi.fn();
    editUserLevelConfiguration({
      instanceId: INSTANCE_ID,
      selector: SELECTOR,
      onSuccess,
    });

    emit(PrismaticMessageEvent.INSTANCE_DEPLOYED);
    expect(onSuccess).not.toHaveBeenCalled();

    emit(PrismaticMessageEvent.USER_CONFIGURATION_DEPLOYED);
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it("treats an instance level cancel as its own, there being no other", () => {
    ready();
    const onCancel = vi.fn();
    editUserLevelConfiguration({
      instanceId: INSTANCE_ID,
      selector: SELECTOR,
      onCancel,
    });

    emit(PrismaticMessageEvent.INSTANCE_CONFIGURATION_CANCELED);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("stops listening once the wizard has reported an outcome", () => {
    ready();
    const onSuccess = vi.fn();
    editUserLevelConfiguration({
      instanceId: INSTANCE_ID,
      selector: SELECTOR,
      onSuccess,
    });

    emit(PrismaticMessageEvent.USER_CONFIGURATION_DEPLOYED);
    emit(PrismaticMessageEvent.USER_CONFIGURATION_DEPLOYED);
    expect(onSuccess).toHaveBeenCalledOnce();
  });
});

describe("editInstanceConfiguration", () => {
  it("leaves the configuration unspecified, so the app decides", () => {
    ready();
    editInstanceConfiguration({ instanceId: INSTANCE_ID, selector: SELECTOR });

    expect(params().get("reconfigure")).toBe("true");
    expect(params().get("userLevelConfigured")).toBeNull();
  });
});
