/** Wire-level telemetry, reconstructed by parsing capnweb's messages on the transport. */

import type { WireObserver } from "./transport.js";

/**
 * One observed wire event.
 *
 * capnweb has no call hook and wrapping stubs breaks pipelining, so this is
 * reconstructed from the message stream: a call is one `push` carrying a target import
 * id and a property path, `pull` says the host awaited the result, `resolve`/`reject`
 * complete it, `release` is a disposed stub. That reaches two things a hand-written log
 * in a host app cannot: calls that were pipelined and never awaited, and disposals.
 *
 * Arguments are never recorded — `authenticate(jwt)` is a push like any other.
 *
 * The format parsed here is capnweb's private one. An unrecognised message becomes an
 * `unknown` event; nothing here throws or touches the message.
 */
export type RpcEvent =
  | {
      kind: "call";
      seq: number;
      at: number;
      /** Import id capnweb assigned to the result. Correlates `resolve`/`reject`. */
      importId: number;
      /** Human label, e.g. `api.marketplace.list()` or `integrations[0].instances()`. */
      label: string;
      path: string[];
      hasArgs: boolean;
    }
  | { kind: "pull"; seq: number; at: number; importId: number; label: string }
  | {
      kind: "resolve";
      seq: number;
      at: number;
      importId: number;
      label: string;
      ms: number;
    }
  | {
      kind: "reject";
      seq: number;
      at: number;
      importId: number;
      label: string;
      ms: number;
      error: string;
    }
  /** `direction: "send"` is the host disposing a stub it held; `"receive"` is the frame
   * dropping something of ours — a callback, or a host-call result. */
  | {
      kind: "release";
      seq: number;
      at: number;
      direction: "send" | "receive";
      id: number;
      label: string;
      refcount: number;
    }
  /** The frame called a `HostApi` method. */
  | { kind: "hostCall"; seq: number; at: number; path: string[] }
  /** A stream chunk from the frame: `pending: true` on arrival, `false` once the host
   * read it and our resolve went back. A chunk that stays pending is a reader that is
   * not reading. */
  | {
      kind: "chunk";
      seq: number;
      at: number;
      exportId: number;
      label: string;
      pending: boolean;
    }
  | {
      kind: "abort";
      seq: number;
      at: number;
      direction: "send" | "receive";
      error: string;
    }
  | {
      kind: "unknown";
      seq: number;
      at: number;
      direction: "send" | "receive";
      head: string;
    };

export type RpcEventListener = (event: RpcEvent) => void;

export type TableEntryKind =
  | "main"
  | "promise"
  | "stub"
  | "stream"
  | "chunk"
  | "callback"
  | "hostCall";

export interface TableEntry {
  id: number;
  label: string;
  kind: TableEntryKind;
  /** When it appeared; `0` for the mains. */
  since: number;
}

export interface Telemetry {
  /** Receive every event from now on. Returns the unsubscribe. */
  subscribe(listener: RpcEventListener): () => void;
  /**
   * What the observer believes is live in each table, by name.
   *
   * `imports` are the frame's exports we hold: stubs from results, plus calls pipelined
   * through and never pulled — capnweb releases a resolved call's entry the moment its
   * resolution arrives. `exports` are ours the frame holds: the host main, callbacks
   * passed as arguments, results of the frame's calls into the host, the writable end
   * of every stream it pipes us, and each unread chunk written to one. A lingering
   * `chunk` is backpressure: the receiving TransformStream's high-water mark is zero, so
   * a write stays pending until the host reads. Compare against `client.stats()`; a
   * disagreement means a message shape went unrecognised.
   */
  tables(): { imports: TableEntry[]; exports: TableEntry[] };
}

interface ImportRecord {
  /** Short name used when this import is the target of a later call. */
  name: string;
  /** Full label of the call that produced it, for resolve/reject events. */
  label: string;
  at: number;
  kind: TableEntryKind;
  released: boolean;
}

