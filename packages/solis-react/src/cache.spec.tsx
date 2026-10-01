/** What the shared cache buys, measured: de-duplication, hook pairing, refresh, membership. */

import type { Client } from "@prismatic-io/solis-core";
import { STATE_RELEASE_GRACE_MS } from "@prismatic-io/solis-core/internal";
import {
  type FakeFrame,
  fakeConnectionState,
  fakeInstanceState,
  fakeIntegrationState,
  installFakeFrame,
} from "@prismatic-io/solis-core/testing";
import { act, render, screen, waitFor } from "@testing-library/react";
import { type ReactNode, useState } from "react";
import { afterEach, expect, test } from "vitest";
import { useConfiguration } from "./domain/useConfiguration.js";
import { useConnections } from "./domain/useConnections.js";
import { useInstance, useInstances } from "./domain/useInstances.js";
import { useMarketplace } from "./domain/useMarketplace.js";
import { useMarketplaceIntegration } from "./domain/useMarketplaceIntegration.js";
import { PrismaticProvider, usePrismaticClient } from "./PrismaticProvider.js";

const APP_ORIGIN = "https://app.example.com";

type Connections = ReturnType<typeof useConnections>;

const itemIds = (list: Connections) =>
  list.status === "success" ? list.data.items.map(({ id }) => id) : [];

const refreshOf = (list: Connections) => () => {
  void list.actions.refresh.execute();
};

const isRefreshing = (list: Connections) =>
  list.status !== "loading" && list.isRefreshing;

let frame: FakeFrame | undefined;
afterEach(() => {
  frame?.restore();
  frame = undefined;
});

/** Installs the frame and hands it back, so `afterEach` always has the live one to restore. */
const install = (
  options: Parameters<typeof installFakeFrame>[0],
): FakeFrame => {
  frame = installFakeFrame(options);
  return frame;
};

const Tree = ({
  children,
  idleMs,
}: {
  children: ReactNode;
  idleMs?: number;
}) => (
  <PrismaticProvider
    prismaticUrl={APP_ORIGIN}
    auth={{ token: "jwt-1" }}
    resourceIdleMs={idleMs}
  >
    {children}
  </PrismaticProvider>
);

/** Counts the frame calls whose label contains `needle`, from now until `off()`. */
const countCalls = (client: Client, needle: string) => {
  let calls = 0;
  const off = client.telemetry.subscribe((event) => {
    if (event.kind === "call" && event.label.includes(needle)) calls += 1;
  });
  return { count: () => calls, off };
};

const settled = async (f: FakeFrame) => {
  await new Promise((resolve) =>
    setTimeout(resolve, STATE_RELEASE_GRACE_MS * 2),
  );
  await f.flushStreams();
};

test("N readers of one key cost what one reader costs", async () => {
  const f = install({
    origin: APP_ORIGIN,
    connections: [1, 2, 3].map((n) => fakeConnectionState({ id: `c-${n}` })),
  });

  const seen: { client: Client | null; ready: number } = {
    client: null,
    ready: 0,
  };
  const Capture = () => {
    seen.client = usePrismaticClient();
    return null;
  };
  const Reader = () => {
    const q = useConnections();
    if (q.status !== "loading") seen.ready += 1;
    return <span>{itemIds(q).length}</span>;
  };

  const measure = async (readers: number, live: FakeFrame) => {
    seen.client = null;
    seen.ready = 0;
    const view = render(
      <Tree>
        <Capture />
        {Array.from({ length: readers }, (_, i) => `reader-${i}`).map((id) => (
          <Reader key={id} />
        ))}
      </Tree>,
    );
    await waitFor(() => expect(seen.client).not.toBeNull());
    const client = seen.client as unknown as Client;
    await waitFor(() => expect(seen.ready).toBeGreaterThanOrEqual(readers));
    await settled(live);
    const { imports, exports } = client.stats();
    const streams = live.openStreams();
    view.unmount();
    return { imports, exports, streams };
  };

  const one = await measure(1, f);
  // A fresh frame per measurement: the counts are absolute, so a torn-down session's
  // tables must not be what the second reading lands in.
  f.restore();
  const second = install({
    origin: APP_ORIGIN,
    connections: [1, 2, 3].map((n) => fakeConnectionState({ id: `c-${n}` })),
  });
  const four = await measure(4, second);

  // Exact equality, not merely "less than four times": four readers join one entry, so the
  // import table, the export table and the open streams are the same tables as for one.
  expect(
    four,
    `one reader ${JSON.stringify(one)}; four ${JSON.stringify(four)}`,
  ).toEqual(one);
});

