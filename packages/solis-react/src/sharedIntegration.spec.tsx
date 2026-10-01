import type { MarketplaceIntegrationState } from "@prismatic-io/solis-core/protocol";
import {
  type Client,
  createClient,
  type MarketplaceIntegrationResource,
} from "@prismatic-io/solis-core";
import {
  disposeQuietly,
  STATE_RELEASE_GRACE_MS,
} from "@prismatic-io/solis-core/internal";
import {
  type FakeFrame,
  FakePreAuthApi,
  FakePrismaticApi,
  fakeIntegrationState,
  installFakeFrame,
} from "@prismatic-io/solis-core/testing";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { StrictMode, Suspense } from "react";
import { afterEach, expect, test, vi } from "vitest";
import {
  type MarketplaceInput,
  useMarketplace,
} from "./domain/useMarketplace.js";
import { useMarketplaceIntegration } from "./domain/useMarketplaceIntegration.js";
import { keys } from "./internal/keys.js";
import type { ListStore } from "./internal/listStore.js";
import type { IntegrationEntry } from "./internal/loaders.js";
import type { ResourceCache } from "./internal/resourceCache.js";
import {
  PrismaticProvider,
  useResourceCache,
  useSessionRevoked,
  useSessionToken,
} from "./PrismaticProvider.js";

const origin = "https://app.example.com";
const listing = fakeIntegrationState({
  id: "x",
  name: "Original",
  labels: ["shared"],
});
const inputs = {
  a: { label: "shared" },
  b: { search: "Original" },
} satisfies Record<string, MarketplaceInput>;
let frame: FakeFrame;
let client: Client;
let cache: ResourceCache;
let token: string;
let onRevoked: (error: unknown) => void;
const resources = new Map<string, MarketplaceIntegrationResource>();
const lists = new Map<string, ReturnType<typeof useMarketplace>>();

afterEach(() => {
  cleanup();
  client?.dispose();
  frame?.restore();
  resources.clear();
  lists.clear();
  vi.restoreAllMocks();
});

const boot = async () => {
  frame = installFakeFrame({ origin, integrations: [listing] });
  client = await createClient({ prismaticUrl: origin, jwt: "alice:t1" });
};

/** The frame emits an outside change once the session reads it again. */
const reread = async (id: string) => {
  disposeQuietly(await client.authenticated?.marketplace.get(id));
};

const settle = async () => {
  await act(async () => {
    await new Promise((resolve) =>
      setTimeout(resolve, STATE_RELEASE_GRACE_MS * 2),
    );
    await frame.flushStreams();
  });
  const { imports, exports } = client.stats();
  return { imports, exports, streams: frame.openStreams() };
};

const Capture = () => {
  cache = useResourceCache();
  token = useSessionToken();
  onRevoked = useSessionRevoked();
  return null;
};
const List = ({ name }: { name: keyof typeof inputs }) => {
  const result = useMarketplace(inputs[name]);
  lists.set(name, result);
  if (result.status === "success")
    for (const item of result.data.items)
      resources.set(`${name}:${item.id}`, item);
  return null;
};

/** A list holds its own entry plus its refresh and two paging actions. */
const LIST_ENTRIES = 4;
/** An entity is its entry plus the refresh action every reader of it shares. */
const ENTITY_ENTRIES = 2;

const listKey = (name: keyof typeof inputs) => {
  const { search, ...rest } = inputs[name] as MarketplaceInput;
  return `${token}:${keys.marketplace({
    ...rest,
    ...(search === undefined ? {} : { searchTerm: search }),
    pageSize: 25,
    onPageLoad: "append",
  })}`;
};
/** The entries a list holds for its items, as its cache entry has them. */
const entriesOf = (name: keyof typeof inputs) =>
  cache
    .peekSnapshot<ListStore<IntegrationEntry>>(listKey(name))
    ?.value?.getSnapshot().entries ?? [];
/** The stub behind a list item, which a detail read of the same entity shares. */
const stubOf = (name: keyof typeof inputs, index = 0) =>
  entriesOf(name)[index]?.lease.snapshot().value?.stub;
