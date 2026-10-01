import type {
  Client,
  ConnectionStub,
  RpcEvent,
} from "@prismatic-io/solis-core";
import { queryKey } from "@prismatic-io/solis-core/internal";
import {
  type FakeFrame,
  fakeConnectionState,
  fakeIntegrationState,
  installFakeFrame,
} from "@prismatic-io/solis-core/testing";
import { render, waitFor } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, expect, test } from "vitest";
import { useConnections } from "./domain/useConnections.js";
import { useMarketplace } from "./domain/useMarketplace.js";
import { useStableInput } from "./internal/input.js";
import { PrismaticProvider, usePrismaticClient } from "./PrismaticProvider.js";

const APP_ORIGIN = "https://app.example.com";

let frame: FakeFrame | undefined;
afterEach(() => {
  frame?.restore();
  frame = undefined;
});

/** Counts the calls whose label contains `needle`, from now until `off()`. */
const countCalls = (client: Client, needle: string) => {
  let calls = 0;
  const off = client.telemetry.subscribe((event: RpcEvent) => {
    if (event.kind === "call" && event.label.includes(needle)) calls += 1;
  });
  return { count: () => calls, off };
};

interface Harness {
  client: Client | null;
  bump: ((n: number) => void) | null;
  ready: boolean;
}

const mountWith = async (
  useSubject: () => { isPending: boolean },
): Promise<{ harness: Harness; unmount: () => void }> => {
  const harness: Harness = { client: null, bump: null, ready: false };

  const Probe = () => {
    const [n, setN] = useState(0);
    harness.bump = setN;
    harness.client = usePrismaticClient();
    harness.ready = !useSubject().isPending;
    return <span>{n}</span>;
  };

  const view = render(
    <PrismaticProvider prismaticUrl={APP_ORIGIN} auth={{ token: "jwt-1" }}>
      <Probe />
    </PrismaticProvider>,
  );
  await waitFor(() => expect(harness.ready).toBe(true));
  return { harness, unmount: view.unmount };
};

