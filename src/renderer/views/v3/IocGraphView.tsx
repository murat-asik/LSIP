import { useCaseManagementStore } from '../../stores/case-management.store';
import { useModuleData } from '../../hooks/useModuleData';
import { DataStatus } from '../../components/common/DataStatus';
import { message } from "../../i18n";
import { t as translateText } from "../../i18n";
import React, { useState } from 'react';
import { Network, Share2, Globe, Shield, Database, Cpu, Server, Key, Eye } from 'lucide-react';
import { useTranslation } from '../../i18n';

interface GraphNode {
  id: string;
  label: string;
  type: 'ip' | 'domain' | 'url' | 'hash' | 'asn' | 'country' | 'provider' | 'cert' | 'case';
  riskScore: number;
  x: number;
  y: number;
}

interface GraphLink {
  source: string;
  target: string;
  relation: string;
}

export const IocGraphView: React.FC = () => {
  const { t } = useTranslation();
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  const { cases } = useCaseManagementStore();
  const history = useModuleData<any[]>('correlation:get-history', {}, []);
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const addNode = (id:string,label:string,type:GraphNode['type'],riskScore:number) => {
    if(nodes.some(n=>n.id===id))return;
    const i=nodes.length;nodes.push({id,label,type,riskScore,x:100+(i%4)*180,y:70+Math.floor(i/4)*110});
  };
  for(const item of history.data) addNode('ioc:'+item.indicator,item.indicator,item.type,Number(item.score)||0);
  for(const item of cases) {
    if(!item.iocs.length)continue;
    addNode(item.id,item.title,'case',0);
    for(const ioc of item.iocs){addNode('ioc:'+ioc.value,ioc.value,ioc.type as GraphNode['type'],ioc.riskScore);links.push({source:item.id,target:'ioc:'+ioc.value,relation:t('operational.caseIndicator')});}
  }

  const getNodeColor = (type: string, score: number) => {
    if (score >= 70) return '#ef4444';
    if (score >= 30) return '#f97316';
    if (type === 'provider') return '#3b82f6';
    if (type === 'asn') return '#8b5cf6';
    if (type === 'cert') return '#10b981';
    return '#64748b';
  };

  return (
    <div className="view-container" style={{ padding: '20px', gap: '20px', overflowY: 'auto' }}>
      <DataStatus {...history} empty={!nodes.length} />
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'linear-gradient(135deg, #0284c7, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
          <Share2 size={22} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.4rem', fontWeight: 700, margin: 0 }}>{t('v3.iocGraph.title')}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: 0 }}>
            {t('v3.iocGraph.subtitle')}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px', height: 'calc(100vh - 170px)' }}>
        {/* Graph Canvas Card */}
        <div className="fluent-card" style={{ padding: '16px', background: 'var(--bg-secondary)', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Network size={16} style={{ color: 'var(--accent-primary)' }} /> {translateText("interfaceText.message162")} </div>

          <svg viewBox={`0 0 800 ${Math.max(500,Math.ceil(nodes.length/4)*110+80)}`} style={{ width: '100%', height: '100%', background: 'var(--bg-primary)', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
            {/* Draw Links */}
            {links.map((link, idx) => {
              const srcNode = nodes.find((n) => n.id === link.source);
              const tgtNode = nodes.find((n) => n.id === link.target);
              if (!srcNode || !tgtNode) return null;
              return (
                <g key={idx}>
                  <line x1={srcNode.x} y1={srcNode.y} x2={tgtNode.x} y2={tgtNode.y} stroke="var(--border-primary)" strokeWidth="2" strokeDasharray="4" />
                  <text x={(srcNode.x + tgtNode.x) / 2} y={(srcNode.y + tgtNode.y) / 2 - 6} fill="var(--text-secondary)" fontSize="10" textAnchor="middle">
                    {link.relation}
                  </text>
                </g>
              );
            })}

            {/* Draw Nodes */}
            {nodes.map((node) => (
              <g key={node.id} onClick={() => setSelectedNode(node)} style={{ cursor: 'pointer' }}>
                <circle cx={node.x} cy={node.y} r="22" fill={getNodeColor(node.type, node.riskScore)} stroke="white" strokeWidth="2" />
                <text x={node.x} y={node.y + 36} fill="var(--text-primary)" fontSize="11" fontWeight="600" textAnchor="middle">
                  {message(node.label)}
                </text>
              </g>
            ))}
          </svg>
        </div>

        {/* Selected Node Details Sidebar */}
        <div className="fluent-card" style={{ padding: '16px', background: 'var(--bg-secondary)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Eye size={16} style={{ color: 'var(--accent-primary)' }} /> {translateText("interfaceText.message163")} </div>

          {selectedNode ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--accent-primary)' }}>{selectedNode.type}</span>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '4px 0', fontFamily: 'var(--font-mono)' }}>{message(selectedNode.label)}</h3>
                {selectedNode.riskScore > 0 && (
                  <span className="badge badge-red" style={{ marginTop: '6px' }}>{selectedNode.riskScore}{translateText("interfaceText.message164")}</span>
                )}
              </div>

              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}> {translateText("interfaceText.message165")} <strong>{links.filter((l) => l.source === selectedNode.id || l.target === selectedNode.id).length}</strong> {translateText("interfaceText.message166")} </div>
            </div>
          ) : (
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontStyle: 'italic', textAlign: 'center', marginTop: '40px' }}> {translateText("interfaceText.message167")} </div>
          )}
        </div>
      </div>
    </div>
  );
};
