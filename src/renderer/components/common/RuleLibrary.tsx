import React, { useEffect, useState } from 'react';
import { useTranslation, message } from '../../i18n';

type Rule = {id: string; revision: number; title: string; content: string};
export function RuleLibrary({kind, content, onLoad}: {kind: string; content: string; onLoad: (value: string) => void}) {
  const {t} = useTranslation();
  const [rules, setRules] = useState<Rule[]>([]);
  const [selected, setSelected] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setSelected(''); setTitle(''); setRules([]); setError('');
    window.lsip.invoke('ioc:rule-list', {kind}).then((response: any) => {
      if (!active) return;
      if (!response?.success) throw new Error(response?.error?.message || 'Rule library unavailable');
      setRules(response.data);
    }).catch((e: Error) => {if (active) setError(e.message)});
    return () => {active = false};
  }, [kind]);
  async function save() {
    setBusy(true); setError('');
    try {
      const previous = rules.find(r => `${r.id}:${r.revision}` === selected);
      const response = await window.lsip.invoke('ioc:rule-save', {kind, title, content, id: previous?.id, expectedRevision: previous?.revision});
      if (!response?.success) throw new Error(response?.error?.message || 'Rule save failed');
      const rule: Rule = response.data;
      setRules(old => [rule, ...old].slice(0, 200));
      setSelected(`${rule.id}:${rule.revision}`);
    } catch (e: any) {setError(e.message)} finally {setBusy(false)}
  }
  return <section className="fluent-card" style={{padding: 16}}>
    <strong>{t('ruleLibrary.title')}</strong>
    <p style={{color: 'var(--text-secondary)', fontSize: 12}}>{t('ruleLibrary.notice')}</p>
    <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
      <select className="fluent-input" aria-label={t('ruleLibrary.title')} value={selected} disabled={busy} onChange={e => {
        setSelected(e.target.value); setError('');
        const rule = rules.find(r => `${r.id}:${r.revision}` === e.target.value);
        setTitle(rule?.title || ''); if (rule) onLoad(rule.content);
      }}>
        <option value="">{t('ruleLibrary.new')}</option>
        {rules.map(rule => <option key={`${rule.id}:${rule.revision}`} value={`${rule.id}:${rule.revision}`}>{rule.title} · v{rule.revision}</option>)}
      </select>
      <input className="fluent-input" aria-label={t('ruleLibrary.name')} placeholder={t('ruleLibrary.name')} maxLength={200} value={title} onChange={e => setTitle(e.target.value)} disabled={busy}/>
      <button className="fluent-button" disabled={busy || !title.trim() || !content.trim()} onClick={save}>{t('ruleLibrary.save')}</button>
    </div>
    {error && <p role="alert">{message(error)}</p>}
  </section>;
}
