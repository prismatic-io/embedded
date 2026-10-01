import type { MarketplaceIntegrationState } from "@prismatic-io/solis-core/protocol";
import { type Client, createClient } from "@prismatic-io/solis-core";
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
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";
import {
  type MarketplaceIntegrationPermissions,
  type MarketplaceIntegrationResource,
  PrismaticProvider,
  useMarketplaceIntegration,
} from "./index.js";
import { useResourceCache } from "./PrismaticProvider.js";

const origin = "https://app.example.com";
const listing = fakeIntegrationState({ id: "i-1", name: "Original" });
let frame: FakeFrame;
let client: Client;

afterEach(() => {
  cleanup();
  client?.dispose();
  frame?.restore();
  vi.restoreAllMocks();
});

const boot = async () => {
  frame = installFakeFrame({ origin, integrations: [listing] });
  client = await createClient({ prismaticUrl: origin, jwt: "alice:t1" });
};

const Wrapper = ({ children }: { children: ReactNode }) => (
  <PrismaticProvider client={client} resourceIdleMs={0}>
    {children}
  </PrismaticProvider>
);

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

const calls = () => {
  let gets = 0;
  const off = client.telemetry.subscribe((event) => {
    if (event.kind === "call" && event.label.includes("api.marketplace.get("))
      gets++;
  });
  return { count: () => gets, off };
};

const success = (resource: MarketplaceIntegrationResource) => {
  expect(resource.status).toBe("success");
  if (resource.status !== "success") throw new Error("Expected success");
  return resource;
};

