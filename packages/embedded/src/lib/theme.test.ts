// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import stateService from "../state";
import type { ThemeOption } from "../types/theme";
import { dispose } from "./dispose";
import { init } from "./init";
import { showMarketplace } from "./showMarketplace";

const renderMarketplace = (theme?: ThemeOption) => {
  document.body.insertAdjacentHTML("beforeend", '<div id="marketplace"></div>');
  const state = stateService.getStateCopy();
  stateService.setState({ ...state, jwt: "signed-token" });
  showMarketplace({ selector: "#marketplace", ...(theme ? { theme } : {}) });
  const iframe = document.querySelector<HTMLIFrameElement>(
    "#marketplace > iframe",
  );
  return new URL(iframe?.src ?? "").searchParams;
};

afterEach(() => {
  dispose();
  document.body.innerHTML = "";
});

describe("embedded theme", () => {
  it("renders light by default", () => {
    init();
    expect(renderMarketplace().get("theme")).toBe("LIGHT");
  });

  it("sends no theme for AUTO, so each user's appearance setting applies", () => {
    init({ theme: "AUTO" });
    expect(renderMarketplace().has("theme")).toBe(false);
  });

  it("lets a screen choose AUTO over the init theme", () => {
    init({ theme: "DARK" });
    expect(renderMarketplace("AUTO").has("theme")).toBe(false);
  });

  it("lets a screen override AUTO with a fixed theme", () => {
    init({ theme: "AUTO" });
    expect(renderMarketplace("DARK").get("theme")).toBe("DARK");
  });
});
