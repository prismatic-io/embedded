/**
 * How a server function reaches the configuration it runs for. A configuration's cache entry
 * owns a {@link FunctionOwner}; each `useServerFunction` call owns one action, which borrows a
 * function target from that owner on its first run and gives it back when it unmounts.
 */

import type {
  ConfigurationFunctionTarget,
  ConfigurationOperationError,
  InvokeConfigurationFunctionInput,
  Result,
} from "@prismatic-io/solis-core/protocol";
import {
  createAction,
  type DisposableActionHandle,
  disposeQuietly,
} from "@prismatic-io/solis-core/internal";
import type { Guard } from "./loaders.js";

const disposedError = () =>
  Object.assign(new Error("Server function was released."), {
    code: "PRISMATIC_ACTION_DISPOSED",
  });

/** Hands out function targets for the version its configuration shows. */
export interface FunctionOwner {
  create: (key: string) => Promise<ConfigurationFunctionTarget>;
  giveBack: (target: ConfigurationFunctionTarget) => void;
  /** Moves whenever every target handed out so far went stale. */
  generation: () => number;
}

export interface OwnedFunctions extends FunctionOwner {
  /** The configuration moved to another version: what was handed out runs the old one. */
  invalidate: () => void;
  release: () => void;
}

export const createFunctionOwner = (
  acquire: (key: string) => Promise<unknown>,
): OwnedFunctions => {
  let generation = 0;
  let released = false;
  const targets = new Set<ConfigurationFunctionTarget>();
  const invalidate = () => {
    generation += 1;
    for (const target of targets) disposeQuietly(target);
    targets.clear();
  };
  return {
    generation: () => generation,
    create: async (key) => {
      if (released) throw disposedError();
      const at = generation;
      const created = (await acquire(key)) as ConfigurationFunctionTarget;
      if (released || at !== generation) {
        disposeQuietly(created);
        throw disposedError();
      }
      targets.add(created);
      return created;
    },
    giveBack: (target) => {
      if (targets.delete(target)) disposeQuietly(target);
    },
    invalidate,
    release: () => {
      released = true;
      invalidate();
    },
  };
};

/** Where `useServerFunction` finds the configuration a resource was read from. */
export interface ServerFunctionSource {
  /** The configuration's cache key: a different one is a different configuration. */
  scope: string;
  owner: () => FunctionOwner | undefined;
  guard: Guard;
}

/**
 * Carried on a configuration's `actions` under an enumerable symbol, so a host that spreads
 * or copies the resource or its actions still hands over the configuration, while
 * `Object.keys` and JSON never show it.
 */
const SOURCE = Symbol("prismatic.serverFunctionSource");

type Carrier = { [SOURCE]?: ServerFunctionSource };

export const carryServerFunctionSource = (
  actions: object,
  source: ServerFunctionSource,
) => {
  (actions as Carrier)[SOURCE] = source;
};

export const serverFunctionSourceOf = (resource: {
  actions: object;
}): ServerFunctionSource | undefined => (resource.actions as Carrier)[SOURCE];

const notLoaded = (): Result<never, ConfigurationOperationError> => ({
  status: "error",
  error: {
    name: "Error",
    code: "PRISMATIC_CONFIGURATION_UNAVAILABLE",
    message: "Configuration is not loaded.",
  },
});

export interface ServerFunctionHandle {
  action: DisposableActionHandle<
    InvokeConfigurationFunctionInput<unknown>,
    unknown
  >;
  /** Counts the mounts holding the handle; the last release disposes it. */
  retain: () => () => void;
}

/**
 * One server function action with a status of its own. It reads its configuration only when
 * run, so it keeps its identity while that configuration loads, and borrows a fresh target
 * whenever the configuration's entry or version changed since the last run.
 */
export const createServerFunctionHandle = ({
  key,
  source,
}: {
  key: string;
  source: { current: ServerFunctionSource | undefined };
}): ServerFunctionHandle => {
  let disposed = false;
  let borrowed:
    | {
        owner: FunctionOwner;
        generation: number;
        target: ConfigurationFunctionTarget;
      }
    | undefined;
  const giveBack = () => {
    borrowed?.owner.giveBack(borrowed.target);
    borrowed = undefined;
  };
  const targetOf = async (owner: FunctionOwner) => {
    if (borrowed?.owner === owner && borrowed.generation === owner.generation())
      return borrowed.target;
    giveBack();
    const generation = owner.generation();
    const target = await owner.create(key);
    if (disposed) {
      owner.giveBack(target);
      throw disposedError();
    }
    borrowed = { owner, generation, target };
    return target;
  };
  const action = createAction({
    execute: async (input: InvokeConfigurationFunctionInput<unknown>) => {
      const current = source.current;
      const owner = current?.owner();
      if (!current || !owner) return notLoaded();
      current.guard();
      return (await targetOf(owner)).execute(input);
    },
  });
  let holders = 0;
  return {
    action,
    retain: () => {
      holders += 1;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        holders -= 1;
        // StrictMode releases and retains again within one commit; only a real unmount
        // leaves the count at zero once that commit is done.
        queueMicrotask(() => {
          if (holders > 0 || disposed) return;
          disposed = true;
          action.dispose();
          giveBack();
        });
      };
    },
  };
};
