import { message } from '../../i18n';
import React from 'react';
import { useTranslation } from '../../i18n';
export function DataStatus({ error, loading, refresh, empty }: {error: string; loading: boolean; refresh: () => void; empty?: boolean}) {
  const { t } = useTranslation();
  return <div style={{display:'flex', gap:12, alignItems:'center', flexWrap:'wrap'}}>
    <button className="fluent-button" onClick={refresh} disabled={loading}>{t('common.refresh')}</button>
    {loading ? <span>{t('common.loading')}</span> : error ? <span role="alert" style={{color:'var(--accent-danger)'}}>{message(error)}</span> : empty ? <span>{t('common.noData')}</span> : null}
  </div>;
}
