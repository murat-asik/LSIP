import { message } from '../../i18n';
import { RuleLibrary } from '../../components/common/RuleLibrary';
import { t as translateText } from "../../i18n";
import React, { useState } from 'react';
import { FlaskConical, Play, CheckCircle2, AlertTriangle, Code2, Database } from 'lucide-react';
import { useTranslation } from '../../i18n';

export const DetectionLabView: React.FC = () => {
  const { t } = useTranslation();
  const [ruleType, setRuleType] = useState<'Sigma' | 'YARA' | 'IOC'>('Sigma');
  const [ruleContent, setRuleContent] = useState<string>(`title: Suspicious PowerShell Encoded Execution
id: 3b82f6a1-9f86-4d65-9a2f-eaa0c55ad015
status: experimental
description: Detects powershell.exe execution containing base64 encoded payload strings
logsource:
  category: process_creation
  product: windows
detection:
  selection:
    Image|endswith: '\\powershell.exe'
    CommandLine|contains:
      - '-EncodedCommand'
      - '-e '
  condition: selection
level: high`);

  const [testResult, setTestResult] = useState<any | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [targetPath, setTargetPath] = useState('');

  const [error, setError] = useState('');
  const drafts = React.useRef<Record<string,string>>({YARA:'rule file_indicator {\n  strings:\n    $indicator = "replace_with_your_indicator"\n  condition:\n    $indicator\n}',IOC:''});
  const selectRuleType = (next:'Sigma'|'YARA'|'IOC') => {
    drafts.current[ruleType]=ruleContent;
    setRuleContent(drafts.current[next] ?? '');setRuleType(next);setTestResult(null);setError('');
  };
  const handleTestRule = async () => {
    setIsTesting(true);setError('');setTestResult(null);
    try {
      const response = await window.lsip.invoke('ioc:evaluate-rule', {kind:ruleType,content:ruleContent,targetPath});
      if (!response?.success) throw new Error(response?.error?.message || response?.error || 'Rule evaluation failed');
      setTestResult(response.data);
    } catch (e:any) { setError(e.message); }
    finally { setIsTesting(false); }
  };

  return (
    <div className="view-container" style={{ padding: '20px', gap: '20px', overflowY: 'auto' }}>
      <RuleLibrary key={ruleType} kind={ruleType} content={ruleContent} onLoad={value => {setRuleContent(value); setTestResult(null); setError('')}} />
      {error && <div role="alert" style={{color:"var(--accent-danger)"}}>{message(error)}</div>}
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'linear-gradient(135deg, #e11d48, #be123c)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <FlaskConical size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>{t('v3.detectionLab.title')}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: 0 }}>
              {t('v3.detectionLab.subtitle')}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button disabled={isTesting} className={`fluent-button ${ruleType === 'Sigma' ? 'active' : ''}`} onClick={() => selectRuleType('Sigma')}>{t('v3.detectionLab.sigmaRules')}</button>
          <button disabled={isTesting} className={`fluent-button ${ruleType === 'YARA' ? 'active' : ''}`} onClick={() => selectRuleType('YARA')}>{t('v3.detectionLab.yaraRules')}</button>
          <button disabled={isTesting} className={`fluent-button ${ruleType === 'IOC' ? 'active' : ''}`} onClick={() => selectRuleType('IOC')}>{t('v3.detectionLab.iocRules')}</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', flex: 1 }}>
        {/* Editor */}
        <div className="fluent-card" style={{ padding: '16px', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Code2 size={16} style={{ color: 'var(--accent-primary)' }} /> {t('v3.detectionLab.ruleEditor', { ruleType }) || `${ruleType} Rule Editor`}
            </div>
            <button className="fluent-button" style={{ background: 'var(--accent-primary)', color: 'white', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={handleTestRule} disabled={isTesting}>
              <Play size={14} /> {isTesting ? t('v3.detectionLab.testing') : t(ruleType==='YARA'?'operational.scanFile':'v3.detectionLab.runTest')}
            </button>
          </div>

          {ruleType === 'YARA' && <label>{t('common.path')}<input className="fluent-input" style={{width:'100%'}} value={targetPath} onChange={e=>setTargetPath(e.target.value)} /></label>}
          <textarea
            className="fluent-input"
            rows={16}
            style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', lineHeight: 1.45, background: 'var(--bg-primary)' }}
            value={ruleContent}
            onChange={(e) => setRuleContent(e.target.value)}
          />
        </div>

        {/* Results */}
        <div className="fluent-card" style={{ padding: '16px', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={16} style={{ color: 'var(--accent-success)' }} /> {t('v3.detectionLab.testResultsTitle') || 'Offline Replay Test Results'}
          </div>

          {testResult ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p>{t('operational.recordsScanned',{count:testResult.recordsScanned})}</p>
              <div style={{ padding: '12px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-success)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={16} /> {t('v3.detectionLab.syntaxValidated') || 'Rule Syntax Validated'}
                </span>
                <span className="badge badge-red">{t('v3.detectionLab.matchesFound', { count: testResult.matchesCount }) || `${testResult.matchesCount} Historic Matches Found`}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {testResult.matchedEvents.map((evt: any, idx: number) => (
                  <div key={idx} style={{ padding: '10px', borderRadius: '6px', background: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{translateText("interfaceText.message054")} {evt.eventId}</span>
                      <span>{evt.timestamp}</span>
                    </div>
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, marginTop: '4px' }}>{evt.process}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{evt.cmd}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontStyle: 'italic', textAlign: 'center', marginTop: '40px' }}> {translateText("interfaceText.message154")} </div>
          )}
        </div>
      </div>
    </div>
  );
};
