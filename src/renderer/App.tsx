import { CollectionHealth } from './components/common/CollectionHealth';
import { useCaseManagementStore } from './stores/case-management.store';
import { t as translateText } from "./i18n";
import React, { lazy, Suspense, useEffect, useRef, useCallback, useState } from 'react';
import { useAppStore } from './stores/app.store';
import { AppShell } from './components/layout/AppShell';
import { Shield, Loader2 } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Lazy-loaded views — each becomes a separate async chunk.
// Components only download + mount on first navigation to their tab.
// ─────────────────────────────────────────────────────────────────────────────

// BLUE TEAM
const Dashboard = lazy(() => import('./views/Dashboard').then(m => ({ default: m.Dashboard })));
const ProcessExplorer = lazy(() => import('./views/ProcessExplorer').then(m => ({ default: m.ProcessExplorer })));
const AssetDiscovery = lazy(() => import('./views/AssetDiscovery').then(m => ({ default: m.AssetDiscovery })));
const EventExplorer = lazy(() => import('./views/EventExplorer').then(m => ({ default: m.EventExplorer })));
const ConnectionMap = lazy(() => import('./views/ConnectionMap').then(m => ({ default: m.ConnectionMap })));
const NetworkTopology = lazy(() => import('./views/NetworkTopology').then(m => ({ default: m.NetworkTopology })));
const ReputationEngine = lazy(() => import('./views/ReputationEngine').then(m => ({ default: m.ReputationEngine })));
const InternetInvestigation = lazy(() => import('./views/InternetInvestigation').then(m => ({ default: m.InternetInvestigation })));
const TimelineView = lazy(() => import('./views/TimelineView').then(m => ({ default: m.TimelineView })));
const DnsIntelligence = lazy(() => import('./views/DnsIntelligence').then(m => ({ default: m.DnsIntelligence })));
const SmbIntelligence = lazy(() => import('./views/SmbIntelligence').then(m => ({ default: m.SmbIntelligence })));
const RdpMonitor = lazy(() => import('./views/RdpMonitor').then(m => ({ default: m.RdpMonitor })));
const UsbMonitor = lazy(() => import('./views/UsbMonitor').then(m => ({ default: m.UsbMonitor })));
const FileIntegrity = lazy(() => import('./views/FileIntegrity').then(m => ({ default: m.FileIntegrity })));
const PersistenceScanner = lazy(() => import('./views/PersistenceScanner').then(m => ({ default: m.PersistenceScanner })));
const ThreadExplorer = lazy(() => import('./views/ThreadExplorer').then(m => ({ default: m.ThreadExplorer })));
const DllScanner = lazy(() => import('./views/DllScanner').then(m => ({ default: m.DllScanner })));
const CertScanner = lazy(() => import('./views/CertScanner').then(m => ({ default: m.CertScanner })));
const IocScanner = lazy(() => import('./views/IocScanner').then(m => ({ default: m.IocScanner })));
const BehaviorAnalytics = lazy(() => import('./views/BehaviorAnalytics').then(m => ({ default: m.BehaviorAnalytics })));
const AiAnalystView = lazy(() => import('./views/AiAnalystView').then(m => ({ default: m.AiAnalystView })));
const ReportGenerator = lazy(() => import('./views/ReportGenerator').then(m => ({ default: m.ReportGenerator })));
const PluginSystem = lazy(() => import('./views/PluginSystem').then(m => ({ default: m.PluginSystem })));
const SettingsView = lazy(() => import('./views/SettingsView').then(m => ({ default: m.SettingsView })));

// DFIR WORKSPACE
const DfirEvidenceView = lazy(() => import('./views/dfir/DfirEvidenceView').then(m => ({ default: m.DfirEvidenceView })));
const DfirMemoryView = lazy(() => import('./views/dfir/DfirMemoryView').then(m => ({ default: m.DfirMemoryView })));
const DfirRegistryView = lazy(() => import('./views/dfir/DfirRegistryView').then(m => ({ default: m.DfirRegistryView })));
const DfirArtifactsView = lazy(() => import('./views/dfir/DfirArtifactsView').then(m => ({ default: m.DfirArtifactsView })));

// RED TEAM WORKSPACE
const RedTeamPortScannerView = lazy(() => import('./views/redteam/RedTeamPortScannerView').then(m => ({ default: m.RedTeamPortScannerView })));
const RedTeamHttpSslView = lazy(() => import('./views/redteam/RedTeamHttpSslView').then(m => ({ default: m.RedTeamHttpSslView })));
const RedTeamDnsWhoisView = lazy(() => import('./views/redteam/RedTeamDnsWhoisView').then(m => ({ default: m.RedTeamDnsWhoisView })));
const RedTeamAttackSurfaceView = lazy(() => import('./views/redteam/RedTeamAttackSurfaceView').then(m => ({ default: m.RedTeamAttackSurfaceView })));

