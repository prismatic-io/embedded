import { expect, test, vi } from "vitest";
import { watchConnect } from "./connect.js";
import type { ConnectionState } from "./protocol/index.js";

test("a return during consent navigation is reread once the first state supplies its id", async () => {
  let controller!: ReadableStreamDefaultController<ConnectionState>;
  const pending = { id: "connection", status: "PENDING" } as ConnectionState;
  const active = { ...pending, status: "ACTIVE" } as ConnectionState;
  const stream = new ReadableStream<ConnectionState>({
    start(next) {
      controller = next;
    },
  });
  const reread = vi.fn(() => {
    controller.enqueue(active);
  });
  const close = vi.fn();
  const connecting = watchConnect({
    stub: { state: () => stream },
    input: { timeoutMs: 500 },
    authorize: async () => ({
      status: "success",
      data: { url: "https://provider.example.test/consent" },
    }),
    consent: {
      navigate: async () => {
        window.dispatchEvent(new Event("focus"));
        controller.enqueue(pending);
        return true;
      },
      isClosed: () => false,
      close,
    },
    reread,
  });
  await expect(connecting).resolves.toMatchObject({
    status: "success",
    data: { status: "ACTIVE" },
  });
  expect(reread).toHaveBeenCalledExactlyOnceWith("connection");
  expect(close).toHaveBeenCalledOnce();
  window.dispatchEvent(new Event("focus"));
  expect(reread).toHaveBeenCalledOnce();
});