test("a config screen with an actions menu resolves its instance once", async () => {
  const f = install({
    origin: APP_ORIGIN,
    integrations: [fakeIntegrationState({ id: "int-1" })],
    instances: [
      fakeInstanceState({ id: "x-1", integrationId: "int-1", deployed: true }),
    ],
    configurations: {
      "int-1": {
        schema: { type: "object" },
        configurationVersion: "definition-1",
      },
    },
  });

  const seen: { client: Client | null; ready: boolean } = {
    client: null,
    ready: false,
  };
  const Capture = () => {
    seen.client = usePrismaticClient();
    return null;
  };
  /** The three hooks a config screen with a menu actually mounts. */
  const Screen = () => {
    const instance = useInstance("x-1");
    const config = useConfiguration({ instanceId: "x-1" });
    seen.ready = instance.status === "success" && config.status !== "loading";
    return <span data-testid="ready">{String(seen.ready)}</span>;
  };

  const view = render(
    <Tree>
      <Capture />
    </Tree>,
  );
  await waitFor(() => expect(seen.client).not.toBeNull());
  const client = seen.client as unknown as Client;
  const gets = countCalls(client, "api.instances.get()");

  view.rerender(
    <Tree>
      <Capture />
      <Screen />
    </Tree>,
  );
  await waitFor(() =>
    expect(screen.getByTestId("ready")).toHaveTextContent("true"),
  );
  await settled(f);
  gets.off();

  // Configuration owns its acquisition independently of the instance resource.
  expect(gets.count(), "api.instances.get() calls for one config screen").toBe(
    2,
  );
  view.unmount();
});

test("refresh reloads a list without blanking it, and reports isRefetching", async () => {
  install({
    origin: APP_ORIGIN,
    connections: [1, 2].map((n) => fakeConnectionState({ id: `c-${n}` })),
  });

  interface Seen {
    refresh: (() => void) | null;
    blanked: boolean;
    sawRefetching: boolean;
  }
  const seen: Seen = { refresh: null, blanked: false, sawRefetching: false };

  const List = () => {
    const q = useConnections();
    const rows = itemIds(q).length;
    seen.refresh = refreshOf(q);
    if (isRefreshing(q)) seen.sawRefetching = true;
    // Once rows have arrived, a later render with none is the panel blanking.
    if (started && rows === 0) seen.blanked = true;
    if (rows > 0) started = true;
    return <span data-testid="n">{rows}</span>;
  };
  let started = false;

  render(
    <Tree>
      <List />
    </Tree>,
  );
  await waitFor(() => expect(screen.getByTestId("n")).toHaveTextContent("2"));

  for (let round = 0; round < 3; round += 1) {
    await act(async () => {
      seen.refresh?.();
    });
    await waitFor(() => expect(screen.getByTestId("n")).toHaveTextContent("2"));
  }

  expect(
    seen.blanked,
    "the panel fell back to zero rows during a refresh",
  ).toBe(false);
  expect(seen.sawRefetching, "isRefetching was never observable").toBe(true);
});

test("a create shows up in a list that did not perform it", async () => {
  install({
    origin: APP_ORIGIN,
    integrations: [
      fakeIntegrationState({ id: "int-1", allowMultipleInstances: true }),
    ],
    configurations: { "int-1": { schema: { type: "object" } } },
  });

  const seen: { create: (() => void) | null } = { create: null };
  // Two siblings: the list never creates, and the button never reads the list.
  const List = () => {
    const q = useInstances({ integrationId: "int-1" });
    return (
      <span data-testid="ids">
        {q.status === "success"
          ? q.data.items.map(({ id }) => id).join(",")
          : ""}
      </span>
    );
  };
  const Activate = () => {
    const integration = useMarketplaceIntegration("int-1");
    seen.create = () =>
      void integration.actions.createInstance.execute({ name: "new one" });
    return (
      <span data-testid="can">
        {String(
          integration.status === "success" &&
            integration.data.permissions.createInstance.allowed,
        )}
      </span>
    );
  };

  render(
    <Tree>
      <List />
      <Activate />
    </Tree>,
  );
  await waitFor(() =>
    expect(screen.getByTestId("can")).toHaveTextContent("true"),
  );
  expect(screen.getByTestId("ids")).toHaveTextContent("");

  await act(async () => {
    seen.create?.();
  });

  // Without a membership refresh the list holds its stale entry and never sees the row.
  await waitFor(() =>
    expect(screen.getByTestId("ids").textContent).not.toBe(""),
  );
});