const idsOf = (name: keyof typeof inputs) => {
  const list = lists.get(name);
  return list?.status === "success"
    ? list.data.items.map(({ id }) => id)
    : undefined;
};
const itemOf = (name: keyof typeof inputs, index = 0) => {
  const list = lists.get(name);
  return list?.status === "success" ? list.data.items[index] : undefined;
};
const nameOf = (name: keyof typeof inputs, index = 0) => {
  const item = itemOf(name, index);
  return item?.status === "success" ? item.data.name : undefined;
};
const Detail = () => {
  resources.set("detail", useMarketplaceIntegration(listing.id));
  return null;
};
const Host = ({
  a = false,
  b = false,
  detail = false,
  token = "alice:t1",
}: {
  a?: boolean;
  b?: boolean;
  detail?: boolean;
  token?: string;
}) => (
  <PrismaticProvider client={client} auth={{ token }} resourceIdleMs={0}>
    <Capture />
    {a ? <List name="a" /> : null}
    {b ? <List name="b" /> : null}
    {detail ? <Detail /> : null}
  </PrismaticProvider>
);

const resource = (name: string) => {
  const value = resources.get(name);
  if (!value) throw new Error(`Missing resource ${name}`);
  return value;
};
const success = (name: string) => {
  const value = resource(name);
  if (value.status !== "success") throw new Error(`${name}: ${value.status}`);
  return value;
};
const ready = (...names: string[]) =>
  waitFor(() => {
    for (const name of names) expect(resource(name).status).toBe("success");
  });
const gateStream = () => {
  let controller!: ReadableStreamDefaultController<MarketplaceIntegrationState>;
  const cancel = vi.fn();
  const stream = new ReadableStream<MarketplaceIntegrationState>({
    start: (value) => {
      controller = value;
    },
    cancel,
  });
  const spy = vi
    .spyOn(frame.integrations, "stream")
    .mockReturnValueOnce(stream);
  return {
    spy,
    cancel,
    emit: (state: MarketplaceIntegrationState) => controller.enqueue(state),
    fail: (error: Error) => controller.error(error),
  };
};

test.each([
  "list-first",
  "detail-first",
  "concurrent",
] as const)("%s shares two distinct lists and detail through refresh and final release", async (order) => {
  await boot();
  const view = render(<Host />);
  const baseline = await settle();
  let gets = 0;
  const off = client.telemetry.subscribe((event) => {
    if (event.kind === "call" && event.label.includes("api.marketplace.get("))
      gets++;
  });
  if (order === "list-first") {
    view.rerender(<Host a b />);
    await ready("a:x", "b:x");
    expect(gets).toBe(0);
  } else if (order === "detail-first") {
    view.rerender(<Host detail />);
    await ready("detail");
  }
  view.rerender(<Host a b detail />);
  await ready("a:x", "b:x", "detail");
  expect(gets).toBe(order === "list-first" ? 0 : 1);
  await settle();
  expect(frame.integrations.subscriberCount(listing.id)).toBe(1);
  expect(cache.size).toBe(2 * LIST_ENTRIES + ENTITY_ENTRIES);
  expect(cache.pendingAcquisitions).toBe(0);
  expect(stubOf("a", 0)).toBe(stubOf("b", 0));
  const originalStub = stubOf("a", 0);

  frame.integrations.set({ ...listing, name: "Live" });
  await act(async () => reread(listing.id));
  await waitFor(() => {
    for (const name of ["a:x", "b:x", "detail"])
      expect(success(name).data.name).toBe("Live");
    expect(nameOf("a", 0)).toBe("Live");
    expect(nameOf("b", 0)).toBe("Live");
  });

  const beforeRefresh = gets;
  const gate = gateStream();
  let completions: Promise<unknown>[] = [];
  act(() => {
    completions = ["a:x", "b:x", "detail"].map((name) =>
      resource(name).actions.refresh.execute(),
    );
  });
  await waitFor(() => expect(gate.spy).toHaveBeenCalled());
  for (const name of ["a:x", "b:x", "detail"]) {
    expect(success(name)).toMatchObject({
      isRefreshing: true,
      data: { name: "Live" },
    });
    expect(resource(name).actions.refresh.status).toBe("loading");
  }
  expect(lists.get("a")).toMatchObject({ isRefreshing: false });
  const busy = { status: "error", error: { code: "PRISMATIC_ACTION_BUSY" } };
  await act(async () => {
    gate.emit({ ...listing, name: "Replacement" });
    expect(await completions[0]).toEqual({
      status: "success",
      data: undefined,
    });
    expect(await completions[1]).toMatchObject(busy);
    expect(await completions[2]).toMatchObject(busy);
  });
  expect(gets).toBe(beforeRefresh + 1);
  for (const name of ["a:x", "b:x", "detail"])
    expect(success(name)).toMatchObject({
      isRefreshing: false,
      data: { name: "Replacement" },
    });
  expect(stubOf("a", 0)).not.toBe(originalStub);
  expect(stubOf("a", 0)).toBe(stubOf("b", 0));
  expect(nameOf("a", 0)).toBe("Replacement");

  view.rerender(<Host b detail />);
  await settle();
  expect(success("detail").data.name).toBe("Replacement");
  view.rerender(<Host detail />);
  await settle();
  expect(cache.size).toBe(2);
  await act(async () => gate.emit({ ...listing, name: "Detail survives" }));
  await waitFor(() =>
    expect(success("detail").data.name).toBe("Detail survives"),
  );
  view.rerender(<Host />);
  await settle();
  gate.emit(listing);
  await waitFor(() => expect(gate.cancel).toHaveBeenCalledTimes(1));
  expect(await settle()).toEqual(baseline);
  expect(cache.size).toBe(0);
  off();
});

