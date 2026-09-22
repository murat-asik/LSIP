import { t as translateText } from "../../i18n";
import React from 'react';
import { useAppStore, WorkspaceType } from '../../stores/app.store';
import { useTranslation } from '../../i18n';
import {
  LayoutDashboard,
  SearchCode,
  ShieldAlert,
  Share2,
  Activity,
  Cpu,
  GitFork,
  Box,
  FileSpreadsheet,
  Clock,
  Globe2,
  FolderLock,
  Monitor,
  Award,
  Usb,
  Fingerprint,
  Key,
  Binary,
  Brain,
  FileOutput,
  ToyBrick,
  ChevronLeft,
  ChevronRight,
  Settings,
  Shield,
  FileSearch,
  Crosshair,
  Database,
  Terminal,
  FileCode,
  HardDrive,
  Layers,
  Sparkles,
  BarChart3,
} from 'lucide-react';

interface SidebarItem {
  id: string;
  labelKey: string;
  icon: React.ComponentType<any>;
  workspace: WorkspaceType;
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  // BLUE TEAM
  { id: 'dashboard', labelKey: 'socDashboard', icon: LayoutDashboard, workspace: 'blue' },
  { id: 'assets', labelKey: 'assetDiscovery', icon: SearchCode, workspace: 'blue' },
  { id: 'reputation', labelKey: 'reputationEngine', icon: ShieldAlert, workspace: 'blue' },
  { id: 'internet-investigation', labelKey: 'threatIntel', icon: Globe2, workspace: 'blue' },
  { id: 'topology', labelKey: 'netTopology', icon: Share2, workspace: 'blue' },
  { id: 'connections', labelKey: 'connMonitor', icon: Activity, workspace: 'blue' },
  { id: 'process', labelKey: 'processExplorer', icon: Cpu, workspace: 'blue' },
  { id: 'threads', labelKey: 'threadExplorer', icon: GitFork, workspace: 'blue' },
  { id: 'dlls', labelKey: 'dllDependency', icon: Box, workspace: 'blue' },
  { id: 'events', labelKey: 'eventExplorer', icon: FileSpreadsheet, workspace: 'blue' },
  { id: 'timeline', labelKey: 'timelineView', icon: Clock, workspace: 'blue' },
  { id: 'dns', labelKey: 'dnsIntel', icon: Globe2, workspace: 'blue' },
  { id: 'smb', labelKey: 'smbIntel', icon: FolderLock, workspace: 'blue' },
  { id: 'rdp', labelKey: 'rdpMonitor', icon: Monitor, workspace: 'blue' },
  { id: 'certs', labelKey: 'certScanner', icon: Award, workspace: 'blue' },
  { id: 'usb', labelKey: 'usbMonitor', icon: Usb, workspace: 'blue' },
  { id: 'fim', labelKey: 'fim', icon: Fingerprint, workspace: 'blue' },
  { id: 'persistence', labelKey: 'persistenceScanner', icon: Key, workspace: 'blue' },
  { id: 'ioc', labelKey: 'iocScanner', icon: Binary, workspace: 'blue' },
  { id: 'behavior', labelKey: 'behaviorAnalytics', icon: Brain, workspace: 'blue' },
  { id: 'ai-analyst', labelKey: 'aiAnalyst', icon: Sparkles, workspace: 'blue' },
  { id: 'reports', labelKey: 'reportGenerator', icon: FileOutput, workspace: 'blue' },
  { id: 'plugins', labelKey: 'pluginSystem', icon: ToyBrick, workspace: 'blue' },
  { id: 'settings', labelKey: 'settings', icon: Settings, workspace: 'blue' },

