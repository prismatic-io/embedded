import { type Client, createClient } from "@prismatic-io/solis-core";
import { STATE_RELEASE_GRACE_MS } from "@prismatic-io/solis-core/internal";
import {
  type FakeFrame,
  fakeIntegrationState,
  installFakeFrame,
} from "@prismatic-io/solis-core/testing";
import { render, waitFor } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { useMarketplace } from "./domain/useMarketplace.js";
import {
  PrismaticProvider,
  usePrismatic,
  usePrismaticClient,
} from "./PrismaticProvider.js";

const itemCount = (list: ReturnType<typeof useMarketplace>) =>
  list.status === "success" ? list.data.items.length : 0;

const APP_ORIGIN = "https://app.example.com";

let frame: FakeFrame | undefined;
afterEach(() => {
  frame?.restore();
  frame = undefined;
});

const seedFrame = () =>
  installFakeFrame({
    origin: APP_ORIGIN,
    integrations: [1, 2].map((n) =>
      fakeIntegrationState({ id: `i-${n}`, name: `N${n}` }),
    ),
  });

/** Whether the client still answers, which a disposed session cannot. */
const stillUsable = async (client: Client): Promise<boolean> => {
  try {
    const handle = client.authenticate("jwt-after");
    const page = await handle.marketplace.list({ limit: 5 });
    const count = page.integrations.length;
    page[Symbol.dispose]();
    return count > 0;
  } catch {
    return false;
  }
};

test("the provider uses a client the host booted rather than booting its own", async () => {
  frame = seedFrame();
  const client = await createClient({ prismaticUrl: APP_ORIGIN, jwt: "jwt-1" });
  const portsAfterBoot = frame.portCount();

  const seen: { client: Client | null; rows: number } = {
    client: null,
    rows: 0,
  };
  const Probe = () => {
    seen.client = usePrismaticClient();
    seen.rows = itemCount(useMarketplace());
    return null;
  };

  const view = render(
    <PrismaticProvider client={client}>
      <Probe />
    </PrismaticProvider>,
  );
  await waitFor(() => expect(seen.rows).toBe(2));

  expect(seen.client).toBe(client);
  // A second iframe would mean the provider booted anyway and the host's client is dead
  // weight paying for a duplicate session.
  expect(frame.portCount()).toBe(portsAfterBoot);

  view.unmount();
  client.dispose();
});

test("unmounting the provider leaves the host's client live and usable", async () => {
  frame = seedFrame();
  const client = await createClient({ prismaticUrl: APP_ORIGIN, jwt: "jwt-1" });

  const seen: { rows: number } = { rows: 0 };
  const Probe = () => {
    seen.rows = itemCount(useMarketplace());
    return null;
  };
  const view = render(
    <PrismaticProvider client={client}>
      <Probe />
    </PrismaticProvider>,
  );
  await waitFor(() => expect(seen.rows).toBe(2));

  view.unmount();

  await expect(stillUsable(client)).resolves.toBe(true);
  client.dispose();
  // And the host's own dispose still works, so ownership really did stay with the host.
  await expect(stillUsable(client)).resolves.toBe(false);
});

test("an attached provider releases every stub it acquired, and nothing more", async () => {
  frame = seedFrame();
  const client = await createClient({ prismaticUrl: APP_ORIGIN, jwt: "jwt-1" });
  const f = frame;

  const settle = async () => {
    await new Promise((resolve) =>
      setTimeout(resolve, STATE_RELEASE_GRACE_MS * 2),
    );
    await f.flushStreams();
    const { imports, exports } = client.stats();
    return { imports, exports, streams: f.openStreams() };
  };

  const baseline = await settle();
  const seen: { rows: number } = { rows: 0 };
  const Probe = () => {
    seen.rows = itemCount(useMarketplace());
    return null;
  };

  let peakStreams = baseline.streams;
  let peakImports = baseline.imports;
  const settled: Awaited<ReturnType<typeof settle>>[] = [];

  for (let cycle = 0; cycle < 3; cycle += 1) {
    seen.rows = 0;
    const view = render(
      <PrismaticProvider client={client}>
        <Probe />
      </PrismaticProvider>,
    );
    await waitFor(() => expect(seen.rows).toBe(2));
    await waitFor(() =>
      expect(f.openStreams()).toBeGreaterThan(baseline.streams),
    );
    peakStreams = Math.max(peakStreams, f.openStreams());
    peakImports = Math.max(peakImports, client.stats().imports);
    view.unmount();
    settled.push(await settle());
  }

  const trace = settled
    .map(
      (s) => `imports=${s.imports} exports=${s.exports} streams=${s.streams}`,
    )
    .join(" | ");

  // A flat count proves nothing unless a mounted cycle actually acquired something.
  expect(peakStreams, `no stream ever opened: ${trace}`).toBeGreaterThan(
    baseline.streams,
  );
  expect(peakImports, `no stub was ever acquired: ${trace}`).toBeGreaterThan(
    baseline.imports,
  );

  for (const [index, s] of settled.entries()) {
    expect(s.imports, `imports grew by cycle ${index}: ${trace}`).toBe(
      baseline.imports,
    );
    expect(s.streams, `streams grew by cycle ${index}: ${trace}`).toBe(
      baseline.streams,
    );
    expect(s.exports, `exports grew by cycle ${index}: ${trace}`).toBe(
      baseline.exports,
    );
  }

  // The whole point of attaching: three mount/unmount cycles later the client is still the
  // host's to use.
  await expect(stillUsable(client)).resolves.toBe(true);
  client.dispose();
});