test("an adopted list target outlives its wire containers while detail owns it", async () => {
  await boot();
  const view = render(<Host />);
  const baseline = await settle();
  view.rerender(<Host a b />);
  await ready("a:x", "b:x");
  view.rerender(<Host a b detail />);
  await ready("detail");
  view.rerender(<Host detail />);
  await settle();
  expect(cache.size).toBe(2);
  frame.integrations.set({ ...listing, name: "Still live" });
  await act(async () => reread(listing.id));
  await waitFor(() => expect(success("detail").data.name).toBe("Still live"));
  expect(frame.integrations.subscriberCount(listing.id)).toBe(1);
  view.rerender(<Host />);
  expect(await settle()).toEqual(baseline);
});

test("same-scope token rotation reuses adopted entities and keeps their refresh loader live", async () => {
  await boot();
  const view = render(<Host a b />);
  await ready("a:x", "b:x");
  const stub = stubOf("a", 0);
  const before = await settle();
  view.rerender(<Host a b token="alice:t2" />);
  await settle();
  expect(stubOf("a", 0)).toBe(stub);
  expect(await settle()).toEqual(before);
  await act(async () => {
    await resource("a:x").actions.refresh.execute();
  });
  await ready("a:x", "b:x");
  expect(stubOf("a", 0)).not.toBe(stub);
});

test("entity refresh shares failure and retry while list refresh only changes membership", async () => {
  await boot();
  const view = render(<Host a b detail />);
  await ready("a:x", "b:x", "detail");
  const before = success("detail").data;
  const gate = gateStream();
  let first!: Promise<unknown>;
  let second!: Promise<unknown>;
  act(() => {
    first = resource("a:x").actions.refresh.execute();
    second = resource("detail").actions.refresh.execute();
  });
  await waitFor(() => expect(gate.spy).toHaveBeenCalled());
  const failed = { status: "error", error: { code: "PRISMATIC_UNKNOWN" } };
  await act(async () => {
    gate.fail(new Error("offline"));
    expect(await first).toMatchObject(failed);
    expect(await second).toMatchObject({
      status: "error",
      error: { code: "PRISMATIC_ACTION_BUSY" },
    });
  });
  for (const name of ["a:x", "b:x", "detail"]) {
    expect(success(name).data).toEqual(before);
    expect(success(name).isRefreshing).toBe(false);
    expect(resource(name).actions.refresh).toMatchObject(failed);
  }
  await act(async () => {
    await resource("b:x").actions.refresh.execute();
  });
  const refreshed = stubOf("a", 0);
  frame.integrations.set(
    fakeIntegrationState({ id: "y", name: "Other", labels: ["shared"] }),
  );
  await act(async () => {
    await lists.get("a")?.actions.refresh.execute();
  });
  await ready("a:y");
  expect(idsOf("a")).toEqual(["x", "y"]);
  expect(idsOf("b")).toEqual(["x"]);
  expect(stubOf("a", 0)).toBe(refreshed);
  expect(stubOf("b", 0)).toBe(refreshed);
  view.unmount();
});

