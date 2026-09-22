import { message } from "../../i18n";
import { t as translateText } from "../../i18n";
import React, { useState } from 'react';
import { BookOpen, Search, Code2, Shield, FileText } from 'lucide-react';
import { useTranslation } from '../../i18n';

interface KbArticle {
  id: string;
  category: 'Windows Internals' | 'MITRE ATT&CK' | 'Sigma/YARA' | 'Kerberos/SMB' | 'Event IDs';
  title: string;
  summary: string;
  details: string;
}

export const OfflineKnowledgeBaseView: React.FC = () => {
  const { t } = useTranslation();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedArticle, setSelectedArticle] = useState<KbArticle | null>(null);

  const articles: KbArticle[] = [
    {
      id: 'KB-101',
      category: 'Windows Internals',
      title: 'LSASS Memory Protection & Credential Guard',
      summary: 'Architectural breakdown of LSA isolation, LSASS process memory injection techniques, and Mimikatz SSP mitigation.',
      details: 'Local Security Authority Subsystem Service (LSASS) enforces local security policy. Attackers use Process Injection (T1055) or LSASS Memory Dump (T1003.001) to harvest NTLM hashes and Kerberos tickets. Enable Windows Defender Credential Guard (LsaCfgFlags=1) to isolate LSA secrets inside a Virtualization-based Security (VBS) container.',
    },
    {
      id: 'KB-102',
      category: 'Event IDs',
      title: 'Critical Windows Security Event IDs for SOC Monitoring',
      summary: 'Essential Event Tracing for Windows (ETW) Event IDs for threat detection.',
      details: `• Event ID 4688: New process created (Requires Audit Process Creation + Command Line Audit enabled).
• Event ID 4624 / 4625: Successful / Failed Logon attempts. LogonType 3 = Network, LogonType 10 = RemoteDesktop.
• Event ID 4768 / 4769: Kerberos TGT requested / Kerberos Service Ticket requested (Kerberoasting T1558.003).
• Sysmon Event ID 1: Process Creation with Hashes.
• Sysmon Event ID 3: Network Connection Initiated.
• Sysmon Event ID 13: Registry Value Set.`,
    },
    {
      id: 'KB-103',
      category: 'Sigma/YARA',
      title: 'Sigma & YARA Rule Authoring Best Practices',
      summary: 'Offline rule writing guidelines for detecting malicious process creation and memory signatures.',
      details: 'Sigma rules standardize log detection logic across SIEMs. YARA rules evaluate binary memory or file byte sequences. Ensure condition selections avoid overly broad wildcards on common binaries (cmd.exe, powershell.exe) to minimize false positives.',
    },
  ];

  const filtered = articles.filter((a) => {
    const matchCat = selectedCategory === 'all' || a.category === selectedCategory;
    const matchSearch = !searchQuery || a.title.toLowerCase().includes(searchQuery.toLowerCase()) || a.summary.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="view-container" style={{ padding: '20px', gap: '20px', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'linear-gradient(135deg, #059669, #047857)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <BookOpen size={22} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>{t('v3.knowledgeBase.title')}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: 0 }}>
              {t('v3.knowledgeBase.subtitle')}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            className="fluent-input"
            placeholder={translateText("interfaceText.message168")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ fontSize: '0.82rem', width: '220px' }}
          />

          <select className="fluent-input" value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} style={{ fontSize: '0.82rem' }}>
            <option value="all">{translateText("interfaceText.message169")}</option>
            <option value="Windows Internals">{translateText("interfaceText.message170")}</option>
            <option value="Event IDs">{translateText("interfaceText.message171")}</option>
            <option value="Sigma/YARA">{translateText("interfaceText.message172")}</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '20px', flex: 1 }}>
        {/* Articles List */}
        <div className="fluent-card" style={{ padding: '16px', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '6px', color: 'var(--accent-primary)' }}> {translateText("interfaceText.message173")}{filtered.length})
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filtered.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedArticle(item)}
                style={{
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: selectedArticle?.id === item.id ? '2px solid var(--accent-primary)' : '1px solid var(--border-primary)',
                  background: selectedArticle?.id === item.id ? 'var(--bg-primary)' : 'transparent',
                  cursor: 'pointer',
                }}
              >
                <span className="badge badge-blue" style={{ fontSize: '0.7rem' }}>{message(item.category)}</span>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, marginTop: '4px' }}>{message(item.title)}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{message(item.summary)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Selected Article Viewer */}
        <div className="fluent-card" style={{ padding: '20px', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {selectedArticle ? (
            <div>
              <span className="badge badge-blue">{message(selectedArticle.category)}</span>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '8px 0 4px 0' }}>{message(selectedArticle.title)}</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: '16px' }}>{message(selectedArticle.summary)}</p>
              <hr style={{ borderColor: 'var(--border-primary)', marginBottom: '16px' }} />
              <div style={{ fontSize: '0.88rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', color: 'var(--text-primary)' }}>
                {message(selectedArticle.details)}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic', textAlign: 'center', marginTop: '40px' }}> {translateText("interfaceText.message174")} </div>
          )}
        </div>
      </div>
    </div>
  );
};
