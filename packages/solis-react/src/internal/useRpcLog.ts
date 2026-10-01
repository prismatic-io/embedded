/** Devtools wiretap over the session's wire telemetry. */

import type { Client, RpcEvent, TableEntry } from "@prismatic-io/solis-core";
import { useCallback, useContext, useEffect, useState } from "react";
import { PrismaticContext } from "../PrismaticProvider.js";

export type RpcLogStatus = "pending" | "ok" | "error";

/** One call, from issue to completion. */
export interface RpcLogEntry {
  /** capnweb's import id for the result; unique per session. */
  id: number;
  at: number;
  label: string;
  status: RpcLogStatus;
  /** Set once resolved or rejected. */
  ms?: number;
  error?: string;
  /** Whether the host ever awaited it. `false` at completion means it was pipelined through. */
  pulled: boolean;
}

export interface RpcTables {
  imports: TableEntry[];
  exports: TableEntry[];
}

export interface RpcLogOptions {
  /** Defaults to the enclosing provider's client. Pass one for a client created outside. */
  client?: Client | null;
  /** Calls to keep, newest first. Default 200. */
  limit?: number;
}

const EMPTY_TABLES: RpcTables = { imports: [], exports: [] };

/**
 * The session's calls, newest first, plus what is live in the import and export tables.
 * Reconstructed from the wire, so pipelining is untouched and a call the host never
 * awaited still appears. Entries are calls only; disposals and host callbacks show up in
 * `events`. Re-renders on every wire event — mount it behind a flag. Reads the provider
 * without throwing, so an explicit `{ client }` works outside one.
 */
export const useRpcLog = (options: RpcLogOptions = {}) => {
  const { limit = 200 } = options;
  const session = useContext(PrismaticContext);
  const providerClient = session?.status === "ready" ? session.client : null;
  const client = options.client === undefined ? providerClient : options.client;

  const [entries, setEntries] = useState<RpcLogEntry[]>([]);
  const [tables, setTables] = useState<RpcTables>(EMPTY_TABLES);
  /** Wire messages the observer did not recognise. Non-empty means `tables` may be off. */
  const [unknown, setUnknown] = useState<string[]>([]);
  const [events, setEvents] = useState<RpcEvent[]>([]);

  useEffect(() => {
    if (!client) {
      setTables(EMPTY_TABLES);
      return;
    }
    setTables(client.telemetry.tables());

    // Once per frame, not per event: a burst of pipelined calls otherwise walks both tables each time.
    let scheduled = 0;
    const refreshTables = () => {
      if (scheduled) return;
      scheduled = requestAnimationFrame(() => {
        scheduled = 0;
        setTables(client.telemetry.tables());
      });
    };

    const unsubscribe = client.telemetry.subscribe((event: RpcEvent) => {
      refreshTables();
      setEvents((current) => cap([event, ...current], limit));
      if (event.kind === "unknown") {
        setUnknown((current) => [
          ...current,
          `${event.direction}:${event.head}`,
        ]);
      }
      setEntries((current) => reduceEntry(current, event, limit));
    });

    return () => {
      unsubscribe();
      if (scheduled) cancelAnimationFrame(scheduled);
    };
  }, [client, limit]);

  const stats = useCallback(
    () => client?.stats() ?? { imports: 0, exports: 0 },
    [client],
  );

  const clear = useCallback(() => {
    setEntries([]);
    setEvents([]);
    setUnknown([]);
  }, []);

  return { entries, events, tables, unknown, clear, stats };
};

const cap = <T>(values: T[], limit: number): T[] =>
  values.length > limit ? values.slice(0, limit) : values;

const reduceEntry = (
  current: RpcLogEntry[],
  event: RpcEvent,
  limit: number,
): RpcLogEntry[] => {
  switch (event.kind) {
    case "call":
      return cap(
        [
          {
            id: event.importId,
            at: event.at,
            label: event.label,
            status: "pending",
            pulled: false,
          },
          ...current,
        ],
        limit,
      );
    case "pull":
      return current.map((e) =>
        e.id === event.importId ? { ...e, pulled: true } : e,
      );
    case "resolve":
      return current.map((e) =>
        e.id === event.importId ? { ...e, status: "ok", ms: event.ms } : e,
      );
    case "reject":
      return current.map((e) =>
        e.id === event.importId
          ? { ...e, status: "error", ms: event.ms, error: event.error }
          : e,
      );
    default:
      return current;
  }
};
