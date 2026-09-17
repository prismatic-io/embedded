import { useEffect, useState } from "react";

/**
 * Returns `value` after it stops changing for `delay` milliseconds.
 *
 * The playground examples rebuild the embedded iframe whenever an option
 * changes. A debounce keeps a typed character from reloading the iframe on
 * every keystroke.
 */
export function useDebouncedValue<T>(value: T, delay = 400): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
