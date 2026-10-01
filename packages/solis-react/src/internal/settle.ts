/** Awaiting a stub's first emission through the shared observer, inside a cache loader. */

import { observeState, type Stateful } from "@prismatic-io/solis-core/internal";

export interface Settled<S> {
  state: S;
  /** The observer handle. Holding it keeps the stream open until the resource is released. */
  release: () => void;
}

/**
 * The target's first state, keeping the stream open for the readers that follow.
 *
 * Subscribes through {@link observeState} rather than calling `state()` directly: the
 * stream a live reader later joins is then the one this warmed, where a second `state()`
 * would open a second stream and hold a second export-table entry.
 */
export const settle = <S>(
  target: Stateful<S>,
  subject: string,
): Promise<Settled<S>> =>
  new Promise<Settled<S>>((resolve, reject) => {
    const shared = observeState<S>(target);
    let done = false;

    const finish = (): boolean => {
      if (done) return true;
      if (shared.status === "error") {
        done = true;
        off();
        reject(
          shared.error ?? new Error(`The ${subject} state stream failed.`),
        );
        return true;
      }
      if (shared.latest !== undefined && shared.status === "ready") {
        done = true;
        resolve({ state: shared.latest, release: off });
        return true;
      }
      if (shared.status === "closed") {
        done = true;
        off();
        reject(
          new Error(`The ${subject} state stream closed before emitting.`),
        );
        return true;
      }
      return false;
    };

    const off = shared.subscribe(() => {
      finish();
    });
    // A stream already warm from an earlier read will not emit again; take what it holds.
    finish();
  });
