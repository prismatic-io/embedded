import {
  type ConfigurationResource,
  useServerFunction,
} from "@prismatic-io/solis-react";
import { useEffect, useRef, useState } from "react";

export type ServerFunctionQuery<TOutput> =
  | { status: "loading"; data?: TOutput }
  | { status: "success"; data: TOutput }
  | { status: "error"; error: string; data?: TOutput };

/**
 * Runs an integration's server function, and runs it again whenever `inputs`
 * change, like a query. Pass `null` inputs to wait.
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
): ServerFunctionQuery<TOutput> {
  const { execute } = useServerFunction<TInputs, TOutput>(configuration, key);
  const [result, setResult] = useState<ServerFunctionQuery<TOutput>>({
    status: "loading",
  });
  const ready = configuration.status === "success";
  const wanted = ready && inputs !== null ? JSON.stringify(inputs) : null;

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
      const outcome = await execute({ inputs: JSON.parse(running) as TInputs });
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
