/** Structural identity for a hook input, so an inline literal need not be memoized. */

import { queryKey } from "@prismatic-io/solis-core/internal";
import { useRef } from "react";

/**
 * A string identity for `input` that holds while its meaning does: what to put in a deps
 * array in place of an inline literal. Plain JSON is compared by value, a stub or a
 * callback by identity, and nothing throws.
 */
export const stableKey = (input: unknown, _hookName?: string): string =>
  queryKey(input);

/**
 * `input` itself, held at one identity until its structural key changes.
 *
 * For a value that must stay identical rather than merely compare equal — an argument
 * forwarded to a stub, or a dep an effect keys on. What comes back is whichever render's
 * literal arrived first under the current key, so treat it as read-only.
 */
export const useStableInput = <T>(input: T): T => {
  const key = queryKey(input);
  const held = useRef<{ key: string; value: T }>({ key, value: input });
  if (held.current.key !== key) held.current = { key, value: input };
  return held.current.value;
};
