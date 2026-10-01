/** The `auth` prop: token-keyed, so an inline literal is not a reboot. */

import {
  type FakeFrame,
  fakeIntegrationState,
  installFakeFrame,
} from "@prismatic-io/solis-core/testing";
import { act, render, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { useMarketplace } from "./domain/useMarketplace.js";
import { PrismaticProvider, usePrismatic } from "./PrismaticProvider.js";

const itemCount = (list: ReturnType<typeof useMarketplace>) =>
  list.status === "success" ? list.data.items.length : 0;

const APP_ORIGIN = "https://app.example.com";

let frame: FakeFrame | undefined;
afterEach(() => {
  frame?.restore();
  frame = undefined;
  vi.restoreAllMocks();
});

const seedFrame = () =>
  installFakeFrame({
    origin: APP_ORIGIN,
    integrations: [fakeIntegrationState({ id: "i-1", name: "N1" })],
  });

test("auth={{ token }} authenticates the session and warns about nothing", async () => {
  frame = seedFrame();
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

  let authenticated = false;
  const Probe = () => {
    authenticated = usePrismatic().status === "success";
    return null;
  };

  render(
    <PrismaticProvider prismaticUrl={APP_ORIGIN} auth={{ token: "jwt-1" }}>
      <Probe />
    </PrismaticProvider>,
  );

  await waitFor(() => expect(authenticated).toBe(true));
  expect(warn).not.toHaveBeenCalled();
});

test("a fresh auth literal on every render boots one iframe and authenticates once", async () => {
  frame = seedFrame();

  let rerender = () => {};
  let rows = 0;
  const Probe = () => {
    rows = itemCount(useMarketplace());
    return null;
  };
  // A new object every render, which is how a host would naturally write it.
  const Host = () => {
    const [, setTick] = useState(0);
    rerender = () => setTick((n) => n + 1);
    return (
      <PrismaticProvider prismaticUrl={APP_ORIGIN} auth={{ token: "jwt-1" }}>
        <Probe />
      </PrismaticProvider>
    );
  };

  render(<Host />);
  await waitFor(() => expect(rows).toBe(1));
  const portsAfterBoot = frame.portCount();
  const authsAfterBoot = frame.authCount();

  // Each render is committed and its effects flushed separately; batching all five into
  // one commit would hide a per-render reboot.
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      rerender();
    });
  }

  // Depending on the object would rebuild the iframe and re-authenticate every render.
  expect(frame.portCount()).toBe(portsAfterBoot);
  expect(frame.authCount()).toBe(authsAfterBoot);
});

test("changing auth.token re-authenticates without rebooting the iframe", async () => {
  frame = seedFrame();

  let setToken = (_: string) => {};
  let rows = 0;
  const Probe = () => {
    rows = itemCount(useMarketplace());
    return null;
  };
  const Host = () => {
    const [token, set] = useState("jwt-1");
    setToken = set;
    return (
      <PrismaticProvider prismaticUrl={APP_ORIGIN} auth={{ token }}>
        <Probe />
      </PrismaticProvider>
    );
  };

  render(<Host />);
  await waitFor(() => expect(rows).toBe(1));
  const portsAfterBoot = frame.portCount();
  const authsAfterBoot = frame.authCount();

  await act(async () => {
    setToken("jwt-2");
  });

  expect(frame.authCount()).toBe(authsAfterBoot + 1);
  expect(frame.portCount()).toBe(portsAfterBoot);
});

test("telemetry and clientMeta reach the client the provider boots", async () => {
  const onHandshake = vi.fn();
  frame = installFakeFrame({
    origin: APP_ORIGIN,
    integrations: [fakeIntegrationState({ id: "i-1", name: "N1" })],
    onHandshake,
  });
  const telemetry = vi.fn();

  let authenticated = false;
  const Probe = () => {
    authenticated = usePrismatic().status === "success";
    return null;
  };

  render(
    <PrismaticProvider
      prismaticUrl={APP_ORIGIN}
      auth={{ token: "jwt-1" }}
      telemetry={telemetry}
      clientMeta={{ surface: "hybrid" }}
    >
      <Probe />
    </PrismaticProvider>,
  );
  await waitFor(() => expect(authenticated).toBe(true));

  expect(onHandshake).toHaveBeenCalledWith(
    expect.objectContaining({ meta: { surface: "hybrid" } }),
  );
  expect(telemetry).toHaveBeenCalled();
});
