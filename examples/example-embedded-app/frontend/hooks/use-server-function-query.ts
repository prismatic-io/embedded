import {
  type ConfigurationConnectionSelection,
  type ConfigurationResource,
  useServerFunction,
} from "@prismatic-io/solis-react";
import { useEffect, useRef, useState } from "react";

export type ServerFunctionQuery<TOutput> =
  | { status: "loading"; data?: TOutput }
  | { status: "success"; data: TOutput }
  | { status: "error"; error: string; data?: TOutput };

const NO_CONNECTIONS: readonly ConfigurationConnectionSelection[] = [];

/**
 * Runs an integration's server function, and runs it again whenever `inputs`
 * change, like a query. Pass `null` inputs to wait.
 *
 * A server function that reads the customer's account declares a connection.
 * Pass the customer's choice for it in `connections`, by requirement key, such
 * as `[{ key: "instance.slack", id }]`. That's needed until a save links the
 * instance to the connection.
 *
 * A server function action runs one call at a time: a second `execute()`
 * while one runs resolves to `PRISMATIC_ACTION_BUSY`. So this hook never
 * overlaps calls. If inputs change during a call, it runs once more with the
 * newest inputs when that call finishes. The last result stays visible
 * in the meantime.
 */
export function useServerFunctionQuery<TInputs, TOutput>(
  configuration: ConfigurationResource,
  key: string,
  inputs: TInputs | null,
  connections: readonly ConfigurationConnectionSelection[] = NO_CONNECTIONS,
): ServerFunctionQuery<TOutput> {
  const { execute } = useServerFunction<TInputs, TOutput>(configuration, key);
  const [result, setResult] = useState<ServerFunctionQuery<TOutput>>({
    status: "loading",
  });
  const ready = configuration.status === "success";
  const wanted =
    ready && inputs !== null ? JSON.stringify({ inputs, connections }) : null;

  const state = useRef({ wanted, running: false, mounted: true });
  state.current.wanted = wanted;

  useEffect(() => {
    state.current.mounted = true;
    return () => {
      state.current.mounted = false;
    };
  }, []);

  useEffect(() => {
    const pump = async () => {
      const current = state.current;
      if (current.running || current.wanted === null) return;
      const running = current.wanted;
      current.running = true;
      setResult((previous) => ({ status: "loading", data: previous.data }));
      const request = JSON.parse(running) as {
        inputs: TInputs;
        connections: ConfigurationConnectionSelection[];
      };
      const outcome = await execute(
        request.connections.length > 0 ? request : { inputs: request.inputs },
      );
      current.running = false;
      if (!current.mounted) return;
      if (current.wanted !== running) {
        // The inputs changed while this call ran, so its answer is stale.
        pump();
        return;
      }
      setResult(
        outcome.status === "success"
          ? { status: "success", data: outcome.data }
          : { status: "error", error: outcome.error.message },
      );
    };
    if (wanted !== null) pump();
  }, [execute, wanted]);

  return result;
}
