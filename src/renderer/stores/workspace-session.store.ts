import { create } from 'zustand';

export interface InternetSessionState {
  inputQuery: string;
  investigationResult: any | null;
  selectedProviderId?: string;
  expandedCards: Record<string, boolean>;
  historySearch: string;
  historyFilter: string;
  scrollPosition: number;
  timestamp?: number;
}

export interface AssetDiscoverySessionState {
  searchQuery: string;
  selectedInterface: string;
  selectedAsset: any | null;
  scrollPosition: number;
}

export interface ReputationSessionState {
  searchQuery: string;
  selectedHost: any | null;
  correlationData: any | null;
  scrollPosition: number;
}

export interface RedTeamSessionState {
  portTarget: string;
  portScanResult: any | null;
  httpUrl: string;
  httpResult: any | null;
  sslResult: any | null;
  dnsDomain: string;
  dnsResult: any | null;
  surfaceTarget: string;
  surfaceData: any | null;
}

export interface DfirSessionState {
  evidenceTitle: string;
  evidenceSourcePath: string;
  selectedEvidenceItem: any | null;
}

export interface WorkspaceSessionStore {
  internetSession: InternetSessionState;
  assetSession: AssetDiscoverySessionState;
  reputationSession: ReputationSessionState;
  redTeamSession: RedTeamSessionState;
  dfirSession: DfirSessionState;

  // Generic per-module state slots — any module can persist arbitrary state
  moduleStates: Record<string, Record<string, any>>;

  setInternetSession: (session: Partial<InternetSessionState>) => void;
  setAssetSession: (session: Partial<AssetDiscoverySessionState>) => void;
  setReputationSession: (session: Partial<ReputationSessionState>) => void;
  setRedTeamSession: (session: Partial<RedTeamSessionState>) => void;
  setDfirSession: (session: Partial<DfirSessionState>) => void;

  // Generic module state accessors
  saveModuleState: (module: string, key: string, value: any) => void;
  getModuleState: (module: string, key: string, defaultValue?: any) => any;
  clearModuleState: (module: string) => void;

  clearAllSessions: () => void;
}

const initialInternetSession: InternetSessionState = {
  inputQuery: '',
  investigationResult: null,
  expandedCards: {},
  historySearch: '',
  historyFilter: 'all',
  scrollPosition: 0,
};

const initialAssetSession: AssetDiscoverySessionState = {
  searchQuery: '',
  selectedInterface: 'all',
  selectedAsset: null,
  scrollPosition: 0,
};

const initialReputationSession: ReputationSessionState = {
  searchQuery: '',
  selectedHost: null,
  correlationData: null,
  scrollPosition: 0,
};

const initialRedTeamSession: RedTeamSessionState = {
  portTarget: '127.0.0.1',
  portScanResult: null,
  httpUrl: 'https://google.com',
  httpResult: null,
  sslResult: null,
  dnsDomain: 'google.com',
  dnsResult: null,
  surfaceTarget: '127.0.0.1',
  surfaceData: null,
};

const initialDfirSession: DfirSessionState = {
  evidenceTitle: '',
  evidenceSourcePath: '',
  selectedEvidenceItem: null,
};

const sanitizeInvestigationResult = (res: any): any => {
  if (!res || typeof res !== 'object') return null;
  return {
    ...res,
    cloudIntelligence: Array.isArray(res.cloudIntelligence) ? res.cloudIntelligence : [],
    provenanceTags: Array.isArray(res.provenanceTags) ? res.provenanceTags : [],
    localIntelligence: res.localIntelligence ? {
      ...res.localIntelligence,
      factors: Array.isArray(res.localIntelligence.factors) ? res.localIntelligence.factors : [],
      recommendations: Array.isArray(res.localIntelligence.recommendations) ? res.localIntelligence.recommendations : [],
    } : {
      hostId: res.indicator || 'N/A',
      riskScore: 0,
      factorsCount: 0,
      associatedEventsCount: 0,
      factors: [],
      recommendations: [],
      provenance: 'LOCAL',
    },
    investigationMetadata: res.investigationMetadata || {
      investigationId: 'N/A',
      executionTimestamp: Date.now(),
      totalDurationMs: 0,
      correlationDurationMs: 0,
      providerCount: 0,
      providerSuccessCount: 0,
      providerFailureCount: 0,
      providerUnconfiguredCount: 0,
      providerCachedCount: 0,
    },
  };
};

