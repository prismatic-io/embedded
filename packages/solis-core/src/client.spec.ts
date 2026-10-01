import packageInfo from "../package.json" with { type: "json" };
import {
  type FakeFrame,
  fakeInstanceState,
  fakeIntegrationState,
  installFakeFrame,
} from "./testing/index.js";
import { afterEach, expect, test, vi } from "vitest";
import { type AuthedHandle, type Client, createClient } from "./index.js";
import { disposeAll, disposeQuietly, observeState } from "./internal.js";

const APP_ORIGIN = "https://app.example.com";

let frame: FakeFrame | undefined;
let client: Client | undefined;

afterEach(() => {
  client?.dispose();
  client = undefined;
  frame?.restore();
  frame = undefined;
});

const connect = async (jwt = "ident:tok-1"): Promise<Client> => {
  client = await createClient({ prismaticUrl: APP_ORIGIN, jwt });
  return client;
};

const authed = (c: Client): AuthedHandle => {
  const handle = c.authenticated;
  if (!handle)
    throw new Error("client was created with a jwt but is not authenticated");
  return handle;
};

test("the host handshake identifies the installed SDK package and nonsecret context", async () => {
  const onHandshake = vi.fn();
  frame = installFakeFrame({ origin: APP_ORIGIN, onHandshake });
  client = await createClient({
    prismaticUrl: APP_ORIGIN,
    clientMeta: { surface: "hybrid", iteration: 2 },
  });
  expect(onHandshake).toHaveBeenCalledExactlyOnceWith({
    packageName: packageInfo.name,
    packageVersion: packageInfo.version,
    meta: { surface: "hybrid", iteration: 2 },
  });
});

test("openVisibleFrame routes opaque messages only from its mounted iframe", async () => {
  frame = installFakeFrame({
    origin: APP_ORIGIN,
    integrations: [fakeIntegrationState({ id: "integration-one" })],
    instances: [
      fakeInstanceState({
        id: "instance one",
        integrationId: "integration-one",
        deployed: true,
      }),
    ],
    configurations: {
      "integration-one": { schema: { type: "object" } },
    },
  });
  const c = await connect();
  const container = document.createElement("div");
  document.body.append(container);
  const hidden = document.querySelector('iframe[title="Embedded session"]');
  if (!(hidden instanceof HTMLIFrameElement) || !hidden.contentWindow)
    throw new Error("Hidden frame missing");
  const post = vi.spyOn(hidden.contentWindow, "postMessage");
  const onEmbeddedEvent = vi.fn();
  const onResourcesChanged = vi.fn();
  const pending = c.openVisibleFrame({
    url: "/configure-instance/instance%20one/?reconfigure=true",
    container,
    onEmbeddedEvent,
    onResourcesChanged,
  });
  await vi.waitFor(() => {
    expect(container.querySelector("iframe")).not.toBeNull();
  });
  const visible = container.querySelector("iframe");
  if (!visible?.contentWindow) throw new Error("Visible frame missing");
  expect(new URL(visible.src).pathname).toBe(
    "/configure-instance/instance%20one/",
  );
  expect(new URL(visible.src).searchParams.get("reconfigure")).toBe("true");
  expect(visible.title).toBe("Embedded content");
  expect(visible.style.width).toBe("100%");
  expect(visible.style.height).toBe("100%");
  expect(visible.style.border).toBe("0px");
  expect(visible.allow).toBe("clipboard-read; clipboard-write");
  const id = post.mock.calls.find(
    ([message]) => message.type === "PRISMATIC_HEADLESS_VISIBLE_PORT",
  )?.[0].id;
  if (!id) throw new Error("Visible port not transferred");
  expect(
    post.mock.calls.find(
      ([message]) => message.type === "PRISMATIC_HEADLESS_VISIBLE_PORT",
    )?.[0].path,
  ).toBe("/configure-instance/instance%20one/");
  window.dispatchEvent(
    new MessageEvent("message", {
      origin: APP_ORIGIN,
      source: visible.contentWindow,
      data: { event: "PRISMATIC_HOST_READY" },
    }),
  );
  window.dispatchEvent(
    new MessageEvent("message", {
      origin: APP_ORIGIN,
      source: hidden.contentWindow,
      data: { type: "PRISMATIC_HEADLESS_VISIBLE_READY", id },
    }),
  );
  const mount = await pending;
  const emit = (idToEmit: string, data: unknown) =>
    window.dispatchEvent(
      new MessageEvent("message", {
        origin: APP_ORIGIN,
        source: hidden.contentWindow,
        data: {
          type: "PRISMATIC_HEADLESS_EMBEDDED_EVENT",
          id: idToEmit,
          data,
        },
      }),
    );
  emit("another mount", { event: "INSTANCE_DEPLOYED" });
  emit(id, { futureEvent: true });
  emit(id, "opaque");
  expect(onEmbeddedEvent.mock.calls.map(([message]) => message)).toEqual([
    { futureEvent: true },
    "opaque",
  ]);
  window.dispatchEvent(
    new MessageEvent("message", {
      origin: APP_ORIGIN,
      source: hidden.contentWindow,
      data: { type: "PRISMATIC_HEADLESS_RESOURCES_CHANGED", id },
    }),
  );
  expect(onResourcesChanged).toHaveBeenCalledOnce();
  mount.dispose();
  emit(id, { afterDispose: true });
  expect(onEmbeddedEvent).toHaveBeenCalledTimes(2);
  container.remove();
});

