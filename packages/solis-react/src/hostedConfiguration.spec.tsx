import {
  type Client,
  createClient,
  type OpenVisibleFrameOptions,
} from "@prismatic-io/solis-core";
import {
  type FakeFrame,
  fakeInstanceState,
  fakeIntegrationState,
  installFakeFrame,
} from "@prismatic-io/solis-core/testing";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";
import {
  HostedConfiguration,
  PrismaticProvider,
  useInstance,
  useMarketplace,
} from "./index.js";

const origin = "https://app.example.com";
const instanceId = "instance/one";
const integrationId = "integration-one";
let frame: FakeFrame;
let client: Client;

afterEach(() => {
  cleanup();
  client?.dispose();
  frame?.restore();
  vi.restoreAllMocks();
});

const boot = async () => {
  frame = installFakeFrame({
    origin,
    integrations: [fakeIntegrationState({ id: integrationId, name: "One" })],
    instances: [
      fakeInstanceState({
        id: instanceId,
        integrationId,
        name: "Before",
        deployed: true,
      }),
    ],
  });
  client = await createClient({ prismaticUrl: origin, jwt: "alice:t1" });
};

/** Stands in for the wizard's handshake, which needs a real Prismatic origin. */
const interceptWizard = ({ opens = true }: { opens?: boolean } = {}) => {
  const launched: OpenVisibleFrameOptions[] = [];
  const dispose = vi.fn();
  vi.spyOn(client, "openVisibleFrame").mockImplementation((options) => {
    launched.push(options);
    const iframe = document.createElement("iframe");
    options.container.append(iframe);
    return opens ? Promise.resolve({ iframe, dispose }) : new Promise(() => {});
  });
  const latest = () => {
    const options = launched.at(-1);
    if (!options) throw new Error("The wizard was never opened");
    return options;
  };
  return { launched, latest, dispose };
};

const Wrapper = ({ children }: { children: ReactNode }) => (
  <PrismaticProvider client={client} resourceIdleMs={0}>
    {children}
  </PrismaticProvider>
);

test("renders the wizard for the instance inside its own container", async () => {
  await boot();
  const wizard = interceptWizard();
  const { container } = render(
    <HostedConfiguration instanceId={instanceId} className="wizard" />,
    { wrapper: Wrapper },
  );
  await waitFor(() => expect(wizard.launched).toHaveLength(1));
  const host = container.firstElementChild;
  expect(host?.className).toBe("wizard");
  expect(wizard.latest().container).toBe(host);
  expect(host?.querySelector("iframe")).not.toBeNull();
  expect(wizard.latest().url).toBe(
    "/configure-instance/instance%2Fone/?reconfigure=true",
  );
});

test("passes the wizard's events, errors and close to the host's latest callbacks", async () => {
  await boot();
  const wizard = interceptWizard();
  const stale = { onEvent: vi.fn(), onError: vi.fn(), onClose: vi.fn() };
  const current = { onEvent: vi.fn(), onError: vi.fn(), onClose: vi.fn() };
  const { rerender } = render(
    <HostedConfiguration instanceId={instanceId} {...stale} />,
    { wrapper: Wrapper },
  );
  await waitFor(() => expect(wizard.launched).toHaveLength(1));
  rerender(<HostedConfiguration instanceId={instanceId} {...current} />);
  const event = { event: "INSTANCE_CONFIGURATION_LOADED", futureField: true };
  const error = new Error("Could not reconcile");
  act(() => {
    wizard.latest().onEmbeddedEvent?.(event);
    wizard.latest().onError?.(error);
    wizard.latest().onClose?.();
  });
  expect(current.onEvent).toHaveBeenCalledExactlyOnceWith(event);
  expect(current.onError).toHaveBeenCalledExactlyOnceWith(error);
  expect(current.onClose).toHaveBeenCalledOnce();
  expect(stale.onEvent).not.toHaveBeenCalled();
  expect(wizard.launched).toHaveLength(1);
});