const sanitizeInternetSession = (session: InternetSessionState): InternetSessionState => {
  if (!session || typeof session !== 'object') return initialInternetSession;
  return {
    ...session,
    inputQuery: typeof session.inputQuery === 'string' ? session.inputQuery : '',
    investigationResult: sanitizeInvestigationResult(session.investigationResult),
    expandedCards: session.expandedCards && typeof session.expandedCards === 'object' ? session.expandedCards : {},
    historySearch: typeof session.historySearch === 'string' ? session.historySearch : '',
    historyFilter: typeof session.historyFilter === 'string' ? session.historyFilter : 'all',
    scrollPosition: typeof session.scrollPosition === 'number' ? session.scrollPosition : 0,
  };
};

// Try loading persisted sessions from localStorage
const loadSavedSession = <T>(key: string, defaultVal: T): T => {
  try {
    const raw = localStorage.getItem(`lsip_session_${key}`);
    if (raw) {
      const parsed = { ...defaultVal, ...JSON.parse(raw) };
      if (key === 'internet') {
        return sanitizeInternetSession(parsed as any) as unknown as T;
      }
      return parsed;
    }
  } catch (e) {
    console.error(`Failed to load session ${key}:`, e);
  }
  return defaultVal;
};

const saveSession = (key: string, data: any) => {
  try {
    localStorage.setItem(`lsip_session_${key}`, JSON.stringify(data));
  } catch (e) {
    console.error(`Failed to save session ${key}:`, e);
  }
};

export const useWorkspaceSessionStore = create<WorkspaceSessionStore>((set, get) => ({
  internetSession: loadSavedSession('internet', initialInternetSession),
  assetSession: loadSavedSession('asset', initialAssetSession),
  reputationSession: loadSavedSession('reputation', initialReputationSession),
  redTeamSession: loadSavedSession('redteam', initialRedTeamSession),
  dfirSession: loadSavedSession('dfir', initialDfirSession),

  // Load persisted module states from localStorage
  moduleStates: loadSavedSession<Record<string, Record<string, any>>>('module-states', {}),

  setInternetSession: (partial) => {
    const updated = sanitizeInternetSession({ ...get().internetSession, ...partial });
    saveSession('internet', updated);
    set({ internetSession: updated });
  },

  setAssetSession: (partial) => {
    const updated = { ...get().assetSession, ...partial };
    saveSession('asset', updated);
    set({ assetSession: updated });
  },

  setReputationSession: (partial) => {
    const updated = { ...get().reputationSession, ...partial };
    saveSession('reputation', updated);
    set({ reputationSession: updated });
  },

  setRedTeamSession: (partial) => {
    const updated = { ...get().redTeamSession, ...partial };
    saveSession('redteam', updated);
    set({ redTeamSession: updated });
  },

  setDfirSession: (partial) => {
    const updated = { ...get().dfirSession, ...partial };
    saveSession('dfir', updated);
    set({ dfirSession: updated });
  },

  // Generic module state persistence
  saveModuleState: (module, key, value) => {
    const current = get().moduleStates;
    const updated = {
      ...current,
      [module]: { ...(current[module] || {}), [key]: value },
    };
    set({ moduleStates: updated });
    saveSession('module-states', updated);
  },

  getModuleState: (module, key, defaultValue = undefined) => {
    const moduleState = get().moduleStates[module];
    if (!moduleState) return defaultValue;
    return moduleState[key] !== undefined ? moduleState[key] : defaultValue;
  },

  clearModuleState: (module) => {
    const current = get().moduleStates;
    const updated = { ...current };
    delete updated[module];
    set({ moduleStates: updated });
    saveSession('module-states', updated);
  },

  clearAllSessions: () => {
    localStorage.removeItem('lsip_session_internet');
    localStorage.removeItem('lsip_session_asset');
    localStorage.removeItem('lsip_session_reputation');
    localStorage.removeItem('lsip_session_redteam');
    localStorage.removeItem('lsip_session_dfir');
    localStorage.removeItem('lsip_session_module-states');
    set({
      internetSession: initialInternetSession,
      assetSession: initialAssetSession,
      reputationSession: initialReputationSession,
      redTeamSession: initialRedTeamSession,
      dfirSession: initialDfirSession,
      moduleStates: {},
    });
  },
}));

