import { createViewPolling, stopViewPolling } from '../hooks/view-polling';
import { message } from "../i18n";
import React, { useEffect, useState, useMemo } from 'react';
import { useAppStore } from '../stores/app.store';
import { useTranslation } from '../i18n';
import { ProcessInfo, ThreadInfo, ModuleInfo } from '../../shared/types/process.types';
import {
  Search,
  RefreshCw,
  Cpu,
  Trash2,
  Shield,
} from 'lucide-react';

export const ProcessExplorer: React.FC = () => {
  const { t } = useTranslation();
  const { searchQuery } = useAppStore();
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [selectedPid, setSelectedPid] = useState<number | null>(null);
  const [selectedProcessDetails, setSelectedProcessDetails] = useState<ProcessInfo | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'details' | 'threads' | 'modules'>('details');
  const [threads, setThreads] = useState<ThreadInfo[]>([]);
  const [modules, setModules] = useState<ModuleInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(3000);
  const [localSearch, setLocalSearch] = useState('');

  const fetchProcesses = async () => {
    setIsLoading(true);
    try {
      const list = await window.lsip.invoke('process:list');
      const processData = list?.data || [];
      setProcesses(processData);
      
      // Update selected process details if currently selected
      if (selectedPid !== null) {
        const found = processData.find((p: ProcessInfo) => p.pid === selectedPid);
        if (found) setSelectedProcessDetails(found);
      }
    } catch (e) {
      console.error('Failed to fetch processes', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Poll processes list
  useEffect(() => {
    fetchProcesses();
    const timer = createViewPolling('process', fetchProcesses, refreshInterval);
    return () => stopViewPolling(timer);
  }, [refreshInterval, selectedPid]);

  // Load secondary details when selection changes
  useEffect(() => {
    if (selectedPid === null) {
      setSelectedProcessDetails(null);
      setThreads([]);
      setModules([]);
      return;
    }

    const proc = processes.find(p => p.pid === selectedPid);
    if (proc) {
      setSelectedProcessDetails(proc);
    }

    const loadDetails = async () => {
      try {
        if (activeDetailTab === 'threads') {
          const tList = await window.lsip.invoke('process:threads', { pid: selectedPid });
          setThreads(tList?.data || []);
        } else if (activeDetailTab === 'modules') {
          const mList = await window.lsip.invoke('process:modules', { pid: selectedPid });
          setModules(mList?.data || []);
        }
      } catch (e) {
        console.error(e);
      }
    };

    loadDetails();
  }, [selectedPid, activeDetailTab, processes]);

  const handleTerminate = async (pid: number) => {
    if (confirm(message(t('processExplorerView.confirmTerminate').replace('{pid}', pid.toString())))) {
      try {
        const success = await window.lsip.invoke('process:terminate', { pid });
        if (success?.data) {
          setSelectedPid(null);
          fetchProcesses();
        } else {
          alert(message(t('processExplorerView.terminateFailed')));
        }
      } catch (e: any) {
        alert(message(`${t('processExplorerView.terminateFailed')}: ${e.message}`));
      }
    }
  };

  // Filter processes
  const filteredProcesses = useMemo(() => {
    const query = (localSearch || searchQuery || '').toLowerCase();
    return processes.filter(p => {
      return (
        p.name.toLowerCase().includes(query) ||
        p.pid.toString().includes(query) ||
        (p.user && p.user.toLowerCase().includes(query)) ||
        (p.path && p.path.toLowerCase().includes(query))
      );
    });
  }, [processes, localSearch, searchQuery]);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: selectedPid ? '1.5fr 1fr' : '1fr',
        gap: '16px',
        height: 'calc(100vh - var(--topbar-height) - var(--statusbar-height) - 40px)',
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '20px',
      }}
    >
      {/* Left panel: Processes List */}
      <div className="fluent-card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%' }}>
        {/* Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cpu size={18} /> {t('processExplorerView.activeProcesses')} ({filteredProcesses.length})
            </h2>
            <div style={{ position: 'relative', width: '240px' }}>
              <input
                type="text"
                placeholder={t('processExplorerView.filterPlaceholder')}
                className="fluent-input"
                style={{ width: '100%', paddingLeft: '32px' }}
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
              />
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '11px', color: 'var(--text-secondary)' }} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <select
              className="fluent-input"
              style={{ padding: '6px 12px' }}
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
            >
              <option value={1000}>{t('connectionMapView.refreshInterval1s')}</option>
              <option value={3000}>{t('connectionMapView.refreshInterval3s')}</option>
              <option value={5000}>{t('connectionMapView.refreshInterval5s')}</option>
              <option value={0}>{t('connectionMapView.pauseRefresh')}</option>
            </select>
            <button className="fluent-button" onClick={fetchProcesses} disabled={isLoading}>
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Table grid */}
        <div className="fluent-table-container">
          <table className="fluent-table">
            <thead>
              <tr>
                <th>{t('processExplorerView.processName')}</th>
                <th>{t('processExplorerView.pid')}</th>
                <th>{t('processExplorerView.cpuUsage')}</th>
                <th>{t('processExplorerView.workingSetRam')}</th>
                <th>{t('processExplorerView.userOwner')}</th>
                <th>{t('processExplorerView.integrity')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredProcesses.map((p) => {
                const isSelected = selectedPid === p.pid;
                const ramMb = (p.memoryUsageBytes / 1024 / 1024).toFixed(1) + ' MB';
                return (
                  <tr
                    key={p.pid}
                    onClick={() => setSelectedPid(p.pid)}
                    style={{
                      backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.12)' : undefined,
                      borderLeft: isSelected ? '3px solid var(--accent-primary)' : undefined,
                    }}
                  >
                    <td style={{ fontWeight: 500, color: p.isElevated ? '#fbbf24' : 'var(--text-primary)' }}>
                      {p.name}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{p.pid}</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{p.cpuUsage}%</td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{ramMb}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{p.user}</td>
                    <td>
                      <span className={`status-pill ${p.integrityLevel === 'System' ? 'danger' : p.integrityLevel === 'High' ? 'warning' : 'info'}`}>
                        {p.integrityLevel}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filteredProcesses.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <div className="fluent-empty-state">
                      <Cpu size={48} />
                      <h3>{t('processExplorerView.noProcessesFound')}</h3>
                      <p>{t('processExplorerView.noProcessesDesc')}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right panel: Details Inspector */}
      {selectedPid && selectedProcessDetails && (
        <div className="fluent-card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', height: '100%' }}>
          {/* Detail header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-primary)', paddingBottom: '12px', marginBottom: '12px' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600 }}>{selectedProcessDetails.name}</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>PID: {selectedProcessDetails.pid} | PPID: {selectedProcessDetails.ppid}</span>
            </div>
            <button
              onClick={() => handleTerminate(selectedProcessDetails.pid)}
              className="fluent-button"
              style={{ color: 'var(--accent-danger)', borderColor: 'rgba(220, 38, 38, 0.3)', padding: '6px 12px' }}
            >
              <Trash2 size={14} /> {t('processExplorerView.terminate')}
            </button>
          </div>

          {/* Details tab switcher */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-primary)', marginBottom: '14px' }}>
            <button
              onClick={() => setActiveDetailTab('details')}
              style={{
                background: 'none',
                border: 'none',
                color: activeDetailTab === 'details' ? 'var(--accent-primary-hover)' : 'var(--text-secondary)',
                padding: '8px 16px',
                cursor: 'pointer',
                fontWeight: activeDetailTab === 'details' ? 500 : 400,
                borderBottom: activeDetailTab === 'details' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              }}
            >
              {t('processExplorerView.details')}
            </button>
            <button
              onClick={() => setActiveDetailTab('threads')}
              style={{
                background: 'none',
                border: 'none',
                color: activeDetailTab === 'threads' ? 'var(--accent-primary-hover)' : 'var(--text-secondary)',
                padding: '8px 16px',
                cursor: 'pointer',
                fontWeight: activeDetailTab === 'threads' ? 500 : 400,
                borderBottom: activeDetailTab === 'threads' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              }}
            >
              {t('processExplorerView.threads')} ({selectedProcessDetails.threadCount})
            </button>
            <button
              onClick={() => setActiveDetailTab('modules')}
              style={{
                background: 'none',
                border: 'none',
                color: activeDetailTab === 'modules' ? 'var(--accent-primary-hover)' : 'var(--text-secondary)',
                padding: '8px 16px',
                cursor: 'pointer',
                fontWeight: activeDetailTab === 'modules' ? 500 : 400,
                borderBottom: activeDetailTab === 'modules' ? '2px solid var(--accent-primary)' : '2px solid transparent',
              }}
            >
              {t('processExplorerView.dllsModules')}
            </button>
          </div>

          {/* Tab content */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {activeDetailTab === 'details' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>{t('processExplorerView.executablePath')}</span>
                  <div style={{ padding: '8px', backgroundColor: 'var(--bg-primary)', borderRadius: '4px', wordBreak: 'break-all', fontFamily: 'var(--font-mono)' }}>
                    {selectedProcessDetails.path || 'N/A'}
                  </div>
                </div>

                <div>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>{t('processExplorerView.commandLine')}</span>
                  <div style={{ padding: '8px', backgroundColor: 'var(--bg-primary)', borderRadius: '4px', wordBreak: 'break-all', fontFamily: 'var(--font-mono)' }}>
                    {selectedProcessDetails.commandLine || 'N/A'}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>{t('processExplorerView.userContext')}</span>
                    <span style={{ fontWeight: 500 }}>{selectedProcessDetails.user}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>{t('processExplorerView.privilegeElevation')}</span>
                    <span style={{ fontWeight: 500, color: selectedProcessDetails.isElevated ? '#fbbf24' : 'inherit' }}>
                      {selectedProcessDetails.isElevated ? t('processExplorerView.elevatedAdmin') : t('processExplorerView.standardUser')}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>{t('processExplorerView.handlesCount')}</span>
                    <span style={{ fontWeight: 500, fontFamily: 'var(--font-mono)' }}>{selectedProcessDetails.handleCount}</span>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>{t('processExplorerView.digitalSignature')}</span>
                    <span style={{ fontWeight: 500, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px', color: selectedProcessDetails.isSigned ? 'var(--accent-success)' : (selectedProcessDetails.signatureStatus !== 'Unknown' ? 'var(--accent-danger)' : 'var(--text-secondary)') }}>
                      <Shield size={14} /> {selectedProcessDetails.isSigned ? t('processExplorerView.verified') : (selectedProcessDetails.signatureStatus || t('processExplorerView.unverified'))}
                      {selectedProcessDetails.signerName && (
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginLeft: '4px' }}>
                          ({selectedProcessDetails.signerName})
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {activeDetailTab === 'threads' && (
              <div className="fluent-table-container" style={{ maxHeight: '100%' }}>
                <table className="fluent-table" style={{ fontSize: '0.8rem' }}>
                  <thead>
                    <tr>
                      <th>{t('processExplorerView.tid')}</th>
                      <th>{t('processExplorerView.priority')}</th>
                      <th>{t('processExplorerView.state')}</th>
                      <th>{t('processExplorerView.startAddress')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {threads.map((tItem) => (
                      <tr key={tItem.threadId}>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{tItem.threadId}</td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{tItem.priority}</td>
                        <td>{tItem.state}</td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{tItem.startAddress}</td>
                      </tr>
                    ))}
                    {threads.length === 0 && (
                      <tr>
                        <td colSpan={4}>
                          <div className="fluent-empty-state" style={{ minHeight: '100px' }}>
                            <p>{t('processExplorerView.noThreadsFound')}</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeDetailTab === 'modules' && (
              <div className="fluent-table-container" style={{ maxHeight: '100%' }}>
                <table className="fluent-table" style={{ fontSize: '0.8rem' }}>
                  <thead>
                    <tr>
                      <th>{t('processExplorerView.moduleName')}</th>
                      <th>{t('processExplorerView.size')}</th>
                      <th>{t('processExplorerView.baseAddress')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modules.map((m) => (
                      <tr key={m.baseAddress} title={m.path}>
                        <td style={{ fontWeight: 500 }}>{m.name}</td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{(m.sizeBytes / 1024).toFixed(0)} KB</td>
                        <td style={{ fontFamily: 'var(--font-mono)' }}>{m.baseAddress}</td>
                      </tr>
                    ))}
                    {modules.length === 0 && (
                      <tr>
                        <td colSpan={3}>
                          <div className="fluent-empty-state" style={{ minHeight: '100px' }}>
                            <p>{t('processExplorerView.noModulesFound')}</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
