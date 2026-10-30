/** Small helpers over the stubs @prismatic-io/solis-core hands out. */
import type {
  Client,
  ConfigurationConnectionSelection,
  ConfigurationStub,
  ConnectionStub,
} from "@prismatic-io/solis-core";
import type {
  ConfigurationConnectionOptions,
  ConnectionState,
  ConnectionTemplateRef,
  Permission,
} from "@prismatic-io/solis-core/protocol";

/** Reads a stub's current state, once. */
export async function firstState<S>(stub: {
  state(): ReadableStream<S> | Promise<ReadableStream<S>>;
}): Promise<S> {
  const reader = (await stub.state()).getReader();
  const { value } = await reader.read();
  reader.cancel().catch(() => {});
  if (value === undefined) throw new Error("The stream ended before it had a value.");
  return value;
}

type ServerFunction = Awaited<ReturnType<ConfigurationStub["createServerFunction"]>>;
const serverFunctions = new WeakMap<object, Map<string, Promise<ServerFunction>>>();

/**
 * Runs one of an integration's server functions. A server function that reads
 * the customer's account declares a connection: pass the customer's choice in
 * `connections`, until a save links the instance to it.
 */
export async function callServerFunction<T>(
  config: ConfigurationStub,
  key: string,
  inputs: unknown,
  connections: readonly ConfigurationConnectionSelection[] = [],
): Promise<T> {
  let byKey = serverFunctions.get(config);
  if (!byKey) serverFunctions.set(config, (byKey = new Map()));
  let fn = byKey.get(key);
  if (!fn) byKey.set(key, (fn = Promise.resolve(config.createServerFunction({ key }))));
  const result = await (
    await fn
  ).execute({
    inputs,
    ...(connections.length ? { connections } : {}),
  });
  if (result.status === "error") throw result.error;
  return result.data as T;
}

/** A customer-activated connection the instance runs with, and the customer's credentials for it. */
export interface Requirement {
  key: string;
  label: string;
  /** What a new credential is made from. `null` when the customer can't make one. */
  template: ConnectionTemplateRef | null;
  createPermission: Permission;
  /** The credential the instance is linked to, if any. */
  selected: string | null;
  options: ConnectionState[];
}

export interface ConnectionChoices {
  /** The connections the instance runs with. Saving links the customer's choices. */
  instance: Requirement[];
  /** The requirement keys `init` runs with. */
  initKeys: string[];
}

/** What connections a configuration needs, and the customer's credentials for each. */
export async function readConnectionChoices(config: ConfigurationStub): Promise<ConnectionChoices> {
  const choices =
    (await config.readConnectionOptions()) as unknown as ConfigurationConnectionOptions;
  // `instance` is missing on Prismatic stacks without the `configuration.connections` feature.
  const instance = await Promise.all(
    (choices.instance ?? []).map(async (requirement) => ({
      key: requirement.key,
      label: requirement.label,
      template: requirement.template,
      createPermission: requirement.permissions.createConnection,
      selected: requirement.selected ?? null,
      // Each option is a live connection. Read its label and status.
      options: await Promise.all(
        requirement.options.map((option) => firstState(option as unknown as ConnectionStub)),
      ),
    })),
  );
  return { instance, initKeys: choices.init.map(({ key }) => key) };
}

const CONNECT_TIMEOUT_MS = 10 * 60_000;
/** Some providers make a consent window read as closed while the customer is still consenting. */
const ABANDON_GRACE_MS = 30_000;

/**
 * Makes the customer a credential from a connection template and connects it.
 *
 * Call it straight from a click, before any `await`: for OAuth it opens the
 * provider's consent screen in a new window, and browsers only let a click
 * open one.
 */
export async function createConnection(
  client: Client,
  template: ConnectionTemplateRef,
): Promise<ConnectionState> {
  const grant = template.oauth2Type?.toLowerCase();
  // Client-credentials connections connect as they're made, with no consent screen.
  const consent = grant && grant !== "client_credentials" ? openConsentWindow() : null;
  if (grant && grant !== "client_credentials" && !consent) {
    throw new Error(
      "Your browser blocked the sign-in window. Allow pop-ups for this site, then try again.",
    );
  }

  try {
    const created = await client.authenticated!.connections.create({ templateId: template.id });
    if (created.status === "error") throw created.error;
    const connection = created.data as unknown as ConnectionStub;
    if (consent) {
      const authorization = await connection.authorize();
      if (authorization.status === "error") throw authorization.error;
      if (!authorization.data.url.startsWith("https:")) {
        throw new Error("The consent screen isn't served over https.");
      }
      consent.location.href = authorization.data.url;
    }
    return await untilActive(connection, consent);
  } finally {
    consent?.close();
  }
}

/** Opens a blank window for the consent screen, so the click can still open it. */
function openConsentWindow(): Window | null {
  const popup = window.open("about:blank", "_blank");
  if (!popup) return null;
  // The provider's page shouldn't be able to reach back into this app.
  popup.opener = null;
  popup.document.title = "Connecting…";
  return popup;
}

/** Waits until a new connection is `ACTIVE`. The frame re-reads it every 2 seconds meanwhile. */
async function untilActive(connection: ConnectionStub, consent: Window | null) {
  const reader = (await connection.state()).getReader();
  const giveUp = (ms: number) => setTimeout(() => reader.cancel(), ms);
  const timers = [giveUp(CONNECT_TIMEOUT_MS)];
  const watcher = setInterval(() => {
    if (!consent?.closed) return;
    clearInterval(watcher);
    timers.push(giveUp(ABANDON_GRACE_MS));
  }, 500);

  try {
    for (let next = await reader.read(); !next.done; next = await reader.read()) {
      const { status } = next.value;
      if (status === "ACTIVE") return next.value;
      if (status === "FAILED" || status === "ERROR") {
        throw new Error("The provider refused the authorization.");
      }
    }
    throw new Error("The connection didn't connect. Try again.");
  } finally {
    for (const timer of timers) clearTimeout(timer);
    clearInterval(watcher);
    reader.cancel().catch(() => {});
  }
}
