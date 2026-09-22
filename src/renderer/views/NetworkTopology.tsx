import { createViewPolling, stopViewPolling } from '../hooks/view-polling';
import { message } from "../i18n";
import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from '../i18n';
import { Asset } from '../../shared/types/asset.types';
import { ActiveConnection } from '../../shared/types/network.types';
import { Network, Server, Laptop, Router, Globe, RefreshCw } from 'lucide-react';

interface TopologyNode {
  id: string;
  label: string;
  ip: string;
  type: 'local' | 'asset' | 'external';
  x: number;
  y: number;
  riskScore: number;
  details?: any;
}

interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  active: boolean;
  protocol?: string;
  port?: number;
}

export const NetworkTopology: React.FC = () => {
  const { t } = useTranslation();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [connections, setConnections] = useState<ActiveConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null);
  
  // Pan and Zoom State
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Dimensions for SVG
  const width = 800;
  const height = 600;
  const centerX = width / 2;
  const centerY = height / 2;

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [assetsRes, connsRes] = await Promise.all([
        window.lsip.invoke('assets:get-all'),
        window.lsip.invoke('connection:active')
      ]);
      setAssets(assetsRes?.data || []);
      setConnections(connsRes?.data || []);
    } catch (e) {
      console.error('Failed to load topology data', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = createViewPolling('topology', fetchData, 5000);
    return () => stopViewPolling(interval);
  }, []);

  const { nodes, edges } = useMemo(() => {
    const newNodes: TopologyNode[] = [];
    const newEdges: TopologyEdge[] = [];

    // Center Node (Local Machine)
    newNodes.push({
      id: 'local',
      label: t('networkTopologyView.localMachine'),
      ip: '127.0.0.1',
      type: 'local',
      x: centerX,
      y: centerY,
      riskScore: 0
    });

    // Subnet Assets (Inner Ring)
    const assetRadius = 160;
    const assetCount = assets.length;
    assets.forEach((asset, i) => {
      const angle = (i / (assetCount || 1)) * 2 * Math.PI;
      newNodes.push({
        id: asset.id,
        label: asset.hostname || asset.ipAddress,
        ip: asset.ipAddress,
        type: 'asset',
        x: centerX + assetRadius * Math.cos(angle),
        y: centerY + assetRadius * Math.sin(angle),
        riskScore: asset.riskScore || 0,
        details: asset
      });
      // Edge from local to asset
      newEdges.push({
        id: `edge-local-${asset.id}`,
        source: 'local',
        target: asset.id,
        active: false // We don't necessarily have active connections, but we discovered them
      });
    });

    // External Connections (Outer Ring)
    // Filter connections to only those that are established and non-local
    const externalConns = connections.filter(c => 
      c.state === 'ESTABLISHED' && 
      !c.remoteAddress.startsWith('127.') && 
      !c.remoteAddress.startsWith('192.168.') &&
      !c.remoteAddress.startsWith('10.') &&
      c.remoteAddress !== '0.0.0.0' && 
      c.remoteAddress !== '*' &&
      c.remoteAddress !== '::1' &&
      c.remoteAddress !== '::'
    );

    // Group by remote IP to avoid too many nodes
    const uniqueExternals = new Map<string, ActiveConnection[]>();
    externalConns.forEach(c => {
      if (!uniqueExternals.has(c.remoteAddress)) {
        uniqueExternals.set(c.remoteAddress, []);
      }
      uniqueExternals.get(c.remoteAddress)!.push(c);
    });

    const externalRadius = 280;
    const extCount = uniqueExternals.size;
    let extIndex = 0;
    
    uniqueExternals.forEach((conns, ip) => {
      const angle = (extIndex / (extCount || 1)) * 2 * Math.PI + (Math.PI / 4); // offset angle
      const id = `ext-${ip}`;
      newNodes.push({
        id,
        label: ip,
        ip: ip,
        type: 'external',
        x: centerX + externalRadius * Math.cos(angle),
        y: centerY + externalRadius * Math.sin(angle),
        riskScore: 0,
        details: conns
      });
      
      newEdges.push({
        id: `edge-local-${id}`,
        source: 'local',
        target: id,
        active: true,
        protocol: conns[0].protocol,
        port: conns[0].remotePort
      });
      extIndex++;
    });

    return { nodes: newNodes, edges: newEdges };
  }, [assets, connections]);

  const getNodeIcon = (node: TopologyNode) => {
    if (node.type === 'local') return <Laptop size={24} style={{ color: '#fff' }} />;
    if (node.type === 'external') return <Globe size={20} style={{ color: '#fff' }} />;
    // Asset device type heuristics
    if (node.details?.deviceType === 'router') return <Router size={20} style={{ color: '#fff' }} />;
    if (node.details?.deviceType === 'server') return <Server size={20} style={{ color: '#fff' }} />;
    return <Network size={20} style={{ color: '#fff' }} />;
  };

  const getNodeColor = (node: TopologyNode) => {
    if (node.type === 'local') return 'var(--accent-primary)';
    if (node.type === 'external') return 'var(--accent-info)';
    if (node.riskScore > 50) return 'var(--accent-danger)';
    if (node.riskScore > 20) return 'var(--accent-warning)';
    return 'var(--accent-success)';
  };

  return (
    <div className="view-container" style={{ position: 'relative', overflowY: 'auto', overflowX: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(79, 70, 229, 0.2))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Network size={22} style={{ color: 'var(--accent-primary)' }} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.3rem', fontWeight: 600 }}>{t('networkTopologyView.title')}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{t('networkTopologyView.subtitle')}</p>
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="fluent-button" onClick={() => setTransform({ x: 0, y: 0, scale: 1 })}>
             {t('networkTopologyView.resetView')}
          </button>
          <button className="fluent-button" onClick={fetchData} disabled={isLoading}>
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            {t('networkTopologyView.refreshMap')}
          </button>
        </div>
      </div>

      {/* Main Graph Area */}
      <div 
        className="fluent-card fluent-glass" 
        style={{ 
          flex: 1, 
          position: 'relative', 
          overflow: 'hidden', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          background: 'radial-gradient(circle at center, rgba(37, 99, 235, 0.05) 0%, rgba(10, 14, 23, 0.8) 100%)',
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
        onWheel={(e) => {
          e.preventDefault();
          const scaleChange = e.deltaY > 0 ? 0.9 : 1.1;
          setTransform(prev => ({ ...prev, scale: Math.max(0.2, Math.min(prev.scale * scaleChange, 4)) }));
        }}
        onMouseDown={(e) => {
          if (e.button !== 0) return; // Only left click
          setIsDragging(true);
          setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
        }}
        onMouseMove={(e) => {
          if (!isDragging) return;
          setTransform(prev => ({ ...prev, x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }));
        }}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
      >
        <svg 
          viewBox={`0 0 ${width} ${height}`} 
          style={{ width: '100%', height: '100%', minHeight: '600px', filter: 'drop-shadow(0px 0px 10px rgba(0,0,0,0.5))' }}
        >
          {/* Defs for gradients and glow */}
          <defs>
            <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.5" />
              <stop offset="100%" stopColor="transparent" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="activeEdge" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.8" />
              <stop offset="100%" stopColor="var(--accent-info)" stopOpacity="0.8" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
            {/* Edges */}
            {edges.map((edge) => {
              const source = nodes.find(n => n.id === edge.source);
              const target = nodes.find(n => n.id === edge.target);
              if (!source || !target) return null;

            return (
              <g key={edge.id}>
                <line
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke={edge.active ? 'url(#activeEdge)' : 'rgba(255,255,255,0.1)'}
                  strokeWidth={edge.active ? 2 : 1}
                  strokeDasharray={edge.active ? '5,5' : 'none'}
                >
                  {edge.active && (
                    <animate attributeName="stroke-dashoffset" from="10" to="0" dur="1s" repeatCount="indefinite" />
                  )}
                </line>
                {edge.active && edge.port && (
                  <text
                    x={(source.x + target.x) / 2}
                    y={(source.y + target.y) / 2 - 5}
                    fill="var(--text-secondary)"
                    fontSize="10"
                    textAnchor="middle"
                  >
                    {edge.protocol} {edge.port}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const isSelected = selectedNode?.id === node.id;
            const nodeColor = getNodeColor(node);
            const size = node.type === 'local' ? 36 : 28;

            return (
              <g 
                key={node.id} 
                transform={`translate(${node.x}, ${node.y})`} 
                onClick={() => setSelectedNode(node)}
                style={{ cursor: 'pointer', transition: 'all 0.3s ease' }}
                opacity={selectedNode && !isSelected ? 0.4 : 1}
              >
                <circle 
                  r={size + 8} 
                  fill={nodeColor} 
                  opacity={isSelected ? 0.3 : 0.15} 
                  filter={isSelected ? 'url(#glow)' : ''}
                >
                  {isSelected && <animate attributeName="r" values={`${size+8}; ${size+14}; ${size+8}`} dur="2s" repeatCount="indefinite" />}
                </circle>
                
                <circle 
                  r={size} 
                  fill={nodeColor}
                  stroke="rgba(255,255,255,0.2)"
                  strokeWidth="2"
                />
                
                <foreignObject x={-size} y={-size} width={size*2} height={size*2}>
                  <div style={{ display: 'flex', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                    {getNodeIcon(node)}
                  </div>
                </foreignObject>
                
                <text 
                  y={size + 16} 
                  fill="var(--text-primary)" 
                  fontSize="11" 
                  fontWeight={isSelected ? 600 : 400}
                  textAnchor="middle"
                  style={{ textShadow: '0px 2px 4px rgba(0,0,0,0.8)' }}
                >
                  {message(node.label)}
                </text>
                {node.type !== 'local' && (
                  <text 
                    y={size + 28} 
                    fill="var(--text-secondary)" 
                    fontSize="9" 
                    textAnchor="middle"
                  >
                    {node.ip}
                  </text>
                )}
              </g>
            );
          })}
          </g>
        </svg>

        {/* Legend */}
        <div style={{ position: 'absolute', bottom: '20px', left: '20px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--border-primary)', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontWeight: 600, marginBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '4px' }}>{t('networkTopologyView.legendTitle')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--accent-primary)' }}></div> {t('networkTopologyView.localhost')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--accent-success)' }}></div> {t('networkTopologyView.localAssetSafe')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--accent-danger)' }}></div> {t('networkTopologyView.localAssetRisky')}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><div style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--accent-info)' }}></div> {t('networkTopologyView.externalConn')}</div>
        </div>

        {/* Selected Node Details Panel */}
        {selectedNode && selectedNode.type !== 'local' && (
          <div 
            style={{ 
              position: 'absolute', 
              top: '20px', 
              right: '20px', 
              width: '280px', 
              background: 'rgba(15, 23, 42, 0.95)', 
              backdropFilter: 'blur(10px)',
              borderRadius: '8px', 
              border: '1px solid var(--border-primary)', 
              padding: '16px',
              boxShadow: 'var(--shadow-elevated)',
              animation: 'slideIn 0.3s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: getNodeColor(selectedNode), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {getNodeIcon(selectedNode)}
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>{message(selectedNode.label)}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{selectedNode.type === 'asset' ? t('networkTopologyView.localNetworkAsset') : t('networkTopologyView.externalEndpoint')}</div>
                </div>
              </div>
              <button onClick={() => setSelectedNode(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem' }}>&times;</button>
            </div>

            <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{t('networkTopologyView.ipAddress')}</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{selectedNode.ip}</span>
              </div>
              
              {selectedNode.type === 'asset' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>MAC</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{selectedNode.details?.macAddress || t('common.unknown')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{t('assetDiscoveryView.vendor')}</span>
                    <span>{selectedNode.details?.vendor || t('common.unknown')}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '4px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{t('networkTopologyView.riskScore')}</span>
                    <span style={{ color: selectedNode.riskScore > 50 ? 'var(--accent-danger)' : 'var(--accent-success)' }}>{selectedNode.riskScore}</span>
                  </div>
                </>
              )}

              {selectedNode.type === 'external' && selectedNode.details && selectedNode.details.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>{t('networkTopologyView.activeSockets')}</span>
                  <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {selectedNode.details.map((c: any, i: number) => (
                      <div key={i} style={{ background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '4px', fontSize: '0.75rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                          <span style={{ fontWeight: 500, color: 'var(--accent-info)' }}>{c.protocol}</span>
                          <span style={{ fontFamily: 'var(--font-mono)' }}>Port {c.remotePort}</span>
                        </div>
                        <div style={{ color: 'var(--text-secondary)' }}>{t('networkTopologyView.process')}: {c.processName || c.pid}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
};

export default NetworkTopology;