/** A stub is a Proxy around a function, so a `typeof value === "object"` guard skips it. */
test("disposeQuietly releases a stub, which is typeof function", async () => {
  frame = installFakeFrame({
    origin: APP_ORIGIN,
    integrations: [fakeIntegrationState({ id: "i-1" })],
  });
  const c = await connect();

  const page = await authed(c).marketplace.list({});
  const row = page.integrations[0];
  if (!row) throw new Error("fixture seeded no integration");
  expect(typeof row).toBe("function");

  const held = c.stats().imports;
  disposeQuietly(row);
  expect(c.stats().imports).toBe(held - 1);
});

test("disposeQuietly ignores non-disposables without throwing", () => {
  for (const value of [null, undefined, 3, "s", { a: 1 }, () => {}]) {
    expect(() => disposeQuietly(value)).not.toThrow();
  }
});

/** Rows of a paged result each hold their own import; the `{ integrations, pageInfo }`
 * record wrapping them is plain data and holds none. */
test("disposeAll on a page's rows releases every row", async () => {
  frame = installFakeFrame({
    origin: APP_ORIGIN,
    integrations: [
      fakeIntegrationState({ id: "i-1" }),
      fakeIntegrationState({ id: "i-2" }),
    ],
  });
  const c = await connect();

  const before = c.stats().imports;
  const page = await authed(c).marketplace.list({});
  expect(c.stats().imports).toBe(before + 2);

  disposeAll(page.integrations);
  expect(c.stats().imports).toBe(before);
});

test("observeState returns a stable identity before any subscribe", async () => {
  frame = installFakeFrame({
    origin: APP_ORIGIN,
    integrations: [fakeIntegrationState({ id: "i-1" })],
  });
  const c = await connect();

  const page = await authed(c).marketplace.list({});
  const row = page.integrations[0];
  if (!row) throw new Error("fixture seeded no integration");

  expect(observeState(row)).toBe(observeState(row));
  disposeQuietly(page);
});

test("authenticate does not grow the import table across token rotations", async () => {
  frame = installFakeFrame({ origin: APP_ORIGIN });
  const c = await connect();

  await authed(c).getAuthenticatedUser();
  const held = c.stats().imports;

  for (let rotation = 2; rotation <= 5; rotation += 1) {
    const handle = c.authenticate(`ident:tok-${rotation}`);
    await handle.getAuthenticatedUser();
    expect(c.stats().imports).toBe(held);
  }
});
