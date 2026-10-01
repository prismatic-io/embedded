/** A `MessagePort` transport for capnweb, and a wrapper that lets the client watch the wire. */

import type { RpcTransportWithCustomEncoding } from "capnweb";

/**
 * Messages are JS values handed to `postMessage` as-is, capnweb's
 * `structuredClonable` encoding level.
 *
 * capnweb ships one of these but does not export it, and `newMessagePortRpcSession`
 * hides the transport entirely; owning it is what makes {@link observed} possible.
 */
export class MessagePortTransport implements RpcTransportWithCustomEncoding {
  readonly encodingLevel = "structuredClonable" as const;
  #port: MessagePort;
  #queue: unknown[] = [];
  #resolve: ((message: unknown) => void) | undefined;
  #reject: ((error: Error) => void) | undefined;
  #error: Error | undefined;

  constructor(port: MessagePort) {
    this.#port = port;
    port.start();
    port.addEventListener("message", (event: MessageEvent) => {
      if (this.#error) return;
      // A literal `null` message is the peer's close signal, not a payload.
      if (event.data === null) {
        this.#fail(new Error("Peer closed MessagePort connection."));
        return;
      }
      if (this.#resolve) {
        this.#resolve(event.data);
        this.#resolve = undefined;
        this.#reject = undefined;
      } else {
        this.#queue.push(event.data);
      }
    });
    port.addEventListener("messageerror", () => {
      this.#fail(new Error("MessagePort message error."));
    });
  }

  send(message: unknown): void {
    if (this.#error) throw this.#error;
    this.#port.postMessage(message);
  }

  receive(): Promise<unknown> {
    if (this.#queue.length > 0) return Promise.resolve(this.#queue.shift());
    if (this.#error) return Promise.reject(this.#error);
    return new Promise((resolve, reject) => {
      this.#resolve = resolve;
      this.#reject = reject;
    });
  }

  abort(reason: Error): void {
    try {
      this.#port.postMessage(null);
    } catch {
      // Port already closed.
    }
    this.#port.close();
    if (!this.#error) this.#error = reason;
  }

  #fail(reason: Error) {
    if (this.#error) return;
    this.#error = reason;
    if (this.#reject) {
      this.#reject(reason);
      this.#resolve = undefined;
      this.#reject = undefined;
    }
  }
}

export interface WireObserver {
  onSend(message: unknown): void;
  onReceive(message: unknown): void;
}

/**
 * Wraps a transport so an observer sees every message in both directions.
 * The observer can neither alter a message nor break the session: its failures
 * are swallowed here.
 */
export const observed = (
  inner: RpcTransportWithCustomEncoding,
  observer: WireObserver,
): RpcTransportWithCustomEncoding => ({
  encodingLevel: inner.encodingLevel,
  send(message: unknown) {
    try {
      observer.onSend(message);
    } catch {
      // Telemetry must not affect the wire.
    }
    return inner.send(message);
  },
  async receive() {
    const message = await inner.receive();
    try {
      observer.onReceive(message);
    } catch {
      // Telemetry must not affect the wire.
    }
    return message;
  },
  abort: inner.abort ? (reason: Error) => inner.abort?.(reason) : undefined,
});
