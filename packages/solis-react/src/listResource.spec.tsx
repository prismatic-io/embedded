/**
 * How long a paged list keeps its window. Paging lives in the list's cache entry, so it
 * lasts as long as the entry does: shared by every screen showing the same list, kept across
 * a remount inside the idle window, and gone once the idle sweep drops the entry.
 */

import {
  fakeIntegrationState,
  type FakeFrame,
  installFakeFrame,
} from "@prismatic-io/solis-core/testing";
import { act, render, waitFor } from "@testing-library/react";
import { type ReactNode, StrictMode } from "react";
import { afterEach, expect, test } from "vitest";
import { useMarketplace } from "./domain/useMarketplace.js";
import { PrismaticProvider } from "./PrismaticProvider.js";

const APP_ORIGIN = "https://app.example.com";
const PAGE_SIZE = 2;

let frame: FakeFrame | undefined;
afterEach(() => {
  frame?.restore();
  frame = undefined;
});

const install = () => {
  frame = installFakeFrame({
    origin: APP_ORIGIN,
    integrations: [1, 2, 3, 4, 5].map((n) =>
      fakeIntegrationState({ id: `i-${n}`, name: `N${n}`, category: "C" }),
    ),
  });
  return frame;
};

const Tree = ({
  children,
  idleMs,
}: {
  children: ReactNode;
  idleMs: number;
}) => (
  <StrictMode>
    <PrismaticProvider
      prismaticUrl={APP_ORIGIN}
      auth={{ token: "jwt-1" }}
      resourceIdleMs={idleMs}
    >
      {children}
    </PrismaticProvider>
  </StrictMode>
);

const screens = new Map<string, ReturnType<typeof useMarketplace>>();
afterEach(() => screens.clear());

const Screen = ({ name }: { name: string }) => {
  screens.set(name, useMarketplace({ pageSize: PAGE_SIZE }));
  return null;
};

const listOf = (name: string) => {
  const list = screens.get(name);
  if (list?.status !== "success") throw new Error(`${name}: ${list?.status}`);
  return list;
};

const itemCount = (name: string) => listOf(name).data.items.length;

const loadNextPage = (name: string) =>
  act(async () => {
    await listOf(name).actions.loadNextPage.execute();
  });

test("a remount inside the idle window finds the list paged where it was left", async () => {
  install();
  const view = render(
    <Tree idleMs={60_000}>
      <Screen name="list" />
    </Tree>,
  );
  await waitFor(() => expect(itemCount("list")).toBe(PAGE_SIZE));
  await loadNextPage("list");
  expect(itemCount("list")).toBe(2 * PAGE_SIZE);

  view.rerender(<Tree idleMs={60_000}>{null}</Tree>);
  screens.clear();
  view.rerender(
    <Tree idleMs={60_000}>
      <Screen name="list" />
    </Tree>,
  );

  await waitFor(() => expect(itemCount("list")).toBe(2 * PAGE_SIZE));
  view.unmount();
});

test("once the idle sweep drops the list, the next screen starts from the first page", async () => {
  install();
  const idleMs = 20;
  const view = render(
    <Tree idleMs={idleMs}>
      <Screen name="list" />
    </Tree>,
  );
  await waitFor(() => expect(itemCount("list")).toBe(PAGE_SIZE));
  await loadNextPage("list");

  view.rerender(<Tree idleMs={idleMs}>{null}</Tree>);
  screens.clear();
  await act(() => new Promise((resolve) => setTimeout(resolve, idleMs * 5)));
  view.rerender(
    <Tree idleMs={idleMs}>
      <Screen name="list" />
    </Tree>,
  );

  await waitFor(() => expect(itemCount("list")).toBe(PAGE_SIZE));
  view.unmount();
});

test("two screens showing the same list share its window and its paging status", async () => {
  install();
  const view = render(
    <Tree idleMs={60_000}>
      <Screen name="grid" />
      <Screen name="sidebar" />
    </Tree>,
  );
  await waitFor(() => expect(itemCount("sidebar")).toBe(PAGE_SIZE));

  await loadNextPage("grid");

  expect(itemCount("sidebar")).toBe(2 * PAGE_SIZE);
  expect(listOf("sidebar").actions.loadNextPage.status).toBe("success");
  view.unmount();
});

test("loading a page keeps the identity of every item already shown", async () => {
  install();
  const view = render(
    <Tree idleMs={60_000}>
      <Screen name="list" />
    </Tree>,
  );
  await waitFor(() => expect(itemCount("list")).toBe(PAGE_SIZE));
  const shown = listOf("list").data.items;

  await loadNextPage("list");

  const kept = listOf("list").data.items.slice(0, PAGE_SIZE);
  for (const [index, item] of kept.entries()) expect(item).toBe(shown[index]);
  view.unmount();
});
