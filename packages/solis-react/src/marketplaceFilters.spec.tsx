import type { MarketplaceFilterOptions } from "@prismatic-io/solis-core/protocol";
import { type Client, createClient } from "@prismatic-io/solis-core";
import {
  type FakeFrame,
  FakePrismaticApi,
  fakeIntegrationState,
  installFakeFrame,
} from "@prismatic-io/solis-core/testing";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";
import {
  type MarketplaceFilterOptionsResource,
  useMarketplaceFilterOptions,
} from "./domain/useMarketplaceFilters.js";
import { PrismaticProvider } from "./PrismaticProvider.js";

const origin = "https://app.example.com";

const fieldOf =
  (field: keyof MarketplaceFilterOptions) =>
  (options: MarketplaceFilterOptionsResource) => ({
    status: options.status,
    data: options.status === "success" ? options.data[field] : undefined,
    error: options.status === "error" ? options.error : undefined,
    refresh: options.actions.refresh.execute,
  });
const categoriesOf = fieldOf("categories");
const labelsOf = fieldOf("labels");
let frame: FakeFrame;
let client: Client;
let token = "alice:t1";

afterEach(() => {
  cleanup();
  client?.dispose();
  frame?.restore();
  vi.restoreAllMocks();
  token = "alice:t1";
});

const boot = async () => {
  frame = installFakeFrame({
    origin,
    integrations: [
      fakeIntegrationState({ id: "i-1", category: "CRM", labels: ["support"] }),
      fakeIntegrationState({
        id: "i-2",
        category: "CRM",
        labels: ["finance", "support"],
      }),
    ],
  });
  client = await createClient({ prismaticUrl: origin, jwt: token });
};

const Wrapper = ({ children }: { children: ReactNode }) => (
  <PrismaticProvider client={client} auth={{ token }} resourceIdleMs={0}>
    {children}
  </PrismaticProvider>
);

test("shares one filter-options read across readers without acquiring listing streams", async () => {
  await boot();
  const calls: string[] = [];
  const unsubscribe = client.telemetry.subscribe((event) => {
    if (event.kind === "call") calls.push(event.label);
  });
  const { result } = renderHook(
    () => ({
      options: useMarketplaceFilterOptions(),
      otherOptions: useMarketplaceFilterOptions(),
    }),
    { wrapper: Wrapper },
  );

  await waitFor(() => expect(result.current.options.status).toBe("success"));
  const { options, otherOptions } = result.current;
  if (options.status !== "success" || otherOptions.status !== "success")
    throw new Error("filter options did not load");
  expect(options.data).toEqual({
    categories: ["CRM"],
    labels: ["finance", "support"],
  });
  expect(otherOptions.data).toBe(options.data);
  expect(
    calls.filter((label) => label.includes("api.marketplace.filterOptions(")),
  ).toHaveLength(1);
  expect(calls.some((label) => label.includes("api.marketplace.list("))).toBe(
    false,
  );
  expect(frame.openStreams()).toBe(0);
  unsubscribe();
});

test("refreshes options and reloads them for a new session token", async () => {
  await boot();
  const { result, rerender } = renderHook(
    () => categoriesOf(useMarketplaceFilterOptions()),
    { wrapper: Wrapper },
  );
  await waitFor(() => expect(result.current.data).toEqual(["CRM"]));
  frame.integrations.set(
    fakeIntegrationState({ id: "i-3", category: "Accounting" }),
  );
  await act(async () => {
    await result.current.refresh();
  });
  await waitFor(() =>
    expect(result.current.data).toEqual(["Accounting", "CRM"]),
  );

  frame.integrations.set(
    fakeIntegrationState({ id: "i-4", category: "Sales" }),
  );
  token = "bob:t1";
  rerender();
  await waitFor(() =>
    expect(result.current.data).toEqual(["Accounting", "CRM", "Sales"]),
  );
});

test("reports errors and recovers through refresh, including empty lists", async () => {
  await boot();
  const marketplacePrototype: FakePrismaticApi["marketplace"] =
    Object.getPrototypeOf(new FakePrismaticApi().marketplace);
  vi.spyOn(marketplacePrototype, "filterOptions")
    .mockRejectedValueOnce(new Error("Options unavailable"))
    .mockResolvedValue({ categories: [], labels: [] });
  const { result } = renderHook(() => labelsOf(useMarketplaceFilterOptions()), {
    wrapper: Wrapper,
  });
  await waitFor(() => expect(result.current.status).toBe("error"));
  expect(result.current.error?.message).toContain("Options unavailable");
  await act(async () => {
    await result.current.refresh();
  });
  await waitFor(() => expect(result.current.status).toBe("success"));
  expect(result.current.data).toEqual([]);
});

test("does not let an old session's in-flight options overwrite the new session", async () => {
  await boot();
  let resolveOld!: (value: MarketplaceFilterOptions) => void;
  const delayed = new Promise<MarketplaceFilterOptions>((resolve) => {
    resolveOld = resolve;
  });
  const marketplacePrototype: FakePrismaticApi["marketplace"] =
    Object.getPrototypeOf(new FakePrismaticApi().marketplace);
  const filterOptions = vi
    .spyOn(marketplacePrototype, "filterOptions")
    .mockReturnValueOnce(delayed)
    .mockResolvedValue({ categories: ["New session"], labels: [] });
  const { result, rerender, unmount } = renderHook(
    () => categoriesOf(useMarketplaceFilterOptions()),
    { wrapper: Wrapper },
  );
  await waitFor(() => expect(filterOptions).toHaveBeenCalledTimes(1));
  expect(result.current.status).toBe("loading");
  token = "bob:t1";
  rerender();
  await waitFor(() => expect(result.current.data).toEqual(["New session"]));
  await act(async () => {
    resolveOld({ categories: ["Old session"], labels: [] });
  });
  expect(result.current.data).toEqual(["New session"]);
  unmount();
  expect(frame.openStreams()).toBe(0);
});