const gateStream = () => {
  let controller!: ReadableStreamDefaultController<MarketplaceIntegrationState>;
  const cancel = vi.fn();
  const stream = new ReadableStream<MarketplaceIntegrationState>({
    start: (next) => {
      controller = next;
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

test("public readers share one acquisition and one live stream, passing permissions unchanged", async () => {
  await boot();
  const acquisitions = calls();
  const { result } = renderHook(
    () => [
      useMarketplaceIntegration(listing.id),
      useMarketplaceIntegration(listing.id),
    ],
    { wrapper: Wrapper },
  );
  await waitFor(() =>
    expect(result.current.every((r) => r.status === "success")).toBe(true),
  );
  expect(acquisitions.count()).toBe(1);
  expect(frame.integrations.subscriberCount(listing.id)).toBe(1);
  const permissions: MarketplaceIntegrationPermissions = {
    createInstance: { allowed: false, reason: "NOT_CUSTOMER_DEPLOYABLE" },
  };
  frame.integrations.set({
    ...listing,
    name: "Live",
    isCustomerDeployable: false,
  });
  await act(async () => {
    disposeQuietly(await client.authenticated?.marketplace.get(listing.id));
  });
  await waitFor(() =>
    expect(success(result.current[0]).data.name).toBe("Live"),
  );
  for (const resource of result.current) {
    expect(success(resource).data.permissions).toEqual(permissions);
    expect(resource).not.toHaveProperty("stub");
    expect(resource).not.toHaveProperty("error");
    expect(resource).not.toHaveProperty("permissions");
  }
  expect(success(result.current[0]).data).toBe(success(result.current[1]).data);
  acquisitions.off();
});

test.each([
  null,
  undefined,
])("a %s id stays loading with actions and no acquisition", async (id) => {
  await boot();
  const acquisitions = calls();
  const { result } = renderHook(() => useMarketplaceIntegration(id), {
    wrapper: Wrapper,
  });
  await act(async () => {
    await result.current.actions.refresh.execute();
  });
  expect(Object.keys(result.current).sort()).toEqual(["actions", "status"]);
  expect(result.current.status).toBe("loading");
  expect(acquisitions.count()).toBe(0);
  expect(frame.openStreams()).toBe(0);
  acquisitions.off();
});

test("not found is a typed error, not empty, and can be retried through the same actions", async () => {
  await boot();
  const id = "missing";
  const { result } = renderHook(() => useMarketplaceIntegration(id), {
    wrapper: Wrapper,
  });
  await waitFor(() => expect(result.current.status).toBe("error"));
  expect(result.current).toMatchObject({
    error: { code: "PRISMATIC_MARKETPLACE_INTEGRATION_NOT_FOUND" },
  });
  expect(Object.keys(result.current).sort()).toEqual([
    "actions",
    "error",
    "isRefreshing",
    "status",
  ]);
  frame.integrations.set(fakeIntegrationState({ id }));
  await act(async () => {
    await result.current.actions.refresh.execute();
  });
  expect(success(result.current).data.id).toBe(id);
});

test("ID changes never paint the previous target and release it after the idle window", async () => {
  await boot();
  const nextId = "i-2";
  frame.integrations.set(fakeIntegrationState({ id: nextId }));
  const paints: Array<{ requested: string | null; actual?: string }> = [];
  const { result, rerender } = renderHook(
    ({ id }: { id: string | null }) => {
      const resource = useMarketplaceIntegration(id);
      paints.push({
        requested: id,
        actual: resource.status === "success" ? resource.data.id : undefined,
      });
      return resource;
    },
    { wrapper: Wrapper, initialProps: { id: listing.id as string | null } },
  );
  await waitFor(() => expect(result.current.status).toBe("success"));
  rerender({ id: nextId });
  await waitFor(() => expect(success(result.current).data.id).toBe(nextId));
  await settle();
  expect(frame.integrations.subscriberCount(listing.id)).toBe(0);
  expect(frame.integrations.subscriberCount(nextId)).toBe(1);
  rerender({ id: null });
  expect(result.current.status).toBe("loading");
  await settle();
  expect(frame.openStreams()).toBe(0);
  expect(
    paints.every(
      ({ requested, actual }) => actual === undefined || actual === requested,
    ),
  ).toBe(true);
});

test("a second refresh while one runs is busy; the first retains success while pending and resolves after replacement", async () => {
  await boot();
  const { result } = renderHook(() => useMarketplaceIntegration(listing.id), {
    wrapper: Wrapper,
  });
  await waitFor(() => expect(result.current.status).toBe("success"));
  const acquisitions = calls();
  const gate = gateStream();
  let first!: Promise<unknown>;
  let second!: Promise<unknown>;
  act(() => {
    first = result.current.actions.refresh.execute();
    second = result.current.actions.refresh.execute();
  });
  await waitFor(() => expect(gate.spy).toHaveBeenCalled());
  expect(success(result.current)).toMatchObject({
    isRefreshing: true,
    data: { name: listing.name },
  });
  const permissions: MarketplaceIntegrationPermissions = {
    createInstance: { allowed: false, reason: "Unavailable" },
  };
  await act(async () => {
    gate.emit({ ...listing, name: "Replacement", permissions });
    expect(await first).toEqual({ status: "success", data: undefined });
    expect(await second).toMatchObject({
      status: "error",
      error: { code: "PRISMATIC_ACTION_BUSY" },
    });
  });
  expect(success(result.current)).toMatchObject({
    isRefreshing: false,
    data: { name: "Replacement", permissions },
  });
  expect(acquisitions.count()).toBe(1);
  acquisitions.off();
});

test("refresh resolves a typed unknown error without discarding successful data or permissions", async () => {
  await boot();
  const { result } = renderHook(() => useMarketplaceIntegration(listing.id), {
    wrapper: Wrapper,
  });
  await waitFor(() => expect(result.current.status).toBe("success"));
  const before = success(result.current);
  vi.spyOn(frame.integrations, "get").mockImplementationOnce(() => {
    throw new Error("offline");
  });
  await act(async () => {
    expect(await result.current.actions.refresh.execute()).toMatchObject({
      status: "error",
      error: { code: "PRISMATIC_UNKNOWN" },
    });
  });
  expect(success(result.current).data).toEqual(before.data);
  expect(success(result.current).data.permissions).toBe(
    before.data.permissions,
  );
  expect(success(result.current).isRefreshing).toBe(false);
  expect(result.current.actions.refresh).toMatchObject({
    status: "error",
    error: { code: "PRISMATIC_UNKNOWN" },
  });
  expect(frame.integrations.subscriberCount(listing.id)).toBe(1);
});

test("a revocation reported by refresh invalidates cached targets and re-acquires", async () => {
  await boot();
  const { result } = renderHook(() => useMarketplaceIntegration(listing.id), {
    wrapper: Wrapper,
  });
  await waitFor(() => expect(result.current.status).toBe("success"));
  const acquisitions = calls();
  vi.spyOn(frame.integrations, "get").mockImplementationOnce(() => {
    throw Object.assign(new Error("revoked"), {
      code: "PRISMATIC_SESSION_REVOKED",
    });
  });
  await act(async () => {
    expect(await result.current.actions.refresh.execute()).toMatchObject({
      status: "error",
      error: { code: "PRISMATIC_SESSION_REVOKED" },
    });
  });
  await waitFor(() => expect(result.current.status).toBe("success"));
  await settle();
  expect(acquisitions.count()).toBe(2);
  expect(frame.openStreams()).toBe(1);
  acquisitions.off();
});

test("a live state-stream failure becomes a typed resource error", async () => {
  await boot();
  let controller!: ReadableStreamDefaultController<MarketplaceIntegrationState>;
  vi.spyOn(frame.integrations, "stream").mockReturnValueOnce(
    new ReadableStream<MarketplaceIntegrationState>({
      start: (stream) => {
        controller = stream;
        stream.enqueue(listing);
      },
    }),
  );
  const { result } = renderHook(() => useMarketplaceIntegration(listing.id), {
    wrapper: Wrapper,
  });
  await waitFor(() => expect(result.current.status).toBe("success"));
  await act(async () => {
    controller.error(new Error("state stream failed"));
  });
  await waitFor(() => expect(result.current.status).toBe("error"));
  expect(result.current).toMatchObject({
    error: { code: "PRISMATIC_UNKNOWN", message: "state stream failed" },
  });
  expect(result.current).not.toHaveProperty("data");
  expect(result.current).not.toHaveProperty("permissions");
});

test.each([
  ["acquisition", "success"],
  ["acquisition", "failure"],
  ["stream", "success"],
  ["stream", "failure"],
] as const)("retry after %s error exposes progress through %s", async (source, outcome) => {
  await boot();
  const initialError = new Error(`${source} failed`);
  const initialStream = source === "stream" ? gateStream() : null;
  if (source === "acquisition") {
    vi.spyOn(frame.integrations, "get").mockImplementationOnce(() => {
      throw initialError;
    });
  }
  const { result } = renderHook(() => useMarketplaceIntegration(listing.id), {
    wrapper: Wrapper,
  });
  if (initialStream) {
    await waitFor(() => expect(initialStream.spy).toHaveBeenCalled());
    await act(async () => initialStream.emit(listing));
    await waitFor(() => expect(result.current.status).toBe("success"));
    await act(async () => initialStream.fail(initialError));
  }
  await waitFor(() => expect(result.current.status).toBe("error"));
  expect(result.current).toMatchObject({ isRefreshing: false });

  const replacement = gateStream();
  let completion!: Promise<unknown>;
  act(() => {
    completion = result.current.actions.refresh
      .execute()
      .then((outcome) =>
        outcome.status === "error" ? outcome.error : undefined,
      );
  });
  await waitFor(() => expect(replacement.spy).toHaveBeenCalled());
  expect(result.current).toMatchObject({
    status: "error",
    error: { message: initialError.message },
    isRefreshing: true,
  });
  expect(result.current).not.toHaveProperty("data");
  let error: unknown;
  await act(async () => {
    if (outcome === "success") replacement.emit(listing);
    else replacement.fail(new Error("retry failed"));
    error = await completion;
  });
  if (outcome === "success") {
    expect(error).toBeUndefined();
    expect(success(result.current).isRefreshing).toBe(false);
  } else {
    expect(error).toMatchObject({
      code: "PRISMATIC_UNKNOWN",
      message: "retry failed",
    });
    expect(result.current).toMatchObject({
      status: "error",
      isRefreshing: false,
    });
  }
});

test("an authenticated identity change re-acquires the listing under the new session", async () => {
  await boot();
  let token = "alice:t1";
  const acquisitions = calls();
  const { result, rerender } = renderHook(
    () => useMarketplaceIntegration(listing.id),
    {
      wrapper: ({ children }) => (
        <PrismaticProvider client={client} auth={{ token }} resourceIdleMs={0}>
          {children}
        </PrismaticProvider>
      ),
    },
  );
  await waitFor(() => expect(result.current.status).toBe("success"));
  token = "bob:t1";
  rerender();
  await waitFor(() => expect(acquisitions.count()).toBe(2));
  await waitFor(() => expect(result.current.status).toBe("success"));
  await settle();
  expect(frame.openStreams()).toBe(1);
  acquisitions.off();
});

test.each([
  { isCustomerMarketplaceUser: true, isCustomerMarketplaceAdmin: true },
  { isCustomerMarketplaceUser: false, isCustomerMarketplaceAdmin: false },
])("same-user role change reacquires permissions while same-scope rotation does not: %j", async (nextRole) => {
  const user = { id: "user-alice", email: "alice@example.com", name: "Alice" };
  const customerId = "customer-1";
  const initialRole = {
    isCustomerMarketplaceUser: false,
    isCustomerMarketplaceAdmin: true,
  };
  const authenticate = FakePreAuthApi.prototype.authenticate;
  vi.spyOn(FakePreAuthApi.prototype, "authenticate").mockImplementation(
    function (jwt) {
      const role = jwt === "changed" ? nextRole : initialRole;
      const scope = [
        user.id,
        customerId,
        role.isCustomerMarketplaceUser,
        role.isCustomerMarketplaceAdmin,
      ].join("/");
      return authenticate.call(this, `${scope}:${jwt}`);
    },
  );
  vi.spyOn(
    FakePrismaticApi.prototype,
    "getAuthenticatedUser",
  ).mockResolvedValue(user);
  await boot();
  let token = "initial";
  const acquisitions = calls();
  const { result, rerender } = renderHook(
    () => ({
      resource: useMarketplaceIntegration(listing.id),
      cache: useResourceCache(),
    }),
    {
      wrapper: ({ children }) => (
        <PrismaticProvider client={client} auth={{ token }} resourceIdleMs={0}>
          {children}
        </PrismaticProvider>
      ),
    },
  );
  await waitFor(() => expect(result.current.resource.status).toBe("success"));
  await settle();
  expect(acquisitions.count()).toBe(1);
  const originalPermissions = success(result.current.resource).data.permissions;
  const acquisition = result.current.cache.beginAcquisition();

  token = "rotation";
  rerender();
  await settle();
  expect(acquisitions.count()).toBe(1);
  expect(success(result.current.resource).data.permissions).toEqual(
    originalPermissions,
  );
  expect(acquisition.isCurrent("integration/late")).toBe(true);

  const permissions: MarketplaceIntegrationPermissions = {
    createInstance: {
      allowed: false,
      reason: "Role no longer permits configuration",
    },
  };
  // Update the response only, not the old stream: revoked streams close without
  // an emission, so the hook must acquire a new target to see these permissions.
  const stream = frame.integrations.stream.bind(frame.integrations);
  vi.spyOn(frame.integrations, "stream").mockImplementation((id) =>
    stream(id).pipeThrough(
      new TransformStream({
        transform: (state, controller) =>
          controller.enqueue({ ...state, permissions }),
      }),
    ),
  );
  token = "changed";
  rerender();
  await waitFor(() => expect(acquisitions.count()).toBe(2));
  await waitFor(() =>
    expect(success(result.current.resource).data.permissions).toEqual(
      permissions,
    ),
  );
  const release = vi.fn();
  expect(() =>
    result.current.cache.retain({
      key: "integration/late",
      acquisition,
      load: async () => ({ value: listing }),
      incoming: { value: listing, release },
    }),
  ).toThrow("revoked");
  expect(release).toHaveBeenCalledTimes(1);
  acquisition.release();
  await settle();
  expect(frame.openStreams()).toBe(1);
  acquisitions.off();
});

test("a failed session-scope probe does not strand cached resources", async () => {
  await boot();
  let token = "alice:t1";
  const acquisitions = calls();
  const onError = vi.fn();
  const { result, rerender } = renderHook(
    () => useMarketplaceIntegration(listing.id),
    {
      wrapper: ({ children }) => (
        <PrismaticProvider
          client={client}
          auth={{ token }}
          resourceIdleMs={0}
          onError={onError}
        >
          {children}
        </PrismaticProvider>
      ),
    },
  );
  await waitFor(() => expect(result.current.status).toBe("success"));
  await settle();
  expect(acquisitions.count()).toBe(1);

  vi.spyOn(FakePrismaticApi.prototype, "getSessionScope").mockRejectedValueOnce(
    new Error("scope unavailable"),
  );
  token = "alice:t2";
  rerender();
  await waitFor(() => expect(acquisitions.count()).toBe(2));
  await waitFor(() => expect(result.current.status).toBe("success"));
  expect(onError).toHaveBeenCalledWith(
    expect.objectContaining({ message: "scope unavailable" }),
  );
  await settle();
  expect(frame.openStreams()).toBe(1);
  acquisitions.off();
});

test.each([
  "initial",
  "refresh",
] as const)("releases a late %s load after unmount", async (phase) => {
  await boot();
  const baseline = await settle();
  let gate = phase === "initial" ? gateStream() : undefined;
  const { result, unmount } = renderHook(
    () => useMarketplaceIntegration(listing.id),
    { wrapper: Wrapper },
  );
  let completion: Promise<unknown> | undefined;
  if (phase === "refresh") {
    await waitFor(() => expect(result.current.status).toBe("success"));
    gate = gateStream();
    act(() => {
      completion = result.current.actions.refresh.execute();
    });
  }
  if (!gate) throw new Error("Missing stream gate");
  const activeGate = gate;
  await waitFor(() => expect(activeGate.spy).toHaveBeenCalled());
  unmount();
  await act(async () => {
    activeGate.emit(listing);
    await completion;
  });
  await settle();
  // A pipe notices cancellation on its next write.
  activeGate.emit(listing);
  await waitFor(() => expect(activeGate.cancel).toHaveBeenCalledTimes(1));
  expect(await settle()).toEqual(baseline);
});

test("repeated acquire, refresh, and unmount returns transport and streams to baseline", async () => {
  await boot();
  const baseline = await settle();
  for (let cycle = 0; cycle < 4; cycle++) {
    const { result, unmount } = renderHook(
      () => useMarketplaceIntegration(listing.id),
      { wrapper: Wrapper },
    );
    await waitFor(() => expect(result.current.status).toBe("success"));
    await act(async () => {
      await result.current.actions.refresh.execute();
    });
    unmount();
    expect(await settle()).toEqual(baseline);
  }
});

test("protocol mismatch becomes a typed resource error", async () => {
  frame = installFakeFrame({ origin, protocol: -1 });
  const { result } = renderHook(() => useMarketplaceIntegration(listing.id), {
    wrapper: ({ children }) => (
      <PrismaticProvider prismaticUrl={origin}>{children}</PrismaticProvider>
    ),
  });
  await waitFor(() => expect(result.current.status).toBe("error"));
  expect(result.current).toMatchObject({
    error: { code: "PRISMATIC_PROTOCOL_MISMATCH" },
  });
});
