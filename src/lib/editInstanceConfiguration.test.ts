// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import stateService from "../state";
import { EMBEDDED_IFRAME_ID } from "../utils/iframe";
import { dispose } from "./dispose";
import { editInstanceConfiguration } from "./editInstanceConfiguration";
import { init } from "./init";

const SELECTOR = "#config";
const INSTANCE_ID = "SW5zdGFuY2U6MQ==";

const openWith = (userLevelConfigured?: boolean) => {
  init({ prismaticUrl: "https://app.example.com" });

  // Stand in for authenticate(), which these assertions do not exercise.
  const state = stateService.getStateCopy();
  state.jwt = "test-jwt";
  stateService.setState(state);

  document.body.innerHTML = `<div id="${SELECTOR.slice(1)}"></div>`;

  editInstanceConfiguration({
    instanceId: INSTANCE_ID,
    selector: SELECTOR,
    ...(userLevelConfigured === undefined ? {} : { userLevelConfigured }),
  });

  const iframe = document.getElementById(
    EMBEDDED_IFRAME_ID,
  ) as HTMLIFrameElement | null;

  return new URL(iframe?.src ?? "").searchParams;
};

afterEach(() => {
  dispose();
  document.head.innerHTML = "";
  document.body.innerHTML = "";
});

describe("editInstanceConfiguration", () => {
  it("always suppresses the instance picker", () => {
    expect(openWith().get("reconfigure")).toBe("true");
  });

  it("asks for the person's own configuration when userLevelConfigured is set", () => {
    expect(openWith(true).get("userLevelConfigured")).toBe("true");
  });

  it("leaves the configuration unspecified otherwise, so the app decides", () => {
    expect(openWith().get("userLevelConfigured")).toBeNull();
    expect(openWith(false).get("userLevelConfigured")).toBeNull();
  });
});
