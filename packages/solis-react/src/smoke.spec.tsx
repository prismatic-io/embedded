import type { Client } from "@prismatic-io/solis-core";
import {
  type FakeFrame,
  FakePrismaticApi,
  fakeConnectionState,
  fakeInstanceState,
  fakeIntegrationState,
  installFakeFrame,
} from "@prismatic-io/solis-core/testing";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { useAuthenticatedUser } from "./domain/useAuthenticatedUser.js";
import { useConfiguration } from "./domain/useConfiguration.js";
import { useConnections } from "./domain/useConnections.js";
import { useInstances } from "./domain/useInstances.js";
import { useMarketplace } from "./domain/useMarketplace.js";
import {
  PrismaticProvider,
  usePrismatic,
  usePrismaticClient,
} from "./PrismaticProvider.js";

const APP_ORIGIN = "https://app.example.com";

let frame: FakeFrame | undefined;
afterEach(() => {
  frame?.restore();
  frame = undefined;
});

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <PrismaticProvider prismaticUrl={APP_ORIGIN} auth={{ token: "jwt-1" }}>
    {children}
  </PrismaticProvider>
);

test("usePrismatic loads until the session is confirmed, then reports what the frame announced", async () => {
  frame = installFakeFrame({ origin: APP_ORIGIN });
  const statuses: string[] = [];
  let session: ReturnType<typeof usePrismatic> | undefined;
  const Probe = () => {
    session = usePrismatic();
    statuses.push(session.status);
    return null;
  };

  render(<Probe />, { wrapper: Wrapper });

  expect(statuses[0]).toBe("loading");
  await waitFor(() => expect(session?.status).toBe("success"));
  if (session?.status !== "success") throw new Error("unreachable");
  expect(session.data.serverInfo.protocol).toBeTruthy();
  expect(session.data.hasFeature("connections")).toBe(true);
  expect(statuses).not.toContain("error");

  const refreshed = await session.actions.refresh.execute();
  expect(refreshed).toEqual({ status: "success", data: undefined });
  await waitFor(() =>
    expect(session).toMatchObject({ status: "success", isRefreshing: false }),
  );
});

test("a failed usePrismatic refresh stays success and keeps cached data", async () => {
  frame = installFakeFrame({ origin: APP_ORIGIN });
  let session: ReturnType<typeof usePrismatic> | undefined;
  let user: ReturnType<typeof useAuthenticatedUser> | undefined;
  const Probe = () => {
    session = usePrismatic();
    user = useAuthenticatedUser();
    return null;
  };

  render(<Probe />, { wrapper: Wrapper });
  await waitFor(() => expect(session?.status).toBe("success"));
  await waitFor(() => expect(user?.status).toBe("success"));

  const message = "scope unavailable";
  vi.spyOn(FakePrismaticApi.prototype, "getSessionScope").mockRejectedValueOnce(
    new Error(message),
  );
  const refreshed = await session?.actions.refresh.execute();

  expect(refreshed).toMatchObject({ status: "error", error: { message } });
  await waitFor(() =>
    expect(session).toMatchObject({
      status: "success",
      isRefreshing: false,
      actions: { refresh: { status: "error", error: { message } } },
    }),
  );
  expect(user).toMatchObject({ status: "success", data: { name: "Dev User" } });
});

test("usePrismatic reports a boot failure as its error", async () => {
  let session: ReturnType<typeof usePrismatic> | undefined;
  const Probe = () => {
    session = usePrismatic();
    return null;
  };

  render(
    <PrismaticProvider
      prismaticUrl={APP_ORIGIN}
      auth={{ token: "jwt-1" }}
      timeoutMs={20}
      onError={() => {}}
    >
      <Probe />
    </PrismaticProvider>,
  );

  await waitFor(() => expect(session?.status).toBe("error"));
  if (session?.status !== "error") throw new Error("unreachable");
  expect(session.error.code).toBe("PRISMATIC_UNKNOWN");
  expect(session.error.message).toBeTruthy();
});