test("overlapping lists preserve wire order and reject delayed older duplicate state", async () => {
  await boot();
  frame.integrations.set(
    fakeIntegrationState({ id: "y", name: "Second", labels: ["shared"] }),
  );
  frame.integrations.set(
    fakeIntegrationState({ id: "z", name: "Original third" }),
  );
  const view = render(<Host />);
  const baseline = await settle();
  const older = gateStream();
  view.rerender(<Host a />);
  await waitFor(() => expect(older.spy).toHaveBeenCalled());
  view.rerender(<Host a b detail />);
  await ready("b:x", "b:z", "detail");
  frame.integrations.set({ ...listing, name: "Current" });
  await act(async () => {
    await reread(listing.id);
    older.emit({ ...listing, name: "Older" });
  });
  await ready("a:x", "a:y");
  expect(idsOf("a")).toEqual(["x", "y"]);
  expect(idsOf("b")).toEqual(["x", "z"]);
  for (const name of ["a:x", "b:x", "detail"])
    expect(success(name).data).toMatchObject({ id: "x", name: "Current" });
  expect(success("a:y").data.id).toBe("y");
  expect(success("b:z").data.id).toBe("z");
  await settle();
  older.emit(listing);
  await waitFor(() => expect(older.cancel).toHaveBeenCalledTimes(1));
  view.rerender(<Host b detail />);
  await settle();
  expect(frame.integrations.subscriberCount("y")).toBe(0);
  expect(frame.integrations.subscriberCount("z")).toBe(1);
  expect(frame.integrations.subscriberCount("x")).toBe(1);
  view.rerender(<Host detail />);
  await settle();
  expect(frame.integrations.subscriberCount("z")).toBe(0);
  view.rerender(<Host />);
  expect(await settle()).toEqual(baseline);
});

test("partial list failure rolls back its leases and guards without releasing existing owners", async () => {
  await boot();
  frame.integrations.set(
    fakeIntegrationState({ id: "y", name: "Second", labels: ["shared"] }),
  );
  const view = render(<Host detail />);
  await ready("detail");
  const baseline = await settle();
  const stream = frame.integrations.stream.bind(frame.integrations);
  const spy = vi
    .spyOn(frame.integrations, "stream")
    .mockImplementation((id) => {
      if (id === "y") throw new Error("Y unavailable");
      return stream(id);
    });
  for (let cycle = 0; cycle < 3; cycle++) {
    view.rerender(<Host a detail />);
    await waitFor(() => expect(lists.get("a")?.status).toBe("error"));
    expect(cache.pendingAcquisitions).toBe(0);
    expect(success("detail").data.id).toBe("x");
    view.rerender(<Host detail />);
    expect(await settle()).toEqual(baseline);
  }
  spy.mockRestore();
  view.rerender(<Host a detail />);
  await ready("a:x", "a:y");
  expect(cache.pendingAcquisitions).toBe(0);
});

test.each([
  "success",
  "failure",
] as const)("list and detail error branches share retry progress through %s", async (outcome) => {
  await boot();
  const initial = gateStream();
  const view = render(<Host detail />);
  await waitFor(() => expect(initial.spy).toHaveBeenCalled());
  await act(async () => initial.emit(listing));
  await ready("detail");
  view.rerender(<Host a b detail />);
  await ready("a:x", "b:x");
  await act(async () => initial.fail(new Error("Stream failed")));
  await waitFor(() => {
    for (const name of ["a", "b"])
      expect(lists.get(name)?.status).toBe("success");
    for (const name of ["a:x", "b:x", "detail"])
      expect(resource(name)).toMatchObject({
        status: "error",
        isRefreshing: false,
      });
  });
  const replacement = gateStream();
  let completion!: Promise<unknown>;
  let concurrent!: Promise<unknown>;
  act(() => {
    completion = resource("a:x").actions.refresh.execute();
    concurrent = resource("detail").actions.refresh.execute();
  });
  expect(await concurrent).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_ACTION_BUSY" },
  });
  await waitFor(() => expect(replacement.spy).toHaveBeenCalled());
  for (const name of ["a:x", "b:x", "detail"])
    expect(resource(name)).toMatchObject({
      status: "error",
      isRefreshing: true,
    });
  await act(async () => {
    if (outcome === "success") {
      replacement.emit(listing);
      await completion;
    } else {
      replacement.fail(new Error("Retry failed"));
      expect(await completion).toMatchObject({
        status: "error",
        error: { code: "PRISMATIC_UNKNOWN" },
      });
    }
  });
  for (const name of ["a:x", "b:x", "detail"])
    expect(resource(name)).toMatchObject({
      status: outcome === "success" ? "success" : "error",
      isRefreshing: false,
    });
  for (const name of ["a", "b"])
    expect(lists.get(name)?.status).toBe("success");
});

