import { createViewPolling, stopViewPolling } from '../hooks/view-polling';
import { t as translateText } from "../i18n";
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from '../i18n';
import {
  Activity,
  Cpu,
  Database,
  Download,
  HardDrive,
  Layers,
  MemoryStick,
  RefreshCw,
  Server,
  Shield,
  Zap,
  ChevronDown,
  ChevronUp,
  Circle,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
interface PerformanceSnapshot {
  timestamp: number;
  mainProcess: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
    uptime: number;
  };
  modules: {
    total: number;
    initialized: number;
    active: number;
    sleeping: number;
    disposed: number;
    details: Array<{
      name: string;
      displayName: string;
      lifecycleState: string;
      lastActivityAt: number;
      ipcHandlerCount: number;
      timerCount: number;
    }>;
  };
  workerPool: {
    totalWorkers: number;
    activeWorkers: number;
    idleWorkers: number;
    queueDepth: number;
    completedTasks: number;
    failedTasks: number;
    averageTaskDurationMs: number;
  };
  cache: {
    l1Size: number;
    l1HitRate: number;
    l1Hits: number;
    l1Misses: number;
  };
  database: {
    openConnections: number;
  };
  environment: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
};

const formatUptime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${h}h ${m}m ${s}s`;
};

const getStateColor = (state: string): string => {
  switch (state) {
    case 'ACTIVE': return '#22c55e';
    case 'INITIALIZED': return '#3b82f6';
    case 'SLEEPING': return '#f59e0b';
    case 'DISPOSED': return '#ef4444';
    case 'CREATED': return '#6b7280';
    default: return '#6b7280';
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────
const MetricCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  color?: string;
}> = ({ icon, label, value, sub, color = 'var(--accent-primary)' }) => (
  <div style={{
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: '10px',
    padding: '14px 18px',
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    minWidth: '180px',
    flex: '1 1 180px',
  }}>
    <div style={{
      width: 40,
      height: 40,
      borderRadius: '8px',
      background: `${color}1a`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color,
      flexShrink: 0,
    }}>
      {icon}
    </div>
    <div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 2 }}>{sub}</div>}
    </div>
  </div>
);

const SectionHeader: React.FC<{ icon: React.ReactNode; title: string; expanded: boolean; onToggle: () => void }> = ({ icon, title, expanded, onToggle }) => (
  <div
    onClick={onToggle}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '10px 0',
      cursor: 'pointer',
      borderBottom: '1px solid var(--border-color)',
      marginBottom: 12,
      userSelect: 'none',
    }}
  >
    <span style={{ color: 'var(--accent-primary)' }}>{icon}</span>
    <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', flex: 1 }}>{title}</span>
    <span style={{ color: 'var(--text-secondary)' }}>{expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export const PerformanceMonitor: React.FC = () => {
  const { t } = useTranslation();
  const [snapshot, setSnapshot] = useState<PerformanceSnapshot | null>(null);
  const [fps, setFps] = useState(0);
  const [isLive, setIsLive] = useState(true);
  const [refreshMs, setRefreshMs] = useState(1000);
  const [expandedSections, setExpandedSections] = useState({
    memory: true,
    modules: true,
    workers: true,
    cache: true,
    details: false,
  });

  const frameCount = useRef(0);
  const lastFpsTime = useRef(performance.now());
  const animRef = useRef<number>(0);

  // FPS counter
  const measureFps = useCallback(() => {
    frameCount.current++;
    const now = performance.now();
    if (now - lastFpsTime.current >= 1000) {
      setFps(frameCount.current);
      frameCount.current = 0;
      lastFpsTime.current = now;
    }
    animRef.current = requestAnimationFrame(measureFps);
  }, []);

  useEffect(() => {
    animRef.current = requestAnimationFrame(measureFps);
    return () => cancelAnimationFrame(animRef.current);
  }, [measureFps]);

  // Metrics polling
  const fetchMetrics = useCallback(async () => {
    try {
      const data = await (window as any).lsip.invoke('perf:get-metrics');
      setSnapshot(data);
    } catch (err) {
      console.warn('[PerfMonitor] Failed to fetch metrics:', err);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    if (!isLive) return;
    const id = createViewPolling('perf-monitor', fetchMetrics, refreshMs);
    return () => stopViewPolling(id);
  }, [isLive, refreshMs, fetchMetrics]);

  const toggleSection = (key: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const exportDiagnostics = () => {
    if (!snapshot) return;
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lsip-diagnostics-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="view-container" style={{ padding: '20px 24px', overflowY: 'auto', background: 'var(--bg-primary)' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Activity size={20} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              {t('performanceMonitor.title')}
            </h1>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0 }}>
              {t('performanceMonitor.subtitle')}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* FPS Badge */}
          <div style={{
            background: fps >= 55 ? '#22c55e22' : fps >= 30 ? '#f59e0b22' : '#ef444422',
            border: `1px solid ${fps >= 55 ? '#22c55e' : fps >= 30 ? '#f59e0b' : '#ef4444'}`,
            borderRadius: 6, padding: '4px 10px',
            fontSize: '0.72rem', fontWeight: 700,
            color: fps >= 55 ? '#22c55e' : fps >= 30 ? '#f59e0b' : '#ef4444',
          }}>
            {fps} FPS
          </div>

          {/* Live toggle */}
          <div
            onClick={() => setIsLive(l => !l)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 6, cursor: 'pointer',
              background: isLive ? '#22c55e22' : 'var(--bg-secondary)',
              border: `1px solid ${isLive ? '#22c55e' : 'var(--border-color)'}`,
              fontSize: '0.75rem', fontWeight: 600,
              color: isLive ? '#22c55e' : 'var(--text-secondary)',
            }}
          >
            <Circle size={8} style={{ fill: isLive ? '#22c55e' : 'currentColor' }} />
            {isLive ? 'LIVE' : 'PAUSED'}
          </div>

          <select
            value={refreshMs}
            onChange={e => setRefreshMs(Number(e.target.value))}
            style={{
              background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
              color: 'var(--text-primary)', borderRadius: 6, padding: '6px 8px',
              fontSize: '0.75rem', cursor: 'pointer',
            }}
          >
            <option value={500}>500ms</option>
            <option value={1000}>1s</option>
            <option value={2000}>2s</option>
            <option value={5000}>5s</option>
          </select>

          <button
            onClick={fetchMetrics}
            style={{
              background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)', borderRadius: 6, padding: '6px 10px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              fontSize: '0.75rem',
            }}
          >
            <RefreshCw size={13} /> {translateText("interfaceText.message119")} </button>

          <button
            onClick={exportDiagnostics}
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none',
              color: '#fff', borderRadius: 6, padding: '6px 12px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              fontSize: '0.75rem', fontWeight: 600,
            }}
          >
            <Download size={13} /> {translateText("interfaceText.message120")} </button>
        </div>
      </div>

      {!snapshot ? (
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 40 }}> {translateText("interfaceText.message121")} </div>
      ) : (
        <>
          {/* ── MEMORY SECTION ─────────────────────────────────────────────── */}
          <SectionHeader icon={<MemoryStick size={16} />} title={translateText("interfaceText.message122")} expanded={expandedSections.memory} onToggle={() => toggleSection('memory')} />
          {expandedSections.memory && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
              <MetricCard
                icon={<HardDrive size={18} />}
                label="Heap Used"
                value={formatBytes(snapshot.mainProcess.heapUsed)}
                sub={`of ${formatBytes(snapshot.mainProcess.heapTotal)}`}
                color="#6366f1"
              />
              <MetricCard
                icon={<Server size={18} />}
                label="RSS Memory"
                value={formatBytes(snapshot.mainProcess.rss)}
                sub="Resident Set Size"
                color="#8b5cf6"
              />
              <MetricCard
                icon={<Zap size={18} />}
                label="External"
                value={formatBytes(snapshot.mainProcess.external)}
                sub="Native allocations"
                color="#a855f7"
              />
              <MetricCard
                icon={<Activity size={18} />}
                label="Uptime"
                value={formatUptime(snapshot.mainProcess.uptime)}
                color="#3b82f6"
              />
              <MetricCard
                icon={<Shield size={18} />}
                label="Environment"
                value={snapshot.environment}
                color="#22c55e"
              />
            </div>
          )}

          {/* ── MODULE LIFECYCLE SECTION ─────────────────────────────────── */}
          <SectionHeader icon={<Layers size={16} />} title={translateText("interfaceText.message123")} expanded={expandedSections.modules} onToggle={() => toggleSection('modules')} />
          {expandedSections.modules && (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                <MetricCard icon={<Layers size={18} />} label="Total Modules" value={String(snapshot.modules.total)} color="#6366f1" />
                <MetricCard icon={<Zap size={18} />} label="Active" value={String(snapshot.modules.active)} color="#22c55e" />
                <MetricCard icon={<Layers size={18} />} label="Initialized" value={String(snapshot.modules.initialized)} color="#3b82f6" />
                <MetricCard icon={<Activity size={18} />} label="Sleeping" value={String(snapshot.modules.sleeping)} color="#f59e0b" />
                <MetricCard icon={<Shield size={18} />} label="Disposed" value={String(snapshot.modules.disposed)} color="#ef4444" />
              </div>
            </>
          )}

          {/* ── WORKER POOL SECTION ──────────────────────────────────────── */}
          <SectionHeader icon={<Cpu size={16} />} title={translateText("interfaceText.message124")} expanded={expandedSections.workers} onToggle={() => toggleSection('workers')} />
          {expandedSections.workers && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
              <MetricCard icon={<Cpu size={18} />} label="Total Workers" value={String(snapshot.workerPool.totalWorkers)} color="#6366f1" />
              <MetricCard icon={<Zap size={18} />} label="Active Workers" value={String(snapshot.workerPool.activeWorkers)} color="#22c55e" />
              <MetricCard icon={<Activity size={18} />} label="Idle Workers" value={String(snapshot.workerPool.idleWorkers)} color="#3b82f6" />
              <MetricCard icon={<Server size={18} />} label="Queue Depth" value={String(snapshot.workerPool.queueDepth)} color="#f59e0b" />
              <MetricCard icon={<Zap size={18} />} label="Completed Tasks" value={String(snapshot.workerPool.completedTasks)} color="#22c55e" />
              <MetricCard icon={<Shield size={18} />} label="Failed Tasks" value={String(snapshot.workerPool.failedTasks)} color="#ef4444" />
              <MetricCard icon={<Activity size={18} />} label="Avg Task Duration" value={`${snapshot.workerPool.averageTaskDurationMs}ms`} color="#8b5cf6" />
            </div>
          )}

          {/* ── CACHE SECTION ────────────────────────────────────────────── */}
          <SectionHeader icon={<Database size={16} />} title={translateText("interfaceText.message125")} expanded={expandedSections.cache} onToggle={() => toggleSection('cache')} />
          {expandedSections.cache && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
              <MetricCard icon={<Database size={18} />} label="L1 Cache Size" value={String(snapshot.cache.l1Size)} sub="entries in memory" color="#6366f1" />
              <MetricCard icon={<Zap size={18} />} label="L1 Hit Rate" value={`${snapshot.cache.l1HitRate}%`} color="#22c55e" />
              <MetricCard icon={<Activity size={18} />} label="Cache Hits" value={String(snapshot.cache.l1Hits)} color="#3b82f6" />
              <MetricCard icon={<Server size={18} />} label="Cache Misses" value={String(snapshot.cache.l1Misses)} color="#f59e0b" />
              <MetricCard icon={<Database size={18} />} label="SQLite Connections" value={String(snapshot.database.openConnections)} color="#8b5cf6" />
            </div>
          )}

          {/* ── MODULE DETAILS TABLE ─────────────────────────────────────── */}
          <SectionHeader icon={<Layers size={16} />} title={translateText("interfaceText.message126")} expanded={expandedSections.details} onToggle={() => toggleSection('details')} />
          {expandedSections.details && (
            <div style={{ marginBottom: 24 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    {['Module', 'State', 'IPC Handlers', 'Timers', 'Last Activity'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {snapshot.modules.details.map(mod => {
                    const idleMs = Date.now() - mod.lastActivityAt;
                    const idleStr = idleMs < 60000 ? `${Math.round(idleMs / 1000)}s ago` : `${Math.round(idleMs / 60000)}m ago`;
                    return (
                      <tr key={mod.name} style={{ borderBottom: '1px solid var(--border-color)22' }}>
                        <td style={{ padding: '7px 12px', color: 'var(--text-primary)', fontWeight: 500 }}>{mod.displayName}</td>
                        <td style={{ padding: '7px 12px' }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            padding: '2px 8px', borderRadius: 4,
                            background: `${getStateColor(mod.lifecycleState)}22`,
                            color: getStateColor(mod.lifecycleState),
                            fontSize: '0.68rem', fontWeight: 700,
                          }}>
                            {mod.lifecycleState}
                          </span>
                        </td>
                        <td style={{ padding: '7px 12px', color: 'var(--text-secondary)', textAlign: 'center' }}>{mod.ipcHandlerCount}</td>
                        <td style={{ padding: '7px 12px', color: 'var(--text-secondary)', textAlign: 'center' }}>{mod.timerCount}</td>
                        <td style={{ padding: '7px 12px', color: 'var(--text-secondary)' }}>{mod.lifecycleState === 'CREATED' ? '—' : idleStr}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Last update timestamp */}
          <div style={{ textAlign: 'right', fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: 8 }}> {translateText("interfaceText.message127")} {new Date(snapshot.timestamp).toLocaleTimeString()} {translateText("interfaceText.message128")} {refreshMs}ms
          </div>
        </>
      )}
    </div>
  );
};

export default PerformanceMonitor;