test("removes the wizard when the host unmounts it, even while it is still opening", async () => {
  await boot();
  const opened = interceptWizard();
  const first = render(<HostedConfiguration instanceId={instanceId} />, {
    wrapper: Wrapper,
  });
  await waitFor(() => expect(opened.launched).toHaveLength(1));
  await act(async () => {});
  first.unmount();
  expect(opened.dispose).toHaveBeenCalledOnce();

  vi.restoreAllMocks();
  const opening = interceptWizard({ opens: false });
  const second = render(<HostedConfiguration instanceId={instanceId} />, {
    wrapper: Wrapper,
  });
  await waitFor(() => expect(opening.launched).toHaveLength(1));
  const { signal } = opening.latest();
  expect(signal?.aborted).toBe(false);
  second.unmount();
  expect(signal?.aborted).toBe(true);
});

test("reopens the wizard for a different instance, removing the previous one", async () => {
  await boot();
  const wizard = interceptWizard();
  const { rerender } = render(<HostedConfiguration instanceId={instanceId} />, {
    wrapper: Wrapper,
  });
  await waitFor(() => expect(wizard.launched).toHaveLength(1));
  await act(async () => {});
  rerender(<HostedConfiguration instanceId="instance-two" />);
  await waitFor(() => expect(wizard.launched).toHaveLength(2));
  expect(wizard.dispose).toHaveBeenCalledOnce();
  expect(wizard.latest().url).toBe(
    "/configure-instance/instance-two/?reconfigure=true",
  );
});

test("reports a wizard that fails to open", async () => {
  await boot();
  vi.spyOn(client, "openVisibleFrame").mockRejectedValue(
    new Error("Visible frame did not complete its channel handshake"),
  );
  const onError = vi.fn();
  render(<HostedConfiguration instanceId={instanceId} onError={onError} />, {
    wrapper: Wrapper,
  });
  await waitFor(() =>
    expect(onError).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        message: "Visible frame did not complete its channel handshake",
      }),
    ),
  );
});

const listingNames = (marketplace?: ReturnType<typeof useMarketplace>) =>
  marketplace?.status === "success"
    ? marketplace.data.items.flatMap((item) =>
        item.status === "success" ? [item.data.name] : [],
      )
    : undefined;

test("refreshes the instance and marketplace reads a wizard change affected", async () => {
  await boot();
  const wizard = interceptWizard();
  const reads: {
    instance?: ReturnType<typeof useInstance>;
    marketplace?: ReturnType<typeof useMarketplace>;
  } = {};
  const Screen = () => {
    reads.instance = useInstance(instanceId);
    reads.marketplace = useMarketplace();
    return <HostedConfiguration instanceId={instanceId} />;
  };
  render(<Screen />, { wrapper: Wrapper });
  await waitFor(() => {
    expect(reads.instance?.status).toBe("success");
    expect(listingNames(reads.marketplace)).toEqual(["One"]);
  });
  await waitFor(() => expect(wizard.launched).toHaveLength(1));
  frame.instances.set({
    ...fakeInstanceState({
      id: instanceId,
      integrationId,
      name: "After",
      deployed: true,
    }),
  });
  frame.integrations.set(fakeIntegrationState({ id: "two", name: "Two" }));
  act(() => wizard.latest().onResourcesChanged?.());
  await waitFor(() => {
    const instance = reads.instance;
    expect(instance?.status === "success" && instance.data.name).toBe("After");
    expect(listingNames(reads.marketplace)).toEqual(
      expect.arrayContaining(["One", "Two"]),
    );
  });
});

test("keeps the wizard open when the session token refreshes", async () => {
  await boot();
  const wizard = interceptWizard();
  const Host = ({ token }: { token: string }) => (
    <PrismaticProvider client={client} auth={{ token }} resourceIdleMs={0}>
      <HostedConfiguration instanceId={instanceId} />
    </PrismaticProvider>
  );
  const { rerender } = render(<Host token="alice:t1" />);
  await waitFor(() => expect(wizard.launched).toHaveLength(1));
  await act(async () => {});
  rerender(<Host token="alice:t2" />);
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  expect(wizard.launched).toHaveLength(1);
  expect(wizard.dispose).not.toHaveBeenCalled();
});