test.each([
  false,
  true,
])("canonical observation revocation reacquires owners (detail: %s)", async (detail) => {
  await boot();
  const view = render(<Host />);
  const baseline = await settle();
  const initial = gateStream();
  const list = vi.spyOn(frame.integrations, "list");
  const revoke = vi.spyOn(cache, "revoke");
  view.rerender(<Host a />);
  await waitFor(() => expect(initial.spy).toHaveBeenCalled());
  await act(async () => initial.emit(listing));
  await waitFor(() => expect(lists.get("a")?.status).toBe("success"));
  view.rerender(<Host a b detail={detail} />);
  await waitFor(() => expect(lists.get("b")?.status).toBe("success"));
  if (detail) await ready("a:x", "b:x", "detail");
  const before = stubOf("a", 0);
  const reportOldGeneration = onRevoked;
  await act(async () =>
    initial.fail(
      Object.assign(new Error("revoked"), {
        code: "PRISMATIC_SESSION_REVOKED",
      }),
    ),
  );
  await waitFor(() => {
    for (const name of ["a", "b"]) {
      expect(lists.get(name)?.status).toBe("success");
      expect(stubOf(name as keyof typeof inputs)).not.toBe(before);
    }
  });
  if (detail) await ready("a:x", "b:x", "detail");
  act(() =>
    reportOldGeneration(
      Object.assign(new Error("late revocation"), {
        code: "PRISMATIC_SESSION_REVOKED",
      }),
    ),
  );
  await settle();
  expect(revoke).toHaveBeenCalledTimes(1);
  expect(list).toHaveBeenCalledTimes(4);
  expect(cache.size).toBe(2 * LIST_ENTRIES + ENTITY_ENTRIES);
  expect(cache.pendingAcquisitions).toBe(0);
  expect(frame.integrations.subscriberCount("x")).toBe(1);
  const rebuilt = stubOf("a", 0);
  act(() =>
    onRevoked(
      Object.assign(new Error("current revocation"), {
        code: "PRISMATIC_SESSION_REVOKED",
      }),
    ),
  );
  await waitFor(() => {
    expect(lists.get("a")?.status).toBe("success");
    expect(stubOf("a", 0)).not.toBe(rebuilt);
  });
  await settle();
  expect(revoke).toHaveBeenCalledTimes(2);
  expect(list).toHaveBeenCalledTimes(6);
  view.rerender(<Host />);
  expect(await settle()).toEqual(baseline);
  expect(cache.size).toBe(0);
});

test("non-session observation errors preserve unrelated entities and useful rows", async () => {
  await boot();
  const initial = gateStream();
  const view = render(<Host detail />);
  await waitFor(() => expect(initial.spy).toHaveBeenCalled());
  await act(async () => initial.emit(listing));
  await ready("detail");
  frame.integrations.set(fakeIntegrationState({ id: "y", labels: ["shared"] }));
  view.rerender(<Host a b detail />);
  await ready("a:x", "a:y", "b:x");
  await settle();
  const stubs = entriesOf("a").map((_, index) => stubOf("a", index));
  const unrelated = success("a:y").data;
  const revoke = vi.spyOn(cache, "revoke");
  const list = vi.spyOn(frame.integrations, "list");
  await act(async () => initial.fail(new Error("offline")));
  await waitFor(() =>
    expect(resource("detail")).toMatchObject({
      status: "error",
      error: { code: "PRISMATIC_UNKNOWN", message: "offline" },
    }),
  );
  await settle();
  expect(lists.get("a")?.status).toBe("success");
  expect(resource("a:x")).toMatchObject({ status: "error" });
  expect(idsOf("a")).toEqual(["x", "y"]);
  expect(success("a:y").data).toEqual(unrelated);
  expect(stubOf("a", 1)).toBe(stubs[1]);
  expect(revoke).not.toHaveBeenCalled();
  expect(list).not.toHaveBeenCalled();
  expect(frame.integrations.subscriberCount("y")).toBe(1);
});

