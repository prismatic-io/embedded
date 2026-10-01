/**
 * Connecting an OAuth connection from the host. The hidden frame can't open a window: only
 * the host's own click can, so the host opens a blank one inside the click, before any
 * `await`, and points it at the consent screen once the frame hands over the URL. The
 * outcome comes from the connection's status, which the frame polls while it's in flight.
 */

import type {
  ConnectionAuthorization,
  ConnectionState,
  HostApi,
  Result,
} from "./protocol/index.js";
import { toConnectionError } from "./errors.js";
import { observeState, type Stateful } from "./observe.js";
import type { ConnectionError, ConnectOptions } from "./resource.js";

export const CONNECT_TIMEOUT_MS = 10 * 60_000;

/**
 * How long a closed consent window may stay `PENDING` before the attempt counts as
 * abandoned. Some providers' opener policies make `closed` read true while the user is
 * still consenting, so a close alone proves nothing.
 */
export const ABANDON_GRACE_MS = 30_000;

const CLOSED_CHECK_MS = 500;

/** Where the user consents: a popup the click opened, or the host's own opener. */
export interface ConsentWindow {
  navigate: (url: string) => Promise<boolean>;
  isClosed: () => boolean;
  close: () => void;
}

export const connectionFailure = (
  code: ConnectionError["code"],
  message: string,
): ConnectionError => Object.assign(new Error(message), { code });

const PLACEHOLDER = "Connecting…";

/**
 * Must run synchronously inside the click. A host that granted `openExternalUrl` (a native
 * shell or webview that blocks `window.open`) opens the consent screen itself instead.
 * Returns `null` when the browser blocked the popup.
 */
export const openConsentWindow = (
  host: HostApi | undefined,
): ConsentWindow | null => {
  const openExternal = host?.openExternalUrl;
  if (host && typeof openExternal === "function")
    return {
      navigate: async (url) => {
        try {
          return (await openExternal.call(host, url)) !== false;
        } catch {
          return false;
        }
      },
      isClosed: () => false,
      close: () => {},
    };
  const popup = window.open("about:blank", "_blank");
  if (!popup) return null;
  try {
    popup.opener = null;
    popup.document.title = PLACEHOLDER;
    popup.document.body.textContent = PLACEHOLDER;
  } catch {
    // Some browsers hand back a window whose document isn't ours yet; it still navigates.
  }
  return {
    navigate: async (url) => {
      popup.location.href = url;
      return true;
    },
    isClosed: () => popup.closed,
    // Severing the opener keeps the provider's page from reaching back into the host, and
    // with it the right to close the window once that page is in it, so after consent the
    // user closes it.
    close: () => {
      try {
        popup.close();
      } catch {
        // Already gone.
      }
    },
  };
};

const isHttps = (url: string) => {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
};

const FAILED_STATUSES = new Set<string>(["FAILED", "ERROR"]);

/**
 * Waits for a connection to connect. With `authorize`, first asks the frame for the consent
 * URL and sends `consent` there. With `reread`, asks for a fresh read whenever the user comes
 * back to the host page: the frame re-reads on its own when its page turns visible, but a
 * consent popup never hides the host page, and the focus the host window gets back when it
 * closes never reaches the hidden frame. Resolves when the status turns `ACTIVE`; fails when it
 * turns `FAILED` or `ERROR` (one it already had doesn't count), on timeout or abort, and
 * when the user closed the consent window and the connection is still `PENDING` after
 * {@link ABANDON_GRACE_MS}. It also ends when `released` aborts, because whatever owned the
 * attempt went away. However it ends, it tries to close the consent window.
 */
