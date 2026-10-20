import type { IntegrationStub } from "@prismatic-io/solis-core";
import type { MarketplaceIntegrationState } from "@prismatic-io/solis-core/protocol";
import { expect, test, vi } from "vitest";
import { ownIntegrationInstances } from "./internal/integrationInstances.js";
import { ResourceCache } from "./internal/resourceCache.js";

test("releasing nested ownership closes its observations without waiting for React to unsubscribe", async () => {
  const cancel = vi.fn();
  const state = { instances: [] } as unknown as MarketplaceIntegrationState;
  const readState = vi.fn(
    () =>
      new ReadableStream({
        start(controller) {
          controller.enqueue(state);
        },
        cancel,
      }),
  );
  const integration = { state: readState } as unknown as IntegrationStub;
  const cache = new ResourceCache(0);
  const owned = await ownIntegrationInstances({
    api: {} as never,
    integration,
    state,
    cache,
    token: "session",
    ownership: {} as never,
  });
  const unsubscribe = owned.value.subscribe(() => {});
  await vi.waitFor(() => expect(readState).toHaveBeenCalledOnce());
  owned.release?.();
  // Releasing the SDK resource, not a subsequent effect cleanup, owns cancellation.
  await vi.waitFor(() => expect(cancel).toHaveBeenCalledOnce());
  const late = owned.value.subscribe(() => {});
  await new Promise((resolve) => setTimeout(resolve, 75));
  expect(readState).toHaveBeenCalledOnce();
  unsubscribe();
  unsubscribe();
  late();
  cache.close();
});