test("list-only entity acquisition revocation reacquires without a Card or detail hook", async () => {
  await boot();
  const view = render(<Host />);
  const baseline = await settle();
  view.rerender(<Host a />);
  await waitFor(() => expect(lists.get("a")?.status).toBe("success"));
  const revoke = vi.spyOn(cache, "revoke");
  const before = stubOf("a", 0);
  const entry = entriesOf("a")[0];
  if (!entry) throw new Error("Missing list entry");
  vi.spyOn(entry.lease, "snapshot").mockReturnValue({
    status: "error",
    value: undefined,
    error: Object.assign(new Error("revoked"), {
      code: "PRISMATIC_SESSION_REVOKED",
    }),
    isRefetching: false,
  });
  act(() => cache.invalidate("unrelated"));
  await waitFor(() => {
    expect(revoke).toHaveBeenCalledTimes(1);
    expect(lists.get("a")?.status).toBe("success");
    expect(stubOf("a", 0)).not.toBe(before);
  });
  await settle();
  expect(revoke).toHaveBeenCalledTimes(1);
  expect(cache.pendingAcquisitions).toBe(0);
  expect(frame.integrations.subscriberCount("x")).toBe(1);
  view.rerender(<Host />);
  expect(await settle()).toEqual(baseline);
});

test.each([
  "stream",
  "entry",
] as const)("list-only revocation sees a later %s error behind an ordinary first error", async (source) => {
  await boot();
  const secondState = fakeIntegrationState({ id: "y", labels: ["shared"] });
  frame.integrations.set(secondState);
  const view = render(<Host />);
  const baseline = await settle();
  const first = gateStream();
  const second = gateStream();
  const list = vi.spyOn(frame.integrations, "list");
  const revoke = vi.spyOn(cache, "revoke");
  view.rerender(<Host a />);
  await waitFor(() => expect(first.spy).toHaveBeenCalledTimes(2));
  await act(async () => {
    first.emit(listing);
    second.emit(secondState);
  });
  await waitFor(() => expect(lists.get("a")?.status).toBe("success"));
  expect(idsOf("a")).toEqual(["x", "y"]);
  const before = entriesOf("a").map((_, index) => stubOf("a", index));
  const entries = entriesOf("a");
  const fail = async (index: number, error: Error) => {
    await act(async () => {
      if (source === "stream") {
        (index === 0 ? first : second).fail(error);
      } else {
        vi.spyOn(entries[index].lease, "snapshot").mockReturnValue({
          status: "error",
          value: undefined,
          error,
          isRefetching: false,
        });
        cache.invalidate("unrelated");
      }
    });
  };
  await fail(0, new Error("first ordinary failure"));
  await waitFor(() =>
    expect(resource("a:x")).toMatchObject({
      status: "error",
      error: { message: "first ordinary failure" },
    }),
  );
  expect(revoke).not.toHaveBeenCalled();
  await fail(
    1,
    Object.assign(new Error("second revoked"), {
      code: "PRISMATIC_SESSION_REVOKED",
    }),
  );
  await waitFor(() => {
    expect(lists.get("a")?.status).toBe("success");
    expect(revoke).toHaveBeenCalledTimes(1);
  });
  if (source === "entry") {
    await act(async () => {
      first.emit(listing);
      second.emit(secondState);
    });
    await waitFor(() => {
      expect(first.cancel).toHaveBeenCalledTimes(1);
      expect(second.cancel).toHaveBeenCalledTimes(1);
    });
  }
  await settle();
  expect(idsOf("a")).toEqual(["x", "y"]);
  for (const index of entriesOf("a").keys())
    expect(stubOf("a", index)).not.toBe(before[index]);
  expect(revoke).toHaveBeenCalledTimes(1);
  expect(list).toHaveBeenCalledTimes(2);
  expect(cache.size).toBe(LIST_ENTRIES + 2 * ENTITY_ENTRIES);
  expect(cache.pendingAcquisitions).toBe(0);
  expect(frame.integrations.subscriberCount("x")).toBe(1);
  expect(frame.integrations.subscriberCount("y")).toBe(1);
  view.rerender(<Host />);
  expect(await settle()).toEqual(baseline);
  expect(cache.size).toBe(0);
});