export const watchConnect = async ({
  stub,
  consent,
  input,
  authorize,
  reread,
  released,
}: {
  stub: Stateful<ConnectionState>;
  consent: ConsentWindow | null;
  input: ConnectOptions | undefined;
  authorize?: () => Promise<Result<ConnectionAuthorization, ConnectionError>>;
  reread?: (id: string) => void;
  released?: AbortSignal;
}): Promise<Result<ConnectionState, ConnectionError>> => {
  const shared = observeState<ConnectionState>(stub);
  const initial = shared.latest?.status;
  let sawPending = initial === "PENDING";
  const disposers: (() => void)[] = [shared.subscribe(() => {})];
  const finish = (
    result: Result<ConnectionState, ConnectionError>,
  ): Result<ConnectionState, ConnectionError> => {
    for (const dispose of disposers.splice(0)) dispose();
    consent?.close();
    return result;
  };
  const fail = (code: ConnectionError["code"], message: string) =>
    finish({ status: "error", error: connectionFailure(code, message) });

  const cancellations = [
    [input?.signal, "PRISMATIC_CONNECT_ABORTED", "Connecting was aborted."],
    [released, "PRISMATIC_ACTION_DISPOSED", "The connection was released."],
  ] as const;
  for (const [signal, code, message] of cancellations)
    if (signal?.aborted) return fail(code, message);
  if (authorize) {
    let authorization: Result<ConnectionAuthorization, ConnectionError>;
    try {
      authorization = await authorize();
    } catch (error) {
      authorization = { status: "error", error: toConnectionError(error) };
    }
    if (authorization.status === "error") return finish(authorization);
    if (!isHttps(authorization.data.url))
      return fail(
        "PRISMATIC_CONNECT_FAILED",
        "The consent screen isn't served over https.",
      );
    if (!(await consent?.navigate(authorization.data.url)))
      return fail(
        "PRISMATIC_POPUP_BLOCKED",
        "The consent screen could not be opened.",
      );
  }

  return new Promise((resolve) => {
    let settled = false;
    const settle = (result: Result<ConnectionState, ConnectionError>) => {
      if (settled) return;
      settled = true;
      resolve(finish(result));
    };
    const settleFailure = (code: ConnectionError["code"], message: string) =>
      settle({ status: "error", error: connectionFailure(code, message) });
    const check = () => {
      if (shared.status === "closed")
        return settleFailure(
          "PRISMATIC_CONNECTION_REMOVED",
          "The connection was removed.",
        );
      const state = shared.latest;
      if (!state) return;
      if (state.status === "ACTIVE")
        return settle({ status: "success", data: state });
      if (state.status === "PENDING") sawPending = true;
      if (
        FAILED_STATUSES.has(state.status) &&
        (sawPending || state.status !== initial)
      )
        settleFailure(
          "PRISMATIC_CONNECT_FAILED",
          "The provider refused the authorization.",
        );
    };
    disposers.push(shared.subscribe(check));

    const timeout = setTimeout(
      () =>
        settleFailure(
          "PRISMATIC_CONNECT_TIMEOUT",
          "The connection did not connect in time.",
        ),
      input?.timeoutMs ?? CONNECT_TIMEOUT_MS,
    );
    disposers.push(() => clearTimeout(timeout));

    for (const [signal, code, message] of cancellations) {
      if (!signal) continue;
      const onAbort = () => settleFailure(code, message);
      signal.addEventListener("abort", onAbort, { once: true });
      disposers.push(() => signal.removeEventListener("abort", onAbort));
    }

    if (reread && typeof window !== "undefined") {
      const onReturn = () => {
        const id = shared.latest?.id;
        if (id && document.visibilityState === "visible") reread(id);
      };
      window.addEventListener("focus", onReturn);
      document.addEventListener("visibilitychange", onReturn);
      disposers.push(() => {
        window.removeEventListener("focus", onReturn);
        document.removeEventListener("visibilitychange", onReturn);
      });
    }

    if (consent) {
      let grace: ReturnType<typeof setTimeout> | undefined;
      const watcher = setInterval(() => {
        if (grace !== undefined || !consent.isClosed()) return;
        grace = setTimeout(() => {
          check();
          settleFailure(
            "PRISMATIC_CONNECT_ABANDONED",
            "The consent window was closed before the connection connected.",
          );
        }, ABANDON_GRACE_MS);
      }, CLOSED_CHECK_MS);
      disposers.push(() => {
        clearInterval(watcher);
        if (grace !== undefined) clearTimeout(grace);
      });
    }

    check();
  });
};