test("useAuthenticatedUser is a resource with a refresh action", async () => {
  frame = installFakeFrame({ origin: APP_ORIGIN });
  let user: ReturnType<typeof useAuthenticatedUser> | undefined;
  const Probe = () => {
    user = useAuthenticatedUser();
    return null;
  };

  render(<Probe />, { wrapper: Wrapper });

  expect(user?.status).toBe("loading");
  await waitFor(() =>
    expect(user).toMatchObject({
      status: "success",
      data: { name: "Dev User" },
      isRefreshing: false,
    }),
  );
  const refreshed = await user?.actions.refresh.execute();
  expect(refreshed).toEqual({ status: "success", data: undefined });
  expect(user).toMatchObject({ status: "success", data: { name: "Dev User" } });
});

test("useMarketplace renders plain data and never exposes a stub", async () => {
  frame = installFakeFrame({
    origin: APP_ORIGIN,
    integrations: [
      fakeIntegrationState({ id: "int-1", name: "Alpha" }),
      fakeIntegrationState({ id: "int-2", name: "Beta" }),
    ],
  });

  const Grid = () => {
    const marketplace = useMarketplace({ search: "" });
    if (marketplace.status === "loading") return <p>loading</p>;
    if (marketplace.status === "error")
      return <p>{marketplace.error.message}</p>;
    return (
      <ul>
        {marketplace.data.items.map((item) => (
          <li key={item.id}>
            {item.status === "success" ? item.data.name : item.status}
          </li>
        ))}
      </ul>
    );
  };

  render(<Grid />, { wrapper: Wrapper });
  await waitFor(() => expect(screen.getByText("Alpha")).toBeInTheDocument());
  expect(screen.getByText("Beta")).toBeInTheDocument();
});

test("useConnections filters through the frame when the feature is announced", async () => {
  frame = installFakeFrame({
    origin: APP_ORIGIN,
    connections: [
      fakeConnectionState({ id: "c-1", status: "ACTIVE" }),
      fakeConnectionState({ id: "c-2", status: "PENDING" }),
    ],
  });

  const List = () => {
    const session = usePrismatic();
    const q = useConnections({ status: "ACTIVE" });
    if (q.status === "loading") return <p>loading</p>;
    if (q.status === "error") return <p>{q.error.message}</p>;
    return (
      <div>
        <span data-testid="mode">
          {String(
            session.status === "success" &&
              session.data.hasFeature("connections.listFilter"),
          )}
        </span>
        <span data-testid="ids">{q.data.items.map((c) => c.id).join(",")}</span>
      </div>
    );
  };

  render(<List />, { wrapper: Wrapper });
  await waitFor(() =>
    expect(screen.getByTestId("ids")).toHaveTextContent("c-1"),
  );
  expect(screen.getByTestId("ids")).not.toHaveTextContent("c-2");
  expect(screen.getByTestId("mode")).toHaveTextContent("true");
});

test("useConfiguration reads the definition and saves explicit host values", async () => {
  frame = installFakeFrame({
    origin: APP_ORIGIN,
    integrations: [fakeIntegrationState({ id: "int-1" })],
    configurations: {
      "int-1": {
        schema: { type: "object" },
        configurationVersion: "definition-1",
      },
    },
    instances: [
      {
        ...fakeInstanceState({
          id: "inst-1",
          integrationId: "int-1",
          deployed: true,
        }),
        value: { a: 1 },
      },
    ],
  });

  let saved: string | undefined;
  const Form = () => {
    const c = useConfiguration({ instanceId: "inst-1" });
    if (c.status === "loading") return <p>loading</p>;
    if (c.status === "error") return <p>{c.error.message}</p>;
    return (
      <div>
        <span data-testid="configuration-version">
          {c.data.configurationVersion}
        </span>
        <button
          type="button"
          onClick={async () => {
            saved = (await c.actions.save.execute({ value: { a: 2 } })).status;
          }}
        >
          save
        </button>
      </div>
    );
  };

  const { getByText } = render(<Form />, { wrapper: Wrapper });
  await waitFor(() =>
    expect(screen.getByTestId("configuration-version")).toHaveTextContent(
      "definition-1",
    ),
  );
  getByText("save").click();
  await waitFor(() => expect(saved).toBe("success"));
  expect(frame.instances.get("inst-1")?.value).toEqual({ a: 2 });
});