test("an attached provider authenticates a jwt the host passes alongside the client", async () => {
  frame = seedFrame();
  const client = await createClient({ prismaticUrl: APP_ORIGIN });

  const seen: { authed: boolean; rows: number } = { authed: false, rows: 0 };
  const Probe = () => {
    seen.authed = usePrismatic().status === "success";
    seen.rows = itemCount(useMarketplace());
    return null;
  };

  const view = render(
    <PrismaticProvider client={client} auth={{ token: "jwt-1" }}>
      <Probe />
    </PrismaticProvider>,
  );
  await waitFor(() => expect(seen.rows).toBe(2));
  expect(seen.authed).toBe(true);

  view.unmount();
  await expect(stillUsable(client)).resolves.toBe(true);
  client.dispose();
});

test("an attached client with no jwt exposes the client while the session stays loading", async () => {
  frame = seedFrame();
  const client = await createClient({ prismaticUrl: APP_ORIGIN });

  const seen: { status: string; client: Client | null } = {
    status: "",
    client: null,
  };
  const Probe = () => {
    seen.status = usePrismatic().status;
    seen.client = usePrismaticClient();
    return null;
  };
  const view = render(
    <PrismaticProvider client={client}>
      <Probe />
    </PrismaticProvider>,
  );

  await waitFor(() => expect(seen.client).toBe(client));
  expect(seen.status).toBe("loading");

  view.unmount();
  client.dispose();
});

test("swapping the attached client republishes the session without disposing the first", async () => {
  frame = seedFrame();
  const first = await createClient({ prismaticUrl: APP_ORIGIN, jwt: "jwt-1" });
  const second = await createClient({ prismaticUrl: APP_ORIGIN, jwt: "jwt-1" });

  const seen: { client: Client | null; rows: number } = {
    client: null,
    rows: 0,
  };
  const Probe = () => {
    seen.client = usePrismaticClient();
    seen.rows = itemCount(useMarketplace());
    return null;
  };
  const Tree = ({ client }: { client: Client }) => (
    <PrismaticProvider client={client}>
      <Probe />
    </PrismaticProvider>
  );

  const view = render(<Tree client={first} />);
  await waitFor(() => expect(seen.client).toBe(first));
  await waitFor(() => expect(seen.rows).toBe(2));

  seen.rows = 0;
  view.rerender(<Tree client={second} />);
  await waitFor(() => expect(seen.client).toBe(second));
  await waitFor(() => expect(seen.rows).toBe(2));

  await expect(stillUsable(first)).resolves.toBe(true);
  view.unmount();
  first.dispose();
  second.dispose();
});

test("the two provider forms cannot be mixed", async () => {
  frame = seedFrame();
  const client = await createClient({ prismaticUrl: APP_ORIGIN });

  // Each directive IS the assertion: tsc reports TS2578 for an unused one, so this file
  // stops compiling if ownership ever becomes ambiguous again. `children` is supplied on
  // every one, or a missing-children error would satisfy the directive on its own and the
  // union could be collapsed without any of these noticing.
  void (
    (
      // @ts-expect-error a url and a client together leave ownership undecided
      <PrismaticProvider client={client} prismaticUrl={APP_ORIGIN}>
        {null}
      </PrismaticProvider>
    )
  );
  // @ts-expect-error neither form supplies a session
  void (<PrismaticProvider>{null}</PrismaticProvider>);
  void (
    (
      // @ts-expect-error an attached client owns its iframe; container belongs to the booter
      <PrismaticProvider client={client} container={document.body}>
        {null}
      </PrismaticProvider>
    )
  );

  client.dispose();
  expect(client.authenticated).toBeNull();
});
