// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ConfigVars } from "../types/configVars";
import { PrismaticMessageEvent } from "../types/postMessage";
import { setConfigVars } from "./setConfigVars";

const rows = [
  { key: "email", value: "Email" },
  { key: "last_name", value: "LastName" },
];

const createIframe = () => {
  document.body.innerHTML = `<div id="config"><iframe></iframe></div>`;
  const iframe = document.querySelector("iframe") as HTMLIFrameElement;
  const postMessage = vi.spyOn(iframe.contentWindow as Window, "postMessage");

  return { iframe, postMessage };
};

describe("setConfigVars with a field mapping config var", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("posts the field mapping rows unchanged", () => {
    const { iframe, postMessage } = createIframe();
    const configVars: ConfigVars = { "Lead Field Mapping": { value: rows } };

    setConfigVars({ iframe, configVars });

    expect(postMessage).toHaveBeenCalledWith(
      { event: PrismaticMessageEvent.SET_CONFIG_VAR, data: configVars },
      "*",
    );
  });

  it("posts a JSON string of the field mapping rows unchanged", () => {
    const { postMessage } = createIframe();
    const configVars: ConfigVars = {
      "Lead Field Mapping": { value: JSON.stringify(rows) },
    };

    setConfigVars({ selector: "#config", configVars });

    expect(postMessage).toHaveBeenCalledWith(
      { event: PrismaticMessageEvent.SET_CONFIG_VAR, data: configVars },
      "*",
    );
  });
});