interface ExportRecord {
  label: string;
  kind: TableEntryKind;
  at: number;
  released: boolean;
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;
type EventDraft = DistributiveOmit<RpcEvent, "seq" | "at"> & { at?: number };

const isSpecial = (value: unknown, tag: string): value is [string, number] =>
  Array.isArray(value) && value[0] === tag && typeof value[1] === "number";

const describeError = (encoded: unknown): string => {
  if (Array.isArray(encoded) && encoded[0] === "error") {
    const [, name, message] = encoded;
    return `${String(name ?? "Error")}: ${String(message ?? "")}`;
  }
  return "rejected";
};

/** Builds the observer and the subscribable it feeds. One per session. */
export const createTelemetry = (): {
  observer: WireObserver;
  telemetry: Telemetry;
} => {
  const listeners = new Set<RpcEventListener>();
  const imports = new Map<number, ImportRecord>();
  const exports = new Map<number, ExportRecord>();
  let nextImport = 1;
  let nextExport = 1;
  let seq = 0;

  imports.set(0, {
    name: "api",
    label: "api",
    at: 0,
    kind: "main",
    released: false,
  });
  exports.set(0, { label: "host", kind: "main", at: 0, released: false });

  const emit = (event: EventDraft) => {
    const full = {
      ...event,
      seq: ++seq,
      at: event.at ?? Date.now(),
    } as RpcEvent;
    for (const listener of listeners) {
      try {
        listener(full);
      } catch {
        // A listener's failure is its own.
      }
    }
  };

  const nameFor = (importId: number) =>
    imports.get(importId)?.name ?? `#${importId}`;

  /**
   * Names stubs embedded in a resolution so later calls on them read as
   * `integrations[0].state()` rather than `#-7.state()`. Devalued payloads escape
   * literal arrays as `[[...]]`; special forms are `["export", id]` and `["promise", id]`.
   */
  const nameEmbeddedStubs = (payload: unknown, prefix: string) => {
    const walk = (value: unknown, path: string) => {
      if (!Array.isArray(value)) {
        if (value && typeof value === "object") {
          for (const [key, child] of Object.entries(value))
            walk(child, `${path}.${key}`);
        }
        return;
      }
      if (isSpecial(value, "readable")) {
        // The frame piped a stream to us; its writable end is one of OUR exports,
        // allocated when the preceding ["pipe"] arrived.
        const record = exports.get(value[1]);
        if (record && record.kind === "stream") record.label = `${path} stream`;
        return;
      }
      if (isSpecial(value, "export") || isSpecial(value, "promise")) {
        const id = value[1];
        if (!imports.has(id)) {
          imports.set(id, {
            name: path,
            label: path,
            at: Date.now(),
            kind: value[0] === "promise" ? "promise" : "stub",
            released: false,
          });
        }
        return;
      }
      if (value.length === 1 && Array.isArray(value[0])) {
        for (const [index, child] of (value[0] as unknown[]).entries()) {
          walk(child, `${path}[${index}]`);
        }
      }
    };
    walk(payload, prefix);
  };

  /** Things of ours embedded in an outgoing push: callbacks and targets become exports. */
  const noteOutgoingExports = (payload: unknown, prefix: string) => {
    const walk = (value: unknown, path: string) => {
      if (!Array.isArray(value)) {
        if (value && typeof value === "object") {
          for (const [key, child] of Object.entries(value))
            walk(child, `${path}.${key}`);
        }
        return;
      }
      if (isSpecial(value, "export") || isSpecial(value, "promise")) {
        if (!exports.has(value[1])) {
          exports.set(value[1], {
            label: path,
            kind: "callback",
            at: Date.now(),
            released: false,
          });
        }
        return;
      }
      if (value.length === 1 && Array.isArray(value[0])) {
        for (const [index, child] of (value[0] as unknown[]).entries()) {
          walk(child, `${path}[${index}]`);
        }
      }
    };
    walk(payload, prefix);
  };

  const onSend = (message: unknown) => {
    if (!Array.isArray(message)) {
      emit({ kind: "unknown", direction: "send", head: typeof message });
      return;
    }
    const [head, ...rest] = message;
    switch (head) {
      case "push": {
        const importId = nextImport++;
        const expr = rest[0];
        if (
          Array.isArray(expr) &&
          expr[0] === "pipeline" &&
          typeof expr[1] === "number"
        ) {
          const targetId = expr[1] as number;
          const path = (Array.isArray(expr[2]) ? expr[2] : []).map(String);
          const hasArgs = expr.length > 3;
          const target = nameFor(targetId);
          const label = `${target}.${path.join(".")}${hasArgs || path.length ? "()" : ""}`;
          // authenticate() yields the authed api, so keep calling it "api"; the root's
          // own children drop the "api." prefix, and everything else keeps its target
          // so a stub reads as `connections.list()[0]`.
          const name =
            path.at(-1) === "authenticate"
              ? "api"
              : target === "api"
                ? `${path.join(".")}()`
                : `${target}.${path.join(".")}()`;
          const at = Date.now();
          imports.set(importId, {
            name,
            label,
            at,
            kind: "promise",
            released: false,
          });
          if (hasArgs) noteOutgoingExports(expr[3], `${label} arg`);
          emit({ kind: "call", importId, label, path, hasArgs, at });
        } else {
          imports.set(importId, {
            name: `#${importId}`,
            label: `push#${importId}`,
            at: Date.now(),
            kind: "promise",
            released: false,
          });
          emit({ kind: "unknown", direction: "send", head: "push" });
        }
        return;
      }
      case "pipe":
        imports.set(nextImport++, {
          name: "pipe",
          label: "pipe",
          at: Date.now(),
          kind: "stream",
          released: false,
        });
        return;
      case "stream": {
        // One chunk write on a stream we are sending. Allocates an import capnweb
        // releases as soon as the frame acknowledges it.
        const expr = rest[0];
        const targetId =
          Array.isArray(expr) && typeof expr[1] === "number" ? expr[1] : -1;
        imports.set(nextImport++, {
          name: "write",
          label: `${nameFor(targetId)}.write()`,
          at: Date.now(),
          kind: "promise",
          released: false,
        });
        return;
      }
      case "pull": {
        const importId = rest[0] as number;
        emit({
          kind: "pull",
          importId,
          label: imports.get(importId)?.label ?? `#${importId}`,
        });
        return;
      }
      case "release": {
        const id = rest[0] as number;
        const record = imports.get(id);
        if (record) record.released = true;
        emit({
          kind: "release",
          direction: "send",
          id,
          label: record?.kind === "promise" ? record.label : nameFor(id),
          refcount: Number(rest[1] ?? 1),
        });
        return;
      }
      case "resolve":
      case "reject": {
        // Our answer to something the frame pushed at us. For a chunk write, capnweb
        // auto-releases the export right after this message.
        const exportId = rest[0] as number;
        const record = exports.get(exportId);
        if (record?.kind === "chunk") {
          record.released = true;
          emit({
            kind: "chunk",
            exportId,
            label: record.label,
            pending: false,
          });
        }
        return;
      }
      case "abort":
        emit({
          kind: "abort",
          direction: "send",
          error: describeError(rest[0]),
        });
        return;
      default:
        emit({ kind: "unknown", direction: "send", head: String(head) });
    }
  };

  const onReceive = (message: unknown) => {
    if (!Array.isArray(message)) {
      emit({ kind: "unknown", direction: "receive", head: typeof message });
      return;
    }
    const [head, ...rest] = message;
    switch (head) {
      case "resolve":
      case "reject": {
        const importId = rest[0] as number;
        const record = imports.get(importId);
        const label = record?.label ?? `#${importId}`;
        const ms = record?.at ? Date.now() - record.at : 0;
        if (head === "resolve") {
          nameEmbeddedStubs(rest[1], record?.name ?? label);
          emit({ kind: "resolve", importId, label, ms });
        } else {
          emit({
            kind: "reject",
            importId,
            label,
            ms,
            error: describeError(rest[1]),
          });
        }
        return;
      }
      case "push": {
        const expr = rest[0];
        const path =
          Array.isArray(expr) &&
          expr[0] === "pipeline" &&
          Array.isArray(expr[2])
            ? expr[2].map(String)
            : [];
        exports.set(nextExport++, {
          label: `host.${path.join(".")}()`,
          kind: "hostCall",
          at: Date.now(),
          released: false,
        });
        emit({ kind: "hostCall", path });
        return;
      }
      case "pipe":
        // We hold the writable end as an export until the stream ends or we cancel.
        // Named once the resolve carrying the matching ["readable", id] arrives.
        exports.set(nextExport++, {
          label: "pipe",
          kind: "stream",
          at: Date.now(),
          released: false,
        });
        return;
      case "stream": {
        const expr = rest[0];
        const pipeId =
          Array.isArray(expr) && typeof expr[1] === "number"
            ? expr[1]
            : undefined;
        const pipe = pipeId !== undefined ? exports.get(pipeId) : undefined;
        const exportId = nextExport++;
        const label = `${pipe?.label ?? "pipe"} chunk`;
        exports.set(exportId, {
          label,
          kind: "chunk",
          at: Date.now(),
          released: false,
        });
        emit({ kind: "chunk", exportId, label, pending: true });
        return;
      }
      case "release": {
        const id = rest[0] as number;
        const record = exports.get(id);
        if (record) record.released = true;
        emit({
          kind: "release",
          direction: "receive",
          id,
          label: record?.label ?? `#${id}`,
          refcount: Number(rest[1] ?? 1),
        });
        return;
      }
      case "pull":
        return;
      case "abort":
        emit({
          kind: "abort",
          direction: "receive",
          error: describeError(rest[0]),
        });
        return;
      default:
        emit({ kind: "unknown", direction: "receive", head: String(head) });
    }
  };

  return {
    observer: { onSend, onReceive },
    telemetry: {
      subscribe(listener) {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      // Released records are never deleted; they are filtered here. Memory grows with
      // total calls made, not with live objects.
      tables() {
        const live = <T extends { released: boolean }>(
          map: Map<number, T>,
          toEntry: (id: number, record: T) => TableEntry,
        ) =>
          [...map.entries()]
            .filter(([, record]) => !record.released)
            .map(([id, record]) => toEntry(id, record))
            .sort((a, b) => a.since - b.since);
        return {
          imports: live(imports, (id, r) => ({
            id,
            label: r.kind === "promise" ? r.label : r.name,
            kind: r.kind,
            since: r.at,
          })),
          exports: live(exports, (id, r) => ({
            id,
            label: r.label,
            kind: r.kind,
            since: r.at,
          })),
        };
      },
    },
  };
};