  // DFIR WORKSPACE
  { id: 'dfir-evidence', labelKey: 'evidenceCustody', icon: Database, workspace: 'dfir' },
  { id: 'dfir-memory', labelKey: 'memoryAnalysis', icon: Cpu, workspace: 'dfir' },
  { id: 'dfir-registry', labelKey: 'registryExplorer', icon: Key, workspace: 'dfir' },
  { id: 'dfir-prefetch', labelKey: 'prefetchParser', icon: FileCode, workspace: 'dfir' },
  { id: 'dfir-amcache', labelKey: 'amcacheParser', icon: Layers, workspace: 'dfir' },
  { id: 'dfir-shimcache', labelKey: 'shimcacheParser', icon: Box, workspace: 'dfir' },
  { id: 'dfir-jumplists', labelKey: 'jumplistsParser', icon: HardDrive, workspace: 'dfir' },
  { id: 'dfir-srum', labelKey: 'srumMetrics', icon: Activity, workspace: 'dfir' },
  { id: 'dfir-usn', labelKey: 'usnJournal', icon: FileSpreadsheet, workspace: 'dfir' },
  { id: 'dfir-recycle', labelKey: 'recycleBin', icon: FileSearch, workspace: 'dfir' },

  // RED TEAM WORKSPACE (STRICT RECONNAISSANCE & ASSESSMENT)
  { id: 'red-ports', labelKey: 'portScanner', icon: Crosshair, workspace: 'red' },
  { id: 'red-http', labelKey: 'httpSslInspector', icon: Globe2, workspace: 'red' },
  { id: 'red-dns', labelKey: 'dnsWhois', icon: Terminal, workspace: 'red' },
  { id: 'red-surface', labelKey: 'attackSurface', icon: Share2, workspace: 'red' },

  // LSIP V3.0 ENTERPRISE EVOLUTION
  { id: 'v3-cases', labelKey: 'caseManagement', icon: Database, workspace: 'blue' },
  { id: 'v3-ioc-graph', labelKey: 'iocGraph', icon: Share2, workspace: 'blue' },
  { id: 'v3-evidence', labelKey: 'evidenceLocker', icon: FolderLock, workspace: 'dfir' },
  { id: 'v3-timeline', labelKey: 'forensicTimeline', icon: Clock, workspace: 'dfir' },
  { id: 'v3-process-tree', labelKey: 'processTree', icon: Cpu, workspace: 'blue' },
  { id: 'v3-detection-lab', labelKey: 'detectionLab', icon: FileCode, workspace: 'blue' },
  { id: 'v3-hunting', labelKey: 'threatHunting', icon: FileSearch, workspace: 'blue' },
  { id: 'v3-mitre', labelKey: 'mitreMatrix', icon: Layers, workspace: 'blue' },
  { id: 'v3-purple', labelKey: 'purpleMatrix', icon: Shield, workspace: 'red' },
  { id: 'v3-knowledge', labelKey: 'knowledgeBase', icon: Brain, workspace: 'blue' },
  // Engineering — Performance Monitor
  { id: 'perf-monitor', labelKey: 'perfMonitor', icon: BarChart3, workspace: 'blue' },
];