// LSIP V3.0 ENTERPRISE VIEWS
const CaseManagementView = lazy(() => import('./views/v3/CaseManagementView').then(m => ({ default: m.CaseManagementView })));
const IocGraphView = lazy(() => import('./views/v3/IocGraphView').then(m => ({ default: m.IocGraphView })));
const EvidenceLockerView = lazy(() => import('./views/v3/EvidenceLockerView').then(m => ({ default: m.EvidenceLockerView })));
const ForensicTimelineView = lazy(() => import('./views/v3/ForensicTimelineView').then(m => ({ default: m.ForensicTimelineView })));
const ProcessTreeView = lazy(() => import('./views/v3/ProcessTreeView').then(m => ({ default: m.ProcessTreeView })));
const DetectionLabView = lazy(() => import('./views/v3/DetectionLabView').then(m => ({ default: m.DetectionLabView })));
const ThreatHuntingView = lazy(() => import('./views/v3/ThreatHuntingView').then(m => ({ default: m.ThreatHuntingView })));
const MitreMatrixView = lazy(() => import('./views/v3/MitreMatrixView').then(m => ({ default: m.MitreMatrixView })));
const PurpleTeamMatrixView = lazy(() => import('./views/v3/PurpleTeamMatrixView').then(m => ({ default: m.PurpleTeamMatrixView })));
const OfflineKnowledgeBaseView = lazy(() => import('./views/v3/OfflineKnowledgeBaseView').then(m => ({ default: m.OfflineKnowledgeBaseView })));

// PERFORMANCE MONITOR (engineering-only)
const PerformanceMonitor = lazy(() => import('./views/PerformanceMonitor').then(m => ({ default: m.PerformanceMonitor })));

// ─────────────────────────────────────────────────────────────────────────────
// Error Boundary
// ─────────────────────────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error('React ErrorBoundary caught error:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: 'red', padding: '20px', background: 'black' }}>
          <h1>{translateText("interfaceText.message001")}</h1>
          <pre>{this.state.error?.toString()}</pre>
          <pre>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading Fallback
// ─────────────────────────────────────────────────────────────────────────────
const ModuleLoadingFallback: React.FC = () => (
  <div style={{
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '16px',
    color: 'var(--text-secondary)',
  }}>
    <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-primary)' }} />
    <span style={{ fontSize: '0.85rem', letterSpacing: '0.05em' }}>{translateText("interfaceText.message002")}</span>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Lazy View Renderer — mounts view on first visit, keeps mounted thereafter
// ─────────────────────────────────────────────────────────────────────────────
interface LazyViewProps {
  tabKey: string;
  isActive: boolean;
  children: React.ReactNode;
}

