import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { dbSubscribe, dbVersion } from './client';

/** Runs `fn` on mount, on dep change, and whenever the DB is mutated. */
export function useQuery<T>(fn: () => Promise<T>, deps: unknown[], initial: T) {
  const v = useSyncExternalStore(dbSubscribe, dbVersion);
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);
  useEffect(() => {
    let alive = true;
    run()
      .then((d) => alive && setData(d))
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [run, v]);
  return { data, loading };
}