export const Sidebar: React.FC = () => {
  const { activeWorkspace, setActiveWorkspace, activeTab, setActiveTab, sidebarOpen, toggleSidebar } = useAppStore();
  const { t } = useTranslation();

  const currentItems = SIDEBAR_ITEMS.filter((item) => item.workspace === activeWorkspace);

  const getItemLabel = (key: string) => {
    return t(`workspaces.${key}`) || key;
  };

  return (
    <div
      style={{
        width: sidebarOpen ? 'var(--sidebar-width)' : 'var(--sidebar-collapsed-width)',
        flexShrink: 0,
        minHeight: 0,
        backgroundColor: 'var(--bg-tertiary)',
        borderRight: '1px solid var(--border-primary)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        zIndex: 50,
        overflow: 'hidden',
      }}
    >
      {/* Brand Header */}
      <div
        style={{
          height: 'var(--topbar-height)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: sidebarOpen ? 'flex-start' : 'center',
          padding: sidebarOpen ? '0 16px' : '0',
          borderBottom: '1px solid var(--border-primary)',
          gap: '12px',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        }}
      >
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            backgroundColor: 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: '14px',
            boxShadow: 'var(--shadow-glow-blue)',
            flexShrink: 0,
          }}
        >
          LS
        </div>
        {sidebarOpen && (
          <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
            LSIP PLATFORM
          </span>
        )}
      </div>

      {/* Workspace Switcher Selector */}
      {sidebarOpen && (
        <div
          style={{
            padding: '8px 12px',
            borderBottom: '1px solid var(--border-primary)',
            display: 'flex',
            gap: '4px',
            backgroundColor: 'rgba(0,0,0,0.1)',
          }}
        >
          <button
            onClick={() => setActiveWorkspace('blue')}
            data-workspace="blue"
            style={{
              flex: 1,
              padding: '6px 4px',
              fontSize: '0.7rem',
              fontWeight: activeWorkspace === 'blue' ? 600 : 400,
              borderRadius: '4px',
              border: 'none',
              background: activeWorkspace === 'blue' ? 'var(--accent-primary)' : 'transparent',
              color: activeWorkspace === 'blue' ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
            }}
            title={translateText("interfaceText.message013")}
          >
            <Shield size={12} />
            <span>{t('workspaces.blue')}</span>
          </button>

          <button
            onClick={() => setActiveWorkspace('dfir')}
            data-workspace="dfir"
            style={{
              flex: 1,
              padding: '6px 4px',
              fontSize: '0.7rem',
              fontWeight: activeWorkspace === 'dfir' ? 600 : 400,
              borderRadius: '4px',
              border: 'none',
              background: activeWorkspace === 'dfir' ? '#0284c7' : 'transparent',
              color: activeWorkspace === 'dfir' ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
            }}
            title={translateText("interfaceText.message014")}
          >
            <FileSearch size={12} />
            <span>{t('workspaces.dfir')}</span>
          </button>

          <button
            onClick={() => setActiveWorkspace('red')}
            data-workspace="red"
            style={{
              flex: 1,
              padding: '6px 4px',
              fontSize: '0.7rem',
              fontWeight: activeWorkspace === 'red' ? 600 : 400,
              borderRadius: '4px',
              border: 'none',
              background: activeWorkspace === 'red' ? '#dc2626' : 'transparent',
              color: activeWorkspace === 'red' ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
            }}
            title={translateText("interfaceText.message015")}
          >
            <Crosshair size={12} />
            <span>{t('workspaces.red')}</span>
          </button>
        </div>
      )}

      {/* Nav List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 6px',
          display: 'flex',
          flexDirection: 'column',
          gap: '3px',
        }}
      >
        {currentItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const label = getItemLabel(item.labelKey);

          return (
            <button
              key={item.id}
              data-tab={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: sidebarOpen ? 'flex-start' : 'center',
                width: '100%',
                padding: '10px',
                borderRadius: '6px',
                border: 'none',
                background: isActive ? 'rgba(37, 99, 235, 0.15)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                textAlign: 'left',
                gap: sidebarOpen ? '12px' : '0',
                transition: 'background 0.15s ease, color 0.15s ease',
                borderLeft: isActive ? '3px solid var(--accent-primary)' : '3px solid transparent',
              }}
              title={!sidebarOpen ? label : undefined}
            >
              {Icon && (
                <Icon
                  size={18}
                  style={{
                    color: isActive ? 'var(--accent-primary-hover)' : 'var(--text-secondary)',
                    flexShrink: 0,
                  }}
                />
              )}
              {sidebarOpen && (
                <span style={{ fontSize: '0.85rem', fontWeight: isActive ? 500 : 400 }}>
                  {label}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Collapse button at bottom */}
      <div
        style={{
          padding: '8px',
          flexShrink: 0,
          borderTop: '1px solid var(--border-primary)',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <button
          onClick={toggleSidebar}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title={sidebarOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
        >
          {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>
    </div>
  );
};