test.each([
  "initial",
  "refresh",
] as const)("late list-owned %s completion after final unmount returns to baseline", async (phase) => {
  await boot();
  const view = render(<Host />);
  const baseline = await settle();
  let gate = phase === "initial" ? gateStream() : undefined;
  view.rerender(<Host a />);
  if (phase === "refresh") {
    await ready("a:x");
    gate = gateStream();
    act(() => {
      resource("a:x").actions.refresh.execute();
    });
  }
  if (!gate) throw new Error("Missing gate");
  const active = gate;
  await waitFor(() => expect(active.spy).toHaveBeenCalled());
  view.rerender(<Host />);
  await settle();
  await act(async () => active.emit(listing));
  await settle();
  active.emit(listing);
  await waitFor(() => expect(active.cancel).toHaveBeenCalledTimes(1));
  expect(await settle()).toEqual(baseline);
  expect(cache.size).toBe(0);
  expect(cache.pendingAcquisitions).toBe(0);
});

test("an ignored failed shared refresh remains handled and revocation reloads every owner", async () => {
  await boot();
  render(<Host a b detail />);
  await ready("a:x", "b:x", "detail");
  const before = stubOf("a", 0);
  vi.spyOn(frame.integrations, "get").mockImplementationOnce(() => {
    throw new Error("offline");
  });
  act(() => {
    resource("a:x").actions.refresh.execute();
  });
  await waitFor(() => expect(success("a:x").isRefreshing).toBe(false));
  expect(stubOf("a", 0)).toBe(before);
  vi.spyOn(frame.integrations, "get").mockImplementationOnce(() => {
    throw Object.assign(new Error("revoked"), {
      code: "PRISMATIC_SESSION_REVOKED",
    });
  });
  act(() => {
    resource("a:x").actions.refresh.execute();
  });
  await waitFor(() => expect(stubOf("a", 0)).not.toBe(before));
  await ready("a:x", "b:x", "detail");
  await settle();
  expect(cache.size).toBe(2 * LIST_ENTRIES + ENTITY_ENTRIES);
  expect(cache.pendingAcquisitions).toBe(0);
  expect(frame.integrations.subscriberCount("x")).toBe(1);
});

test("StrictMode repeated list/detail navigation releases every ownership layer", async () => {
  await boot();
  const view = render(
    <StrictMode>
      <Host />
    </StrictMode>,
  );
  const baseline = await settle();
  for (let cycle = 0; cycle < 4; cycle++) {
    view.rerender(
      <StrictMode>
        <Host a b />
      </StrictMode>,
    );
    await ready("a:x", "b:x");
    view.rerender(
      <StrictMode>
        <Host a b detail />
      </StrictMode>,
    );
    await ready("detail");
    await act(async () => resource("a:x").actions.refresh.execute());
    view.rerender(
      <StrictMode>
        <Host detail />
      </StrictMode>,
    );
    await settle();
    expect(cache.size).toBe(2);
    view.rerender(
      <StrictMode>
        <Host />
      </StrictMode>,
    );
    expect(await settle()).toEqual(baseline);
    expect(cache.pendingAcquisitions).toBe(0);
    resources.clear();
  }
});

