import { useModuleData } from '../../hooks/useModuleData';
import { DataStatus } from '../../components/common/DataStatus';
import { t as translateText } from "../../i18n";
import React, { useState } from 'react';
import { Cpu, Terminal, ShieldAlert, CheckCircle2, FileText, ChevronRight } from 'lucide-react';
import { useTranslation } from '../../i18n';

interface ProcessNode {
  pid: number;
  ppid: number;
  name: string;
  commandLine: string;
  sha256: string;
  signer: string;
  riskScore: number;
  children?: ProcessNode[];
}

export const ProcessTreeView: React.FC = () => {
  const { t } = useTranslation();
  const [selectedProcess, setSelectedProcess] = useState<ProcessNode | null>(null);

  const snapshot = useModuleData<any[]>('process:list', undefined, []);
  const nodes = new Map<number, ProcessNode>(snapshot.data.map(p => [p.pid, {pid:p.pid, ppid:p.ppid, name:p.name, commandLine:p.commandLine || t('common.unknown'), sha256:'', signer:p.signerName || p.signatureStatus || t('common.unknown'), riskScore:0, children:[]} ]));
  const roots: ProcessNode[] = [];
  for (const node of nodes.values()) {
    const visited = new Set([node.pid]); let ancestor = nodes.get(node.ppid); let cyclic = false;
    while (ancestor) { if (visited.has(ancestor.pid)) {cyclic=true;break;} visited.add(ancestor.pid); ancestor=nodes.get(ancestor.ppid); }
    const parent = nodes.get(node.ppid);
    if (parent && !cyclic) parent.children!.push(node); else roots.push(node);
  }

  const renderTree = (node: ProcessNode, depth: number = 0) => (
    <div key={node.pid} style={{ marginLeft: `${depth * 20}px`, marginTop: '8px' }}>
      <div
        onClick={() => setSelectedProcess(node)}
        style={{
          padding: '8px 12px',
          borderRadius: '6px',
          background: selectedProcess?.pid === node.pid ? 'var(--bg-primary)' : 'transparent',
          border: selectedProcess?.pid === node.pid ? '2px solid var(--accent-primary)' : '1px solid var(--border-primary)',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ChevronRight size={14} style={{ color: 'var(--text-secondary)' }} />
          <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-primary)' }}>PID: {node.pid}</span>
          <strong style={{ fontSize: '0.85rem' }}>{node.name}</strong>
        </div>

        {node.riskScore > 0 ? (
          <span className="badge badge-red">{node.riskScore}{translateText("interfaceText.message152")}</span>
        ) : (
          <span className="badge">{t("common.unknown")}</span>
        )}
      </div>

      {node.children && node.children.map((child) => renderTree(child, depth + 1))}
    </div>
  );

  return (
    <div className="view-container" style={{ padding: '20px', gap: '20px', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'linear-gradient(135deg, #2563eb, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
          <Cpu size={22} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>{t('v3.processTree.title')}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: 0 }}>
            {t('v3.processTree.subtitle')}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px', flex: 1 }}>
        {/* Tree Container */}
        <div className="fluent-card" style={{ padding: '16px', background: 'var(--bg-secondary)', overflowY: 'auto' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Terminal size={16} style={{ color: 'var(--accent-primary)' }} /> {translateText("interfaceText.message175")} </div>
          <DataStatus {...snapshot} empty={!nodes.size} />{roots.map(node => renderTree(node))}
        </div>

        {/* Process Inspector Sidebar */}
        <div className="fluent-card" style={{ padding: '16px', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={16} style={{ color: 'var(--accent-primary)' }} /> {translateText("interfaceText.message176")} </div>

          {selectedProcess ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ padding: '12px', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent-primary)' }}>PID: {selectedProcess.pid} • PPID: {selectedProcess.ppid}</span>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '4px 0' }}>{selectedProcess.name}</h3>
                <span className="badge">{t("common.riskScore")}: {t("common.unknown")}</span>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{translateText("interfaceText.message178")}</label>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', padding: '8px', background: 'var(--bg-primary)', borderRadius: '6px', wordBreak: 'break-all', border: '1px solid var(--border-primary)', marginTop: '4px' }}>
                  {selectedProcess.commandLine}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{translateText("interfaceText.message179")}</label>
                <div style={{ fontSize: '0.8rem', padding: '6px 8px', background: 'var(--bg-primary)', borderRadius: '4px', border: '1px solid var(--border-primary)', marginTop: '4px' }}>
                  {selectedProcess.signer}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontStyle: 'italic', textAlign: 'center', marginTop: '40px' }}> {translateText("interfaceText.message180")} </div>
          )}
        </div>
      </div>
    </div>
  );
};
