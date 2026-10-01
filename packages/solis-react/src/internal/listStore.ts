/**
 * One list cache entry's paging state. The entry is keyed by the list's filters, page size
 * and page-load mode, never by how far the reader has paged, so paging widens or moves the
 * window in place instead of starting a new read.
 *
 * Because the window lives in the entry, it lasts exactly as long as the entry: every reader
 * of the same key shares it, a remount inside the cache's idle window (StrictMode's included)
 * finds it where it was left, and once the idle sweep drops the entry the next reader starts
 * again from the first page.
 */

import type { PageInfo } from "@prismatic-io/solis-core";

export type PageLoadMode = "append" | "replace";

/** One fetched page, owning the leases its entries hold. */
export interface Page<Entry> {
  entries: readonly Entry[];
  endCursor: string | null;
  hasNextPage: boolean;
  release: () => void;
}

export type FetchPage<Entry> = (cursor: string | null) => Promise<Page<Entry>>;

export interface ListWindow<Entry> {
  entries: readonly Entry[];
  pageInfo: PageInfo;
}

interface Placement<Entry> {
  page: Page<Entry>;
  cursors: readonly (string | null)[];
}

const FIRST_PAGE: readonly (string | null)[] = [null];

/** First occurrence wins: a row the server moved across a page boundary shows once. */
const dedupe = <Entry extends { id: string }>(
  pages: readonly Page<Entry>[],
): Entry[] => {
  const seen = new Set<string>();
  return pages.flatMap(({ entries }) =>
    entries.filter(({ id }) => !seen.has(id) && Boolean(seen.add(id))),
  );
};

export class ListStore<Entry extends { id: string }> {
  #fetch: FetchPage<Entry>;
  #mode: PageLoadMode;
  /** Append mode holds every loaded page in order; replace mode only the visible one. */
  #pages: readonly Page<Entry>[] = [];
  /**
   * Replace mode's remembered positions: the cursor each visited page started from, ending
   * with the visible page's. Hosts never see a cursor.
   */
  #cursors: readonly (string | null)[] = FIRST_PAGE;
  #window: ListWindow<Entry> = {
    entries: [],
    pageInfo: { hasNextPage: false, hasPreviousPage: false },
  };
  #listeners = new Set<() => void>();
  /** Paging and reloads run one at a time, so a window is never built from two at once. */
  #queue: Promise<void> = Promise.resolve();
  #released = false;

  private constructor(fetch: FetchPage<Entry>, mode: PageLoadMode) {
    this.#fetch = fetch;
    this.#mode = mode;
  }

  /** The first page, as a store. */
  static async open<Entry extends { id: string }>({
    fetch,
    mode,
  }: {
    fetch: FetchPage<Entry>;
    mode: PageLoadMode;
  }): Promise<ListStore<Entry>> {
    const store = new ListStore(fetch, mode);
    store.#adopt([await fetch(null)], FIRST_PAGE);
    return store;
  }

  /** Swaps the fetch for one bound to a newer API handle; positions are unaffected. */
  setFetch(fetch: FetchPage<Entry>): void {
    this.#fetch = fetch;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  getSnapshot = (): ListWindow<Entry> => this.#window;

  /**
   * Fetches only the page after the window. Append mode widens the window; replace mode
   * moves it, keeping the current page visible until the next one is ready. A failure
   * rejects and leaves the window as it was.
   */
  loadNext(): Promise<void> {
    return this.#serialize(async () => {
      const last = this.#pages.at(-1);
      if (!last?.hasNextPage) return;
      const page = await this.#fetch(last.endCursor);
      if (this.#mode === "append") this.#adopt([...this.#pages, page]);
      else this.#adopt([page], [...this.#cursors, last.endCursor]);
    });
  }

  /** Replace mode's way back, from a remembered position. Append mode has no previous page. */
  loadPrevious(): Promise<void> {
    return this.#serialize(async () => {
      if (this.#cursors.length < 2) return;
      const { page, cursors } = await this.#place(this.#cursors.slice(0, -1));
      this.#adopt([page], cursors);
    });
  }

  /**
   * Reloads membership, order and the window: every accumulated page in append mode, the
   * visible page in replace mode. Nothing changes until the whole reload has landed, and a
   * failure rejects with the old window still standing.
   */
  reload(): Promise<void> {
    return this.#serialize(async () => {
      if (this.#mode === "replace") {
        const { page, cursors } = await this.#place(this.#cursors);
        this.#adopt([page], cursors);
        return;
      }
      const pages: Page<Entry>[] = [];
      try {
        let cursor: string | null = null;
        do {
          const page = await this.#fetch(cursor);
          pages.push(page);
          cursor = page.hasNextPage ? page.endCursor : null;
        } while (cursor !== null && pages.length < this.#pages.length);
      } catch (error) {
        for (const page of pages) page.release();
        throw error;
      }
      this.#adopt(pages);
    });
  }

  release(): void {
    if (this.#released) return;
    this.#released = true;
    for (const page of this.#pages) page.release();
    this.#pages = [];
    this.#listeners.clear();
  }

  /**
   * Fetches the page the last of `cursors` points at. A remembered position the list has
   * since shrunk past comes back empty, which restarts from the first page rather than
   * showing an empty page with pages before it.
   */
  async #place(cursors: readonly (string | null)[]): Promise<Placement<Entry>> {
    const cursor = cursors.at(-1) ?? null;
    const page = await this.#fetch(cursor);
    if (cursor === null || page.entries.length > 0) return { page, cursors };
    page.release();
    return { page: await this.#fetch(null), cursors: FIRST_PAGE };
  }

  #serialize(operation: () => Promise<void>): Promise<void> {
    const run = this.#queue.then(() =>
      this.#released ? undefined : operation(),
    );
    this.#queue = run.catch(() => {});
    return run;
  }

  /** Publishes the new window first and releases the pages it dropped after. */
  #adopt(
    pages: readonly Page<Entry>[],
    cursors: readonly (string | null)[] = this.#cursors,
  ): void {
    if (this.#released) {
      for (const page of pages) page.release();
      return;
    }
    const stale = this.#pages.filter((page) => !pages.includes(page));
    this.#pages = pages;
    this.#cursors = cursors;
    this.#window = {
      entries: dedupe(pages),
      pageInfo: {
        hasNextPage: pages.at(-1)?.hasNextPage ?? false,
        hasPreviousPage: this.#mode === "replace" && cursors.length > 1,
      },
    };
    for (const listener of [...this.#listeners]) listener();
    for (const page of stale) page.release();
  }
}
