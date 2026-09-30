import { useEffect, useState } from 'react';

// Returns a debounced copy of `value` that only updates after `delay` ms
// of inactivity. Used to avoid firing a search request on every keystroke.
export default function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    if (value === '') {
      setDebounced('');
      return undefined;
    }
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}