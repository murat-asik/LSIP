import React, { useEffect, useState } from 'react';
import { useTranslation, message } from '../../i18n';
export function CollectionHealth({ tab }: { tab: string }) {
  const { t, language } = useTranslation();
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    let alive = true;
    const update = async () => {
      try {
        if (tab === 'events') {
          const result = await window.lsip.invoke('events:health');
          if (!result?.success) throw new Error('Collection health unavailable');
          if (alive) setRows(Object.entries(result?.data || {}).map(([source, value]: [string, any]) => ({ source, ...value, state: value.error ? 'error' : value.warning || value.more ? 'partial' : 'ok', detail: value.error || value.warning || (value.more ? t('collectionHealth.backlog') : '') })));
        } else {
          const data = await window.lsip.invoke('app:collector-health');
          const source = ({ connections: 'connection', topology: 'connection' } as Record<string,string>)[tab] || tab;
          if (alive) setRows(data.filter((r: any) => r.source === source));
        }
      } catch { if (alive) setRows([{ source: tab, state: 'error', detail: t('collectionHealth.unavailable'), checkedAt: Date.now() }]); }
    };
    setRows([]); void update(); const timer = setInterval(update, 5000);
    return () => { alive = false; clearInterval(timer); };
  }, [tab, language]);
  const problems = rows.filter(row => row.state === 'error' || row.state === 'partial');
  if (!problems.length) return null;
  return <details open style={{ padding: 10, color: 'var(--accent-warning)', maxHeight: 180, overflow: 'auto' }}>
    <summary>{t('collectionHealth.incomplete')}</summary>
    {problems.map((row, index) => <p key={index} role="status" style={{ margin: '4px 0', overflowWrap: 'anywhere' }}>{row.source}: {message(row.detail)} — {new Date(row.checkedAt).toLocaleTimeString()}</p>)}
  </details>;
}