test("a refresh peaks at twice the steady-state stream count, on a 100-row list", async () => {
  const rows = 100;
  const f = install({
    origin: APP_ORIGIN,
    connections: Array.from({ length: rows }, (_, i) =>
      fakeConnectionState({ id: `c-${i}` }),
    ),
  });

  interface Seen {
    client: Client | null;
    refresh: (() => void) | null;
    refetching: boolean;
    count: number;
  }
  const seen: Seen = {
    client: null,
    refresh: null,
    refetching: false,
    count: 0,
  };
  const Capture = () => {
    seen.client = usePrismaticClient();
    return null;
  };
  const List = () => {
    const q = useConnections();
    seen.refresh = refreshOf(q);
    seen.refetching = isRefreshing(q);
    seen.count = itemIds(q).length;
    return null;
  };

  render(
    <Tree>
      <Capture />
      <List />
    </Tree>,
  );
  await waitFor(() => expect(seen.client).not.toBeNull());
  const client = seen.client as unknown as Client;
  await waitFor(() => expect(seen.count).toBe(rows));
  await settled(f);
  const steadyStreams = f.openStreams();
  const steadyExports = client.stats().exports;
  const steadyImports = client.stats().imports;

  let peakStreams = steadyStreams;
  let peakExports = steadyExports;
  let peakImports = steadyImports;
  await act(async () => {
    seen.refresh?.();
  });
  // Sampled repeatedly: the peak is a spike a few microtasks wide, not a state to wait for.
  for (let tick = 0; tick < 60; tick += 1) {
    peakStreams = Math.max(peakStreams, f.openStreams());
    peakExports = Math.max(peakExports, client.stats().exports);
    peakImports = Math.max(peakImports, client.stats().imports);
    if (tick > 6 && !seen.refetching) break;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  await waitFor(() => expect(seen.refetching).toBe(false));
  await settled(f);
  const trace = `steady ${steadyImports}i/${steadyExports}e/${steadyStreams}s, peak ${peakImports}i/${peakExports}e/${peakStreams}s`;

  // The disclosed cost, and it is the stream tables that carry it, not the import table:
  // the new rows' streams open before the old rows' cancels reach the frame, so exports and
  // open streams double while imports barely move. That overlap is what keeps the rows on
  // screen. Both come back down, so this is a spike rather than growth.
  expect(client.stats().imports, trace).toBe(steadyImports);
  expect(f.openStreams(), trace).toBe(steadyStreams);
  expect(peakStreams, trace).toBe(steadyStreams * 2);
  expect(peakExports, trace).toBe(steadyExports * 2 - 1);
});

test("an unmounted screen the user navigates back to costs no second load", async () => {
  const f = install({
    origin: APP_ORIGIN,
    integrations: [1, 2].map((n) => fakeIntegrationState({ id: `i-${n}` })),
  });

  const seen: {
    client: Client | null;
    ready: boolean;
    toggle: ((on: boolean) => void) | null;
  } = {
    client: null,
    ready: false,
    toggle: null,
  };
  const Capture = () => {
    seen.client = usePrismaticClient();
    return null;
  };
  const Grid = () => {
    const marketplace = useMarketplace();
    seen.ready = marketplace.status !== "loading";
    return (
      <span data-testid="n">
        {marketplace.status === "success" ? marketplace.data.items.length : 0}
      </span>
    );
  };
  const Host = () => {
    const [on, setOn] = useState(true);
    seen.toggle = setOn;
    return (
      <>
        <Capture />
        {on ? <Grid /> : <span data-testid="away">away</span>}
      </>
    );
  };

  render(
    <Tree>
      <Host />
    </Tree>,
  );
  await waitFor(() => expect(screen.getByTestId("n")).toHaveTextContent("2"));
  const client = seen.client as unknown as Client;
  await settled(f);

  const lists = countCalls(client, "api.marketplace.list()");
  await act(async () => {
    seen.toggle?.(false);
  });
  await waitFor(() => expect(screen.getByTestId("away")).toBeInTheDocument());
  await act(async () => {
    seen.toggle?.(true);
  });
  await waitFor(() => expect(screen.getByTestId("n")).toHaveTextContent("2"));
  lists.off();

  // Inside the idle window the entry is still there, so coming back is free.
  expect(lists.count(), "api.marketplace.list() calls on navigating back").toBe(
    0,
  );
});

test("refresh reloads the caller's key, not its whole family", async () => {
  const f = install({
    origin: APP_ORIGIN,
    connections: [
      fakeConnectionState({ id: "c-1", status: "ACTIVE" }),
      fakeConnectionState({ id: "c-2", status: "PENDING" }),
    ],
  });

  interface Seen {
    client: Client | null;
    refreshActive: (() => void) | null;
    ready: number;
  }
  const seen: Seen = { client: null, refreshActive: null, ready: 0 };
  const Capture = () => {
    seen.client = usePrismaticClient();
    return null;
  };
  // Two keys in one family: only the first is refreshed.
  const Active = () => {
    const q = useConnections({ status: "ACTIVE" });
    if (q.status !== "loading") seen.ready += 1;
    seen.refreshActive = refreshOf(q);
    return null;
  };
  const Pending = () => {
    const q = useConnections({ status: "PENDING" });
    if (q.status !== "loading") seen.ready += 1;
    return null;
  };

  render(
    <Tree>
      <Capture />
      <Active />
      <Pending />
    </Tree>,
  );
  await waitFor(() => expect(seen.client).not.toBeNull());
  const client = seen.client as unknown as Client;
  await waitFor(() => expect(seen.ready).toBeGreaterThanOrEqual(2));
  await settled(f);

  const lists = countCalls(client, "api.connections.list()");
  await act(async () => {
    seen.refreshActive?.();
  });
  await settled(f);
  lists.off();

  // One re-list, not two. F refreshed the whole prefix, so the sibling key reloaded too.
  expect(
    lists.count(),
    "api.connections.list() calls for one key's refresh",
  ).toBe(1);
});

test("a later resourceIdleMs applies to keys already counting down", async () => {
  const f = install({
    origin: APP_ORIGIN,
    connections: [fakeConnectionState({ id: "c-1" })],
  });

  const seen: { client: Client | null; ready: boolean } = {
    client: null,
    ready: false,
  };
  const Capture = () => {
    seen.client = usePrismaticClient();
    return null;
  };
  const List = () => {
    seen.ready = useConnections().status !== "loading";
    return null;
  };
  const Host = ({ mounted, idleMs }: { mounted: boolean; idleMs: number }) => (
    <Tree idleMs={idleMs}>
      <Capture />
      {mounted ? <List /> : null}
    </Tree>
  );

  // Mount, read, unmount with a window long enough that nothing is swept, then shorten it.
  const view = render(<Host mounted idleMs={60_000} />);
  await waitFor(() => expect(seen.ready).toBe(true));
  const client = seen.client as unknown as Client;
  await settled(f);
  const held = client.stats().imports;

  view.rerender(<Host mounted={false} idleMs={60_000} />);
  await settled(f);
  expect(client.stats().imports, "the long window released early").toBe(held);

  view.rerender(<Host mounted={false} idleMs={0} />);
  await settled(f);
  // Read once at construction, the shortened window would never reach this armed key.
  await waitFor(() => expect(client.stats().imports).toBeLessThan(held));
});

test("a same-identity token refresh keeps the cache, rather than re-listing", async () => {
  const f = install({
    origin: APP_ORIGIN,
    connections: [fakeConnectionState({ id: "c-1" })],
  });

  const seen: { client: Client | null; ready: boolean } = {
    client: null,
    ready: false,
  };
  const Capture = () => {
    seen.client = usePrismaticClient();
    return null;
  };
  const List = () => {
    seen.ready = useConnections().status !== "loading";
    return null;
  };
  const Host = ({ token }: { token: string }) => (
    <PrismaticProvider prismaticUrl={APP_ORIGIN} auth={{ token }}>
      <Capture />
      <List />
    </PrismaticProvider>
  );

  const view = render(<Host token="alice:t1" />);
  await waitFor(() => expect(seen.ready).toBe(true));
  const client = seen.client as unknown as Client;
  await settled(f);

  const lists = countCalls(client, "api.connections.list()");
  view.rerender(<Host token="alice:t2" />);
  await settled(f);
  lists.off();

  // The frame swaps the token underneath outstanding stubs for the same identity, so the
  // cached rows are still live and re-listing them would be pure waste.
  expect(
    lists.count(),
    "api.connections.list() calls after a same-identity refresh",
  ).toBe(0);
});

test("a token change to a different identity drops the whole cache", async () => {
  const f = install({
    origin: APP_ORIGIN,
    connections: [fakeConnectionState({ id: "c-1" })],
    integrations: [fakeIntegrationState({ id: "i-1" })],
  });

  const seen: { client: Client | null; ids: string } = {
    client: null,
    ids: "",
  };
  const Capture = () => {
    seen.client = usePrismaticClient();
    return null;
  };
  const List = () => {
    seen.ids = itemIds(useConnections()).join(",");
    return <span data-testid="ids">{seen.ids}</span>;
  };
  const Host = ({ token }: { token: string }) => (
    <PrismaticProvider prismaticUrl={APP_ORIGIN} auth={{ token }}>
      <Capture />
      <List />
    </PrismaticProvider>
  );

  const view = render(<Host token="alice:t1" />);
  await waitFor(() =>
    expect(screen.getByTestId("ids")).toHaveTextContent("c-1"),
  );
  const client = seen.client as unknown as Client;
  await settled(f);

  // A different identity revokes the session, so every cached stub is dead. The entry
  // cannot tell from its own stream — revocation closes it, and so does deleting the row —
  // but the identity the frame reports back does say, unambiguously.
  const lists = countCalls(client, "api.connections.list()");
  view.rerender(<Host token="bob:t1" />);
  await waitFor(() => expect(lists.count()).toBe(1));
  lists.off();

  // The rows come back, under the new prefix.
  await waitFor(() =>
    expect(screen.getByTestId("ids")).toHaveTextContent("c-1"),
  );
});
