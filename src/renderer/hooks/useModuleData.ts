import { useCallback, useEffect, useState } from 'react';

/** One in-flight request per view. Errors never masquerade as an empty result. */
export function useModuleData<T>(channel: string, payload: unknown, initial: T) {
  const [data, setData] = useState<T>(initial);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const serialized = JSON.stringify(payload);
  const refresh = useCallback(() => setRevision(n => n + 1), []);
  useEffect(() => {
    let live = true;
    setLoading(true); setError('');
    window.lsip.invoke(channel, serialized === undefined ? undefined : JSON.parse(serialized)).then((result: any) => {
      if (!result?.success) throw new Error(result?.error?.message || result?.error || 'Request failed');
      if (live) setData(result.data);
    }).catch((reason: any) => { if (live) setError(String(reason.message || reason)); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [channel, serialized, revision]);
  return { data, error, loading, refresh };
}
