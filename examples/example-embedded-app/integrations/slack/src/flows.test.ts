import { messageFromPayload } from "./flows";
import { accessToken, listChannels, postMessage } from "./slack";

const connection = {
  key: "slack",
  configVarKey: "slack",
  fields: {},
  token: { access_token: "xoxb-test" },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(...bodies: unknown[]) {
  const fetch = vi.fn();
  for (const body of bodies) {
    fetch.mockResolvedValueOnce(new Response(JSON.stringify(body), { status: 200 }));
  }
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

describe("messageFromPayload", () => {
  test("posts text as it is, and anything else as JSON", () => {
    expect(messageFromPayload({ text: "Deal won" })).toBe("Deal won");
    expect(messageFromPayload({ deal: 1 })).toContain('"deal": 1');
  });
});

describe("Slack API", () => {
  test("accessToken requires an OAuth token", () => {
    expect(accessToken(connection)).toBe("xoxb-test");
    expect(() => accessToken(undefined)).toThrow(/Connect Slack/);
  });

  test("listChannels follows the cursor and sorts by name", async () => {
    const fetch = stubFetch(
      {
        ok: true,
        channels: [{ id: "C2", name: "sales", is_private: false }],
        response_metadata: { next_cursor: "next" },
      },
      { ok: true, channels: [{ id: "C1", name: "acme", is_private: true }] },
    );

    expect(await listChannels("xoxb-test")).toEqual([
      { id: "C1", name: "acme", isPrivate: true },
      { id: "C2", name: "sales", isPrivate: false },
    ]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(String(fetch.mock.calls[1]?.[0])).toContain("cursor=next");
  });

  test("postMessage reports Slack's error", async () => {
    stubFetch({ ok: false, error: "not_in_channel" });
    await expect(postMessage("xoxb-test", "C1", "hi")).rejects.toThrow(/not_in_channel/);
  });
});