/** Five unrelated state bumps, each awaited so a refetch would have had time to fire. */
const rerenderFiveTimes = async (subject: {
  bump: ((n: number) => void) | null;
}) => {
  for (let i = 1; i <= 5; i += 1) {
    subject.bump?.(i);
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
};

test("an inline marketplace literal re-lists once across five unrelated re-renders", async () => {
  frame = installFakeFrame({
    origin: APP_ORIGIN,
    integrations: [fakeIntegrationState({ id: "i-1", name: "N1" })],
  });

  const { harness, unmount } = await mountWith(() => ({
    isPending: useMarketplace({ search: "" }).status === "loading",
  }));
  const client = harness.client as Client;

  const listed = countCalls(client, "marketplace.list");
  await rerenderFiveTimes(harness);
  listed.off();
  unmount();

  // Zero: the acquisition already happened before counting started, and none of the five
  // re-renders may add another.
  expect(listed.count()).toBe(0);
});

test("an inline connections filter re-lists once across five unrelated re-renders", async () => {
  frame = installFakeFrame({
    origin: APP_ORIGIN,
    connections: [fakeConnectionState({ id: "c-1" })],
  });

  const { harness, unmount } = await mountWith(() => ({
    isPending: useConnections({ status: "ACTIVE" }).status === "loading",
  }));
  const client = harness.client as Client;

  const listed = countCalls(client, "connections.list");
  await rerenderFiveTimes(harness);
  listed.off();
  unmount();

  expect(listed.count()).toBe(0);
});

test("changing a value inside the literal does re-list", async () => {
  frame = installFakeFrame({
    origin: APP_ORIGIN,
    integrations: [fakeIntegrationState({ id: "i-1", name: "N1" })],
  });

  const harness: Harness = { client: null, bump: null, ready: false };
  const Probe = () => {
    const [term, setTerm] = useState("");
    harness.bump = ((n: number) => setTerm(`t${n}`)) as (n: number) => void;
    harness.client = usePrismaticClient();
    harness.ready = useMarketplace({ search: term }).status !== "loading";
    return null;
  };
  const view = render(
    <PrismaticProvider prismaticUrl={APP_ORIGIN} auth={{ token: "jwt-1" }}>
      <Probe />
    </PrismaticProvider>,
  );
  await waitFor(() => expect(harness.ready).toBe(true));
  const client = harness.client as Client;

  const listed = countCalls(client, "marketplace.list");
  harness.bump?.(1);
  await waitFor(() => expect(listed.count()).toBeGreaterThan(0));
  listed.off();
  view.unmount();

  // A stable key that never moves is just as broken as one that always moves.
  expect(listed.count()).toBe(1);
});

test("an inline literal keys to one identity and moves when its meaning does", async () => {
  frame = installFakeFrame({ origin: APP_ORIGIN });

  const seen: {
    keys: string[];
    bump: ((n: number) => void) | null;
    term: string;
  } = {
    keys: [],
    bump: null,
    term: "",
  };
  const Probe = ({ term }: { term: string }) => {
    const [n, setN] = useState(0);
    seen.bump = setN;
    seen.keys.push(queryKey({ searchTerm: term, limit: 25 }));
    return <span>{n}</span>;
  };

  const view = render(<Probe term="" />);
  await rerenderFiveTimes(seen);

  const distinct = new Set(seen.keys);
  expect(distinct.size).toBe(1);
  expect(seen.keys.length).toBeGreaterThanOrEqual(6);

  view.rerender(<Probe term="a" />);
  expect(new Set(seen.keys).size).toBe(2);
  view.unmount();
});

test("a stub inside the literal is compared by identity while its siblings go by value", async () => {
  frame = installFakeFrame({
    origin: APP_ORIGIN,
    connections: [1, 2].map((n) => fakeConnectionState({ id: `c-${n}` })),
  });

  const seen: {
    keys: string[];
    bump: ((n: number) => void) | null;
    stubs: (ConnectionStub | undefined)[];
  } = { keys: [], bump: null, stubs: [] };

  const Probe = ({ pick }: { pick: number }) => {
    const [n, setN] = useState(0);
    seen.bump = setN;
    const client = usePrismaticClient();
    const listed = useConnections().status === "success";
    const [stubs, setStubs] = useState<readonly ConnectionStub[]>([]);
    useEffect(() => {
      const api = client?.authenticated;
      if (!listed || !api) return;
      void (
        api.connections.list() as unknown as Promise<ConnectionStub[]>
      ).then(setStubs);
    }, [listed, client]);
    const stub = stubs[pick];
    seen.stubs.push(stub);
    // Passing a stub through the key builder must not enumerate it, which would issue RPC
    // from render, and must not collapse two rows onto one key.
    seen.keys.push(queryKey({ stub, limit: 25 }));
    return <span>{n}</span>;
  };

  const view = render(
    <PrismaticProvider prismaticUrl={APP_ORIGIN} auth={{ token: "jwt-1" }}>
      <Probe pick={0} />
    </PrismaticProvider>,
  );
  await waitFor(() => expect(seen.stubs.at(-1)).toBeDefined());

  const settledOnFirst = seen.keys.at(-1) as string;
  await rerenderFiveTimes(seen);
  expect(seen.keys.at(-1)).toBe(settledOnFirst);

  view.rerender(
    <PrismaticProvider prismaticUrl={APP_ORIGIN} auth={{ token: "jwt-1" }}>
      <Probe pick={1} />
    </PrismaticProvider>,
  );
  await waitFor(() => expect(seen.keys.at(-1)).not.toBe(settledOnFirst));
  view.unmount();
});

test("useStableInput holds one object identity across five unrelated re-renders", async () => {
  frame = installFakeFrame({ origin: APP_ORIGIN });

  const seen: { inputs: object[]; bump: ((n: number) => void) | null } = {
    inputs: [],
    bump: null,
  };
  const Probe = ({ term }: { term: string }) => {
    const [n, setN] = useState(0);
    seen.bump = setN;
    seen.inputs.push(useStableInput({ searchTerm: term, limit: 25 }));
    return <span>{n}</span>;
  };

  const view = render(<Probe term="" />);
  await rerenderFiveTimes(seen);

  const first = seen.inputs[0] as object;
  // Identity, not equality: an effect keyed on this must not re-run.
  expect(seen.inputs.every((input) => input === first)).toBe(true);

  view.rerender(<Probe term="a" />);
  expect(seen.inputs.at(-1)).not.toBe(first);
  expect(seen.inputs.at(-1)).toEqual({ searchTerm: "a", limit: 25 });
  view.unmount();
});