const LazyView: React.FC<LazyViewProps> = ({ tabKey, isActive, children }) => {
  const hasBeenVisited = useRef(false);

  if (isActive && !hasBeenVisited.current) {
    hasBeenVisited.current = true;
  }

  // Only render if visited at least once — prevents all views mounting at startup
  if (!hasBeenVisited.current) return null;

  return (
    <div
      key={tabKey}
      data-view={tabKey}
      aria-hidden={!isActive}
      style={{
        display: isActive ? 'block' : 'none',
        height: '100%',
        width: '100%',
      }}
    >
      {children}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main App Component
// ─────────────────────────────────────────────────────────────────────────────
export const App: React.FC = () => {
  const { activeTab } = useAppStore();
  const storageError = useCaseManagementStore(state => state.storageError);

  // Activate backend module on first tab navigation
  const activatedModules = useRef(new Set<string>());
  const [readyTabs, setReadyTabs] = useState<Set<string>>(new Set());
  const [activationErrors, setActivationErrors] = useState<Record<string, string>>({});

  const activateModule = useCallback(async (tabId: string) => {

    try {
      const result = await window.lsip.invoke('module-manager:activate', tabId);
      if (!result?.success) throw new Error(result?.reason || 'Module initialization failed');
      activatedModules.current.add(tabId);
      setReadyTabs(current => new Set([...current, tabId]));
      setActivationErrors(current => ({ ...current, [tabId]: '' }));
    } catch (err) {
      setActivationErrors(current => ({ ...current, [tabId]: String(err) }));
      console.warn(`[App] Module activation for tab '${tabId}' failed:`, err);
    }
  }, []);

  useEffect(() => {
    activateModule(activeTab);
  }, [activeTab, activateModule]);

  // Helper to create view entry with lazy mount
  const view = (tabKey: string, component: React.ReactNode) => (
    <LazyView key={tabKey} tabKey={tabKey} isActive={activeTab === tabKey}>
      {activationErrors[tabKey] ? <div role="alert" style={{ padding: 24 }}>
        <p>{activationErrors[tabKey]}</p>
        <button className="fluent-button" onClick={() => activateModule(tabKey)}>{translateText('common.refresh')}</button>
      </div> : readyTabs.has(tabKey) ? <Suspense fallback={<ModuleLoadingFallback />}>
        {component}
      </Suspense> : <ModuleLoadingFallback />}
    </LazyView>
  );

  return (
    <ErrorBoundary>
      <AppShell>
        <CollectionHealth tab={activeTab} />
        {storageError && <div role="alert" style={{ padding: 12, color: 'var(--accent-danger)' }}>
          {translateText(storageError === 'recovery' ? 'caseStorage.recovery' : 'caseStorage.write')}
        </div>}
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          {/* BLUE TEAM */}
          {view('dashboard', <Dashboard />)}
          {view('process', <ProcessExplorer />)}
          {view('assets', <AssetDiscovery />)}
          {view('events', <EventExplorer />)}
          {view('connections', <ConnectionMap />)}
          {view('topology', <NetworkTopology />)}
          {view('reputation', <ReputationEngine />)}
          {view('internet-investigation', <InternetInvestigation />)}
          {view('timeline', <TimelineView />)}
          {view('dns', <DnsIntelligence />)}
          {view('smb', <SmbIntelligence />)}
          {view('rdp', <RdpMonitor />)}
          {view('usb', <UsbMonitor />)}
          {view('fim', <FileIntegrity />)}
          {view('persistence', <PersistenceScanner />)}
          {view('threads', <ThreadExplorer />)}
          {view('dlls', <DllScanner />)}
          {view('certs', <CertScanner />)}
          {view('ioc', <IocScanner />)}
          {view('behavior', <BehaviorAnalytics />)}
          {view('ai-analyst', <AiAnalystView />)}
          {view('reports', <ReportGenerator />)}
          {view('plugins', <PluginSystem />)}
          {view('settings', <SettingsView />)}

          {/* DFIR WORKSPACE */}
          {view('dfir-evidence', <DfirEvidenceView />)}
          {view('dfir-memory', <DfirMemoryView />)}
          {view('dfir-registry', <DfirRegistryView />)}
          {view('dfir-prefetch', <DfirArtifactsView artifactType="prefetch" title={translateText("interfaceText.message003")} />)}
          {view('dfir-amcache', <DfirArtifactsView artifactType="amcache" title={translateText("interfaceText.message004")} />)}
          {view('dfir-shimcache', <DfirArtifactsView artifactType="shimcache" title={translateText("interfaceText.message005")} />)}
          {view('dfir-jumplists', <DfirArtifactsView artifactType="jumplists" title={translateText("interfaceText.message006")} />)}
          {view('dfir-srum', <DfirArtifactsView artifactType="srum" title={translateText("interfaceText.message007")} />)}
          {view('dfir-usn', <DfirArtifactsView artifactType="usn" title={translateText("interfaceText.message008")} />)}
          {view('dfir-recycle', <DfirArtifactsView artifactType="recycle" title={translateText("interfaceText.message009")} />)}

          {/* RED TEAM WORKSPACE */}
          {view('red-ports', <RedTeamPortScannerView />)}
          {view('red-http', <RedTeamHttpSslView />)}
          {view('red-dns', <RedTeamDnsWhoisView />)}
          {view('red-surface', <RedTeamAttackSurfaceView />)}

          {/* LSIP V3.0 ENTERPRISE VIEWS */}
          {view('v3-cases', <CaseManagementView />)}
          {view('v3-ioc-graph', <IocGraphView />)}
          {view('v3-evidence', <EvidenceLockerView />)}
          {view('v3-timeline', <ForensicTimelineView />)}
          {view('v3-process-tree', <ProcessTreeView />)}
          {view('v3-detection-lab', <DetectionLabView />)}
          {view('v3-hunting', <ThreatHuntingView />)}
          {view('v3-mitre', <MitreMatrixView />)}
          {view('v3-purple', <PurpleTeamMatrixView />)}
          {view('v3-knowledge', <OfflineKnowledgeBaseView />)}

          {/* ENGINEERING — Performance Monitor */}
          {view('perf-monitor', <PerformanceMonitor />)}

        </div>
      </AppShell>
    </ErrorBoundary>
  );
};

const PlaceholderView: React.FC<{ tabName: string }> = ({ tabName }) => {
  const formattedName = tabName.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <div className="view-container" style={{ justifyContent: 'center', alignItems: 'center', height: '100%', textAlign: 'center' }}>
      <div className="fluent-card fluent-glass" style={{ maxWidth: '480px', padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
        <Shield size={32} style={{ color: 'var(--accent-primary-hover)' }} />
        <h2 style={{ fontSize: '1.3rem', fontWeight: 600 }}>{formattedName} {translateText("interfaceText.message010")}</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}> {translateText("interfaceText.message011")} </p>
        <button className="fluent-button" onClick={() => useAppStore.getState().setActiveTab('dashboard')}> {translateText("interfaceText.message012")} </button>
      </div>
    </div>
  );
};

export default App;
