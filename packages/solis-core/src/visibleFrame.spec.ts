// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  openVisibleFrame,
  VISIBLE_PORT_CLOSE_EVENT,
  VISIBLE_PORT_EMBEDDED_EVENT,
  VISIBLE_PORT_READY_EVENT,
  VISIBLE_PORT_RECONCILE_ERROR,
  VISIBLE_PORT_RESOURCES_CHANGED,
} from "./visibleFrame.js";

const origin = "https://app.example.com";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

const emit = ({
  source,
  data,
  eventOrigin = origin,
}: {
  source: MessageEventSource | null;
  data: unknown;
  eventOrigin?: string;
}) =>
  window.dispatchEvent(
    new MessageEvent("message", { source, origin: eventOrigin, data }),
  );

it("waits for the visible port to reach the hidden frame before resolving", async () => {
  const hidden = document.createElement("iframe");
  document.body.append(hidden);
  if (!hidden.contentWindow) throw new Error("Hidden iframe did not mount");
  const hiddenPost = vi.spyOn(hidden.contentWindow, "postMessage");
  const container = document.createElement("div");
  document.body.append(container);
  const pending = openVisibleFrame(
    { url: "/find-integration-marketplace/?instanceId=one", container },
    hidden,
    origin,
    () => false,
    new AbortController().signal,
  );
  const visible = container.querySelector("iframe");
  if (!visible?.contentWindow) throw new Error("Visible iframe did not mount");
  const visiblePost = vi.spyOn(visible.contentWindow, "postMessage");
  expect(new URL(visible.src).searchParams.get("embed")).toBe("true");
  expect(hiddenPost).toHaveBeenCalledWith(
    expect.objectContaining({ type: "PRISMATIC_HEADLESS_VISIBLE_PORT" }),
    origin,
    expect.any(Array),
  );
  const id = hiddenPost.mock.calls[0]?.[0].id as string | undefined;
  if (!id) throw new Error("Hidden iframe did not receive a port");

  emit({ source: null, data: { event: "PRISMATIC_HOST_READY" } });
  emit({
    source: visible.contentWindow,
    eventOrigin: "https://other.example",
    data: { event: "PRISMATIC_HOST_READY" },
  });
  expect(visiblePost).not.toHaveBeenCalled();
  emit({
    source: visible.contentWindow,
    data: { event: "PRISMATIC_HOST_READY" },
  });
  expect(visiblePost).toHaveBeenCalledWith(
    { event: "PRISMATIC_HOST_PORT" },
    origin,
    expect.any(Array),
  );

  emit({
    source: hidden.contentWindow,
    data: { type: VISIBLE_PORT_READY_EVENT, id: "wrong" },
  });
  const settled = vi.fn();
  void pending.then(settled);
  await Promise.resolve();
  expect(settled).not.toHaveBeenCalled();
  emit({
    source: hidden.contentWindow,
    data: { type: VISIBLE_PORT_READY_EVENT, id },
  });
  const mount = await pending;
  expect(mount.iframe).toBe(visible);
  mount.dispose();
  expect(container.childElementCount).toBe(0);
});

