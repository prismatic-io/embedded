import { observeState } from "@prismatic-io/solis-core/internal";
import { renderHook, waitFor } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { useSelector } from "./internal/useSelector.js";

test("the first render reads an existing stream's current value before subscribing", async () => {
  let controller!: ReadableStreamDefaultController<{ revision: number }>;
  const cancel = vi.fn();
  const target = {
    state: () =>
      new ReadableStream<{ revision: number }>({
        start(next) {
          controller = next;
        },
        cancel,
      }),
  };
  const shared = observeState(target);
  const off = shared.subscribe(() => {});
  controller.enqueue({ revision: 1 });
  await waitFor(() => expect(shared.latest?.revision).toBe(1));
  controller.enqueue({ revision: 2 });
  await waitFor(() => expect(shared.latest?.revision).toBe(2));
  const renders: unknown[] = [];
  const view = renderHook(() => {
    const selected = useSelector(target);
    renders.push(selected);
    return selected;
  });
  expect(renders[0]).toMatchObject({ status: "ready", value: { revision: 2 } });
  view.unmount();
  off();
  await waitFor(() => expect(cancel).toHaveBeenCalledOnce());
});