test("useConfiguration reaches a never-deployed instance by its id", async () => {
  frame = installFakeFrame({
    origin: APP_ORIGIN,
    integrations: [fakeIntegrationState({ id: "int-1" })],
    configurations: {
      "int-1": {
        schema: { type: "object" },
        configurationVersion: "definition-1",
      },
    },
    instances: [
      fakeInstanceState({
        id: "undeployed-1",
        integrationId: "int-1",
        deployed: false,
      }),
    ],
  });

  const Form = () => {
    const c = useConfiguration({ instanceId: "undeployed-1" });
    if (c.status === "loading") return <p>loading</p>;
    if (c.status === "error") return <p>{c.error.message}</p>;
    return (
      <span data-testid="configuration-version">
        {c.data.configurationVersion}
      </span>
    );
  };

  render(<Form />, { wrapper: Wrapper });
  await waitFor(() =>
    expect(screen.getByTestId("configuration-version")).toHaveTextContent(
      "definition-1",
    ),
  );
});

test("useInstances lists never-deployed and deployed instances together", async () => {
  frame = installFakeFrame({
    origin: APP_ORIGIN,
    integrations: [fakeIntegrationState({ id: "int-1" })],
    configurations: { "int-1": { schema: { type: "object" } } },
    instances: [
      fakeInstanceState({
        id: "inst-1",
        integrationId: "int-1",
        deployed: true,
        configState: "FULLY_CONFIGURED",
      }),
      fakeInstanceState({
        id: "inst-2",
        integrationId: "int-1",
        deployed: false,
      }),
    ],
  });

  const List = ({ integrationId }: { integrationId?: string }) => {
    const q = useInstances(integrationId ? { integrationId } : {});
    if (q.status === "loading") return <p>loading</p>;
    if (q.status === "error") return <p>{q.error.message}</p>;
    return (
      <span data-testid={`ids-${integrationId ?? "all"}`}>
        {q.data.items
          .map((i) =>
            i.status === "success" ? `${i.id}:${i.data.lifecycle}` : i.id,
          )
          .join(",")}
      </span>
    );
  };

  render(
    <>
      <List integrationId="int-1" />
      <List />
    </>,
    { wrapper: Wrapper },
  );
  for (const testId of ["ids-int-1", "ids-all"]) {
    await waitFor(() =>
      expect(screen.getByTestId(testId)).toHaveTextContent("inst-1:active"),
    );
    expect(screen.getByTestId(testId)).toHaveTextContent("inst-2:notDeployed");
  }
});

test("a list hook disposes every row's stub, not just the page", async () => {
  frame = installFakeFrame({
    origin: APP_ORIGIN,
    connections: [
      fakeConnectionState({ id: "c-1" }),
      fakeConnectionState({ id: "c-2" }),
      fakeConnectionState({ id: "c-3" }),
    ],
  });

  const seen: { client: Client | null } = { client: null };
  const List = () => {
    const q = useConnections();
    if (q.status === "loading") return <p>loading</p>;
    if (q.status === "error") return <p>{q.error.message}</p>;
    return <span data-testid="n">{q.data.items.length}</span>;
  };
  // The list is unmounted on its own, leaving the session up: disposing the client would
  // release everything and prove nothing about per-row ownership. `resourceIdleMs={0}` is
  // what makes the drop observable — the cache holds an unobserved entry until its idle
  // window elapses, which is the whole point of it.
  const Host = ({ showList }: { showList: boolean }) => {
    seen.client = usePrismaticClient();
    return showList ? <List /> : <span data-testid="gone">gone</span>;
  };
  const Tree = ({ showList }: { showList: boolean }) => (
    <PrismaticProvider
      prismaticUrl={APP_ORIGIN}
      auth={{ token: "jwt-1" }}
      resourceIdleMs={0}
    >
      <Host showList={showList} />
    </PrismaticProvider>
  );

  const view = render(<Tree showList />);
  await waitFor(() => expect(screen.getByTestId("n")).toHaveTextContent("3"));

  const held = seen.client?.stats().imports ?? 0;
  expect(held).toBeGreaterThan(3);

  view.rerender(<Tree showList={false} />);
  await waitFor(() => expect(screen.getByTestId("gone")).toBeInTheDocument());
  // Exactly the three rows go back, not just the array that carried them.
  await waitFor(() => expect(seen.client?.stats().imports ?? 0).toBe(held - 3));
});
