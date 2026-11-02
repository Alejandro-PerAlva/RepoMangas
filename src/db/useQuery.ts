import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { dbSubscribe, dbVersion } from './client';

/** Runs `fn` on mount, on dep change, and whenever the DB is mutated. */
export function useQuery<T>(fn: () => Promise<T>, deps: unknown[], initial: T) {
  const v = useSyncExternalStore(dbSubscribe, dbVersion);
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);
  const last = useRef(0);
  useEffect(() => {
    let alive = true;
    // throttle refreshes caused by bursts of DB writes (e.g. the global catalog download)
    const wait = Math.max(0, last.current + 800 - Date.now());
    const t = setTimeout(() => {
      last.current = Date.now();
      run()
        .then((d) => alive && setData(d))
        .catch(() => {})
        .finally(() => alive && setLoading(false));
    }, v === 0 ? 0 : wait);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [run, v]);
  return { data, loading };
}
