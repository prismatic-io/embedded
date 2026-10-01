/**
 * The `createConnection` action on each requirement of a configuration's connection choices.
 * One per requirement key, held apart from the choices themselves: making a connection
 * reloads the choices, and that reload must not dispose the action that caused it.
 */

import type {
  ConnectionState,
  ConnectionTemplateRef,
  Permission,
  Result,
} from "@prismatic-io/solis-core/protocol";
import type {
  AuthedHandle,
  ConnectionError,
  ConnectionStub,
  CreateConnectionInput,
  CreateConnectionPermissionReason,
} from "@prismatic-io/solis-core";
import {
  connectionFailure,
  createAction,
  type DisposableActionHandle,
  disposeQuietly,
  openConsentWindow,
  toConnectionError,
  watchConnect,
} from "@prismatic-io/solis-core/internal";
import {
  authorizeThrough,
  type ConnectionOwnership,
  forbidden,
  popupBlocked,
} from "./connectionResource.js";
import { settle } from "./settle.js";

interface CreatableRequirement {
  template: ConnectionTemplateRef | null;
  permission: Permission<CreateConnectionPermissionReason>;
}

/** What the actions read when they run, as of the latest render. */
interface CreateConnectionSource {
  api: AuthedHandle | null;
  ownership: ConnectionOwnership;
  requirement: (key: string) => CreatableRequirement | undefined;
  /** Reloads the choices, so the new connection joins its requirement's options. */
  reload: () => void;
}

type Handle = DisposableActionHandle<
  CreateConnectionInput,
  ConnectionState,
  ConnectionError
>;

export class CreateConnectionActions {
  source: CreateConnectionSource | undefined;
  #handles = new Map<string, Handle>();
  #listeners = new Set<() => void>();
  #released = new AbortController();
  #version = 0;

  get(key: string): Handle {
    const existing = this.#handles.get(key);
    if (existing) return existing;
    const handle = createAction<
      CreateConnectionInput,
      ConnectionState,
      ConnectionError
    >({
      execute: (input) => this.#run(key, input),
      toError: toConnectionError,
    });
    handle.subscribe(() => {
      this.#version += 1;
      for (const listener of this.#listeners) listener();
    });
    this.#handles.set(key, handle);
    return handle;
  }

  subscribe = (listener: () => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  version = () => this.#version;

  dispose() {
    this.#released.abort();
    for (const handle of this.#handles.values()) handle.dispose();
    this.#handles.clear();
    this.#listeners.clear();
  }

  // Synchronous up to `openConsentWindow`: the browser only lets the click open it.
  async #run(
    key: string,
    input: CreateConnectionInput,
  ): Promise<Result<ConnectionState, ConnectionError>> {
    const source = this.source;
    const requirement = source?.requirement(key);
    if (!source?.api || !requirement)
      return {
        status: "error",
        error: connectionFailure(
          "PRISMATIC_CONNECTION_INVALID",
          `No connection requirement ${key}.`,
        ),
      };
    const { api, ownership, reload } = source;
    ownership.guard();
    ownership.guardConnect();
    const { template, permission } = requirement;
    if (!permission.allowed || !template) return forbidden("made", permission);
    const grant = template.oauth2Type?.toLowerCase();
    const authorizes = grant !== undefined && grant !== "client_credentials";
    const consent = authorizes ? openConsentWindow(ownership.host()) : null;
    if (authorizes && !consent) return popupBlocked();

    let created: Result<ConnectionStub, ConnectionError> | undefined;
    try {
      created = (await api.connections.create({
        templateId: template.id,
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.inputs !== undefined ? { inputs: input.inputs } : {}),
      })) as unknown as Result<ConnectionStub, ConnectionError>;
    } finally {
      if (created?.status !== "success") consent?.close();
    }
    if (created.status === "error") {
      // The platform keeps a client-credentials credential whose first connect failed.
      if (created.error.code === "PRISMATIC_CONNECT_FAILED") reload();
      return created;
    }
    const stub = created.data;
    try {
      if (grant === undefined) {
        const settled = await settle<ConnectionState>(stub, "connection's");
        settled.release();
        return { status: "success", data: settled.state };
      }
      return await watchConnect({
        stub,
        consent,
        input,
        ...(authorizes ? { authorize: authorizeThrough(stub) } : {}),
        reread: ownership.reread,
        released: this.#released.signal,
      });
    } finally {
      disposeQuietly(stub);
      reload();
    }
  }
}