test("an abandoned list render releases its entity leases after the abandonment window", async () => {
  await boot();
  const never = new Promise<void>(() => {});
  const Abandoned = () => {
    useMarketplace(inputs.a);
    throw never;
  };
  const view = render(<Host />);
  const baseline = await settle();
  view.rerender(
    <PrismaticProvider client={client} resourceIdleMs={0}>
      <Capture />
      <Suspense fallback={null}>
        <Abandoned />
      </Suspense>
    </PrismaticProvider>,
  );
  await waitFor(() => expect(cache.size).toBe(LIST_ENTRIES + ENTITY_ENTRIES));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1100));
  });
  expect(await settle()).toEqual(baseline);
  expect(cache.size).toBe(0);
  expect(cache.pendingAcquisitions).toBe(0);
});

test.each([
  "same-key",
  "unrelated",
] as const)("%s invalidation during incoming identity observation guards adoption selectively", async (operation) => {
  await boot();
  const view = render(<Host />);
  const baseline = await settle();
  const incoming = gateStream();
  view.rerender(<Host a />);
  await waitFor(() => expect(incoming.spy).toHaveBeenCalled());
  expect(cache.pendingAcquisitions).toBe(1);
  act(() => {
    cache.invalidate(
      `s0:${keys.integration(operation === "same-key" ? "x" : "other")}`,
    );
  });
  view.rerender(<Host a detail />);
  await ready("detail");
  await act(async () => incoming.emit({ ...listing, name: "Older" }));
  await waitFor(() =>
    expect(lists.get("a")?.status).toBe(
      operation === "same-key" ? "error" : "success",
    ),
  );
  expect(success("detail").data.name).toBe(listing.name);
  expect(cache.pendingAcquisitions).toBe(0);
  await settle();
  incoming.emit(listing);
  await waitFor(() => expect(incoming.cancel).toHaveBeenCalledTimes(1));
  view.rerender(<Host />);
  expect(await settle()).toEqual(baseline);
});

test("same-user scope rotation refuses an old list arrival and preserves only the new session", async () => {
  const authenticate = FakePreAuthApi.prototype.authenticate;
  vi.spyOn(FakePreAuthApi.prototype, "authenticate").mockImplementation(
    function (jwt) {
      return authenticate.call(
        this,
        `alice/${jwt === "changed" ? "role2" : "role1"}:${jwt}`,
      );
    },
  );
  vi.spyOn(
    FakePrismaticApi.prototype,
    "getAuthenticatedUser",
  ).mockResolvedValue({
    id: "alice",
    name: "Alice",
    email: "alice@example.com",
  });
  await boot();
  const view = render(<Host />);
  await settle();
  const incoming = gateStream();
  view.rerender(<Host a />);
  await waitFor(() => expect(incoming.spy).toHaveBeenCalled());
  expect(cache.pendingAcquisitions).toBe(1);
  view.rerender(<Host a b detail token="changed" />);
  await ready("a:x", "b:x", "detail");
  const current = stubOf("a", 0);
  await act(async () => incoming.emit({ ...listing, name: "Old scope" }));
  await settle();
  incoming.emit(listing);
  await waitFor(() => expect(incoming.cancel).toHaveBeenCalledTimes(1));
  for (const name of ["a:x", "b:x", "detail"])
    expect(success(name).data.name).toBe(listing.name);
  expect(stubOf("a", 0)).toBe(current);
  expect(cache.pendingAcquisitions).toBe(0);
  expect(cache.size).toBe(2 * LIST_ENTRIES + ENTITY_ENTRIES);
  expect(frame.integrations.subscriberCount("x")).toBe(1);
});

test("the acquisition guard exists before the list RPC, not only before observing its result", async () => {
  await boot();
  const view = render(<Host />);
  const baseline = await settle();
  const list = frame.integrations.list.bind(frame.integrations);
  const rpc = vi
    .spyOn(frame.integrations, "list")
    .mockImplementationOnce(() => {
      expect(cache.pendingAcquisitions).toBe(1);
      cache.invalidate(`s0:${keys.integration("x")}`);
      return list();
    });
  view.rerender(<Host a />);
  await waitFor(() => expect(lists.get("a")?.status).toBe("error"));
  expect(rpc).toHaveBeenCalledTimes(1);
  expect(cache.peek(`s0:${keys.integration("x")}`)).toBe("missing");
  expect(cache.pendingAcquisitions).toBe(0);
  view.rerender(<Host />);
  expect(await settle()).toEqual(baseline);
});
