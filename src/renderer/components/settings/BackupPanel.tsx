import React, { useState, useEffect } from 'react';
import { useTranslation, message } from '../../i18n';
export function BackupPanel() {
  const { t } = useTranslation();
  const [password, setPassword] = useState(''), [busy, setBusy] = useState(false), [result, setResult] = useState(''), [restart, setRestart] = useState(false);
  useEffect(() => {
    if (!busy) return;
    const prevent = (event: KeyboardEvent) => { event.preventDefault(); event.stopPropagation(); };
    document.addEventListener('keydown', prevent, true);
    return () => document.removeEventListener('keydown', prevent, true);
  }, [busy]);
  const perform = async (restore: boolean) => {
    if (restore && !window.confirm(t('backup.confirmRestore'))) return;
    setBusy(true); setResult('');
    try {
      const response = await window.lsip.invoke(restore ? 'backup:restore' : 'backup:create', { password });
      if (response.canceled) return;
      setRestart(Boolean(response.restartRequired));
      setResult(response.restartRequired ? t('backup.readyToRestore') : t('backup.created') + ' ' + response.directory);
      setPassword('');
    } catch (error: any) { setResult(message(error.message)); }
    finally { setBusy(false); }
  };
  return <section className="fluent-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
    <h2>{t('backup.title')}</h2><p>{t('backup.description')}</p>
    <input className="fluent-input" type="password" autoComplete="new-password" minLength={12} maxLength={256} aria-label={t('backup.password')} placeholder={t('backup.password')} value={password} onChange={event => setPassword(event.target.value)} disabled={busy || restart} />
    <div style={{ display: 'flex', gap: 12 }}>
      <button className="fluent-button" disabled={busy || restart || password.length < 12} onClick={() => perform(false)}>{t('backup.create')}</button>
      <button className="fluent-button" disabled={busy || restart || password.length < 12} onClick={() => perform(true)}>{t('backup.restore')}</button>
      {restart && <button className="fluent-button" onClick={() => window.lsip.invoke('backup:restart')}>{t('backup.restart')}</button>}
    </div>
    {busy && <div role="status" aria-busy="true" style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(0,0,0,0.8)', display: 'grid', placeItems: 'center', color: 'white' }}>{t('backup.working')}</div>}
    {result && <p role="status" style={{ overflowWrap: 'anywhere' }}>{result}</p>}
  </section>;
}
