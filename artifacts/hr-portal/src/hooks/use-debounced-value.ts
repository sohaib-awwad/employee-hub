import { useEffect, useState } from "react";

/**
 * Returns a debounced copy of `value` that only updates after `delay` ms of
 * no changes. Used to avoid firing a server request on every keystroke when a
 * search box drives a paginated query.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
