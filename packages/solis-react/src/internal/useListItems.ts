/**
 * A list's items as entity resources, with no hook per item. One store watches every item's
 * cache entry, live stream and refresh action, and emits when any of them changes; items
 * whose sources did not change keep their identity, so a memoized row skips the render.
 */

import type {
  Action,
  ListItem,
  PrismaticError,
} from "@prismatic-io/solis-core";
import {
  observeState,
  type SharedState,
  type Stateful,
} from "@prismatic-io/solis-core/internal";
import { useCallback, useRef, useSyncExternalStore } from "react";
import { useResourceCache, useResourceErrors } from "../PrismaticProvider.js";
import type { EntityEntry } from "./entityEntries.js";
import type { Snapshot } from "./resourceCache.js";
import { unavailableAction } from "./unavailableAction.js";

/** Everything an item's resource is derived from. */
export interface ItemSources<Loaded, State, E extends PrismaticError> {
  entry: Snapshot<Loaded>;
  /** The latest emission of the entity's live stream, once it has one. */
  live: State | undefined;
  liveError: Error | undefined;
  /** The live stream ended: the frame learned the entity is gone. */
  closed: boolean;
  refresh: Action<void, void, E>;
}

interface Memo<R> {
  sources: readonly unknown[];
  item: ListItem<R>;
  error: Error | undefined;
}

interface ItemsSnapshot<R> {
  items: readonly ListItem<R>[];
  errors: readonly (Error | undefined)[];
}

/** A live stream or an action handle: anything that signals change. */
interface Source {
  subscribe: (listener: () => void) => () => void;
}

/** An action an entity's entry owns, whose status its item shows. */
export interface WatchedAction {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => unknown;
}

const NO_ACTIONS: readonly WatchedAction[] = [];
const noActions = () => NO_ACTIONS;

const EMPTY: ItemsSnapshot<never> = { items: [], errors: [] };

const unavailable = unavailableAction<void, void>(
  "Resource is unavailable.",
).getSnapshot();

const sameElements = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length &&
  a.every((value, index) => Object.is(value, b[index]));

const errorOf = (action: Action<void, void, PrismaticError>) =>
  action.status === "error" ? action.error : undefined;

export const useListItems = <
  Loaded,
  State,
  E extends PrismaticError,
  R extends object,
>({
  entries,
  stubOf,
  actionsOf = noActions,
  project,
}: {
  entries: readonly EntityEntry<Loaded, E>[];
  stubOf: (loaded: Loaded) => Stateful<State>;
  /** Actions the entry itself owns; an item re-projects when any of their statuses moves. */
  actionsOf?: (loaded: Loaded) => readonly WatchedAction[];
  /** Must keep its identity until its own inputs change; a new one re-projects every item. */
  project: (sources: ItemSources<Loaded, State, E>) => R;
}): readonly ListItem<R>[] => {
  const cache = useResourceCache();
  const memos = useRef(new Map<string, Memo<R>>());
  const last = useRef<{
    project: typeof project;
    snapshot: ItemsSnapshot<R>;
  }>({ project, snapshot: EMPTY as ItemsSnapshot<R> });

  const sharedOf = useCallback(
    (loaded: Loaded | undefined): SharedState<State> | undefined =>
      loaded ? observeState(stubOf(loaded)) : undefined,
    [stubOf],
  );

  const subscribe = useCallback(
    (listener: () => void) => {
      const watched = new Map<string, { source: Source; off: () => void }>();
      const watch = (key: string, source: Source | undefined) => {
        const current = watched.get(key);
        if (current?.source === source) return;
        current?.off();
        watched.delete(key);
        if (source)
          watched.set(key, { source, off: source.subscribe(onChange) });
      };
      // An entity reload swaps its stub, and with it the stream to follow.
      const reconcile = () => {
        for (const { id, lease, refresh } of entries) {
          const loaded = lease.snapshot().value;
          watch(`live:${id}`, sharedOf(loaded));
          watch(`action:${id}`, refresh.snapshot().value?.action);
          const owned = loaded ? actionsOf(loaded) : NO_ACTIONS;
          owned.forEach((action, index) => {
            watch(`owned:${id}:${index}`, action);
          });
        }
      };
      const onChange = () => {
        reconcile();
        listener();
      };
      const offCache = cache.subscribe(onChange);
      reconcile();
      return () => {
        offCache();
        for (const { off } of watched.values()) off();
        watched.clear();
      };
    },
    [cache, entries, sharedOf, actionsOf],
  );

  const getSnapshot = useCallback((): ItemsSnapshot<R> => {
    const previous = last.current;
    const reproject = previous.project !== project;
    let changed =
      reproject || entries.length !== previous.snapshot.items.length;
    const next = entries.map(({ id, lease, refresh }, index) => {
      const entry = lease.snapshot();
      const shared = sharedOf(entry.value);
      const action = (refresh.snapshot().value?.action.getSnapshot() ??
        unavailable) as Action<void, void, E>;
      const liveError = shared?.status === "error" ? shared.error : undefined;
      const closed = shared?.status === "closed";
      const owned = entry.value ? actionsOf(entry.value) : NO_ACTIONS;
      const sources = [
        entry,
        shared?.latest,
        liveError,
        closed,
        action,
        ...owned.map((handle) => handle.getSnapshot()),
      ];
      const memo = memos.current.get(id);
      if (!reproject && memo && sameElements(memo.sources, sources)) {
        if (memo.item !== previous.snapshot.items[index]) changed = true;
        return memo;
      }
      changed = true;
      const fresh: Memo<R> = {
        sources,
        item: {
          ...project({
            entry,
            live: shared?.latest,
            liveError,
            closed,
            refresh: action,
          }),
          id,
        },
        error: entry.error ?? liveError ?? errorOf(action),
      };
      memos.current.set(id, fresh);
      return fresh;
    });
    if (!changed) return previous.snapshot;
    const ids = new Set(entries.map(({ id }) => id));
    for (const id of memos.current.keys())
      if (!ids.has(id)) memos.current.delete(id);
    const errors = next.map(({ error }) => error);
    const snapshot = {
      items: next.map(({ item }) => item),
      // Unchanged errors keep their identity, so one failure is reported once.
      errors: sameElements(errors, previous.snapshot.errors)
        ? previous.snapshot.errors
        : errors,
    };
    last.current = { project, snapshot };
    return snapshot;
  }, [entries, project, sharedOf, actionsOf]);

  const { items, errors } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => EMPTY as ItemsSnapshot<R>,
  );
  useResourceErrors(errors);
  return items;
};