it("delivers opaque messages from only the mounted frame, independently of resource changes", async () => {
  const hidden = document.createElement("iframe");
  const other = document.createElement("iframe");
  document.body.append(hidden, other);
  const container = document.createElement("div");
  document.body.append(container);
  const onEmbeddedEvent = vi.fn();
  const onResourcesChanged = vi.fn();
  const onError = vi.fn();
  if (!hidden.contentWindow) throw new Error("Hidden frame did not mount");
  const post = vi.spyOn(hidden.contentWindow, "postMessage");
  const pending = openVisibleFrame(
    {
      url: "/find-integration-marketplace/",
      container,
      onEmbeddedEvent,
      onResourcesChanged,
      onError,
    },
    hidden,
    origin,
    () => false,
    new AbortController().signal,
  );
  const visible = container.querySelector("iframe");
  if (!visible?.contentWindow || !hidden.contentWindow)
    throw new Error("Frames did not mount");
  const id = post.mock.calls[0]?.[0].id as string;
  emit({
    source: visible.contentWindow,
    data: { event: "PRISMATIC_HOST_READY" },
  });
  const event = {
    type: VISIBLE_PORT_EMBEDDED_EVENT,
    id,
    data: { futureEvent: true, payload: ["uninterpreted"] },
  };
  emit({ source: other.contentWindow, data: event });
  emit({
    source: hidden.contentWindow,
    data: event,
    eventOrigin: "https://wrong.test",
  });
  emit({ source: hidden.contentWindow, data: event });
  expect(onEmbeddedEvent).not.toHaveBeenCalled();
  emit({
    source: hidden.contentWindow,
    data: { type: VISIBLE_PORT_READY_EVENT, id },
  });
  const mount = await pending;
  emit({ source: hidden.contentWindow, data: event });
  expect(onEmbeddedEvent).toHaveBeenCalledExactlyOnceWith(event.data);
  expect(onResourcesChanged).not.toHaveBeenCalled();
  emit({
    source: hidden.contentWindow,
    data: { type: VISIBLE_PORT_EMBEDDED_EVENT, id, data: "opaque" },
  });
  expect(onEmbeddedEvent).toHaveBeenLastCalledWith("opaque");
  emit({
    source: hidden.contentWindow,
    data: { type: VISIBLE_PORT_RESOURCES_CHANGED, id },
  });
  expect(onResourcesChanged).toHaveBeenCalledOnce();
  emit({
    source: hidden.contentWindow,
    data: { type: VISIBLE_PORT_RECONCILE_ERROR, id, message: "refresh failed" },
  });
  expect(onError).toHaveBeenCalledWith(
    expect.objectContaining({ message: "refresh failed" }),
  );
  mount.dispose();
  emit({ source: hidden.contentWindow, data: event });
  expect(onEmbeddedEvent).toHaveBeenCalledTimes(2);
});

const mountFrames = () => {
  const hidden = document.createElement("iframe");
  const container = document.createElement("div");
  document.body.append(hidden, container);
  if (!hidden.contentWindow) throw new Error("Hidden frame did not mount");
  const post = vi.spyOn(hidden.contentWindow, "postMessage");
  return { hidden, container, post };
};

it("removes itself and reports the close when the frame closes an open mount", async () => {
  const { hidden, container, post } = mountFrames();
  const onClose = vi.fn();
  const pending = openVisibleFrame(
    { url: "/configure-instance/one/", container, onClose },
    hidden,
    origin,
    () => false,
    new AbortController().signal,
  );
  const visible = container.querySelector("iframe");
  const id = post.mock.calls[0]?.[0].id as string;
  emit({
    source: visible?.contentWindow ?? null,
    data: { event: "PRISMATIC_HOST_READY" },
  });
  emit({
    source: hidden.contentWindow,
    data: { type: VISIBLE_PORT_READY_EVENT, id },
  });
  const mount = await pending;
  emit({
    source: hidden.contentWindow,
    data: { type: VISIBLE_PORT_CLOSE_EVENT, id: "another mount" },
  });
  expect(onClose).not.toHaveBeenCalled();
  emit({
    source: hidden.contentWindow,
    data: { type: VISIBLE_PORT_CLOSE_EVENT, id },
  });
  expect(onClose).toHaveBeenCalledOnce();
  expect(container.childElementCount).toBe(0);
  mount.dispose();
  expect(onClose).toHaveBeenCalledOnce();
});

it("disposes when the caller aborts, while opening or before it starts", async () => {
  const { hidden, container } = mountFrames();
  const controller = new AbortController();
  const pending = openVisibleFrame(
    { url: "/configure-instance/one/", container, signal: controller.signal },
    hidden,
    origin,
    () => false,
    new AbortController().signal,
  );
  expect(container.childElementCount).toBe(1);
  controller.abort();
  expect(container.childElementCount).toBe(0);
  await expect(pending).rejects.toThrow("Visible frame was disposed");

  await expect(
    openVisibleFrame(
      { url: "/configure-instance/one/", container, signal: controller.signal },
      hidden,
      origin,
      () => false,
      new AbortController().signal,
    ),
  ).rejects.toThrow("Visible frame was disposed");
  expect(container.childElementCount).toBe(0);
});
