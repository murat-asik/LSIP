import { create } from 'zustand';

export interface EvidenceItem {
  id: string;
  type: 'file' | 'hash' | 'registry' | 'process' | 'network' | 'memory' | 'log' | 'certificate';
  name: string;
  source: string;
  sha256: string;
  md5: string;
  collectedAt: number;
  collector: string;
  custodyChain: string[];
  integrityVerified: boolean;
  metadata?: Record<string, any>;
}

export interface CaseItem {
  id: string;
  title: string;
  description: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low' | 'Info';
  status: 'Open' | 'Investigating' | 'Resolved' | 'Archived';
  tags: string[];
  iocs: Array<{ type: string; value: string; confidence: number; riskScore: number }>;
  evidence: EvidenceItem[];
  timeline: Array<{ id: string; timestamp: number; category: string; description: string; source: string; severity: string }>;
  mitreMappings: Array<{ tactic: string; techniqueId: string; techniqueName: string; confidence: number }>;
  aiNotes: string[];
  analystNotes: string;
  createdAt: number;
  updatedAt: number;
}

export interface IocKnowledgeEntry {
  indicator: string;
  type: 'ip' | 'domain' | 'url' | 'hash';
  firstSeen: number;
  lastSeen: number;
  occurrences: number;
  associatedCases: string[];
  tags: string[];
  riskScore: number;
  notes: string;
}

export interface CaseManagementStore {
  cases: CaseItem[];
  storageError: string | null;
  activeCaseId: string | null;
  iocKnowledgeBase: Record<string, IocKnowledgeEntry>;
  globalEvidenceLocker: EvidenceItem[];
  
  createCase: (caseData: Omit<CaseItem, 'id' | 'createdAt' | 'updatedAt'>) => CaseItem;
  updateCase: (id: string, partial: Partial<CaseItem>) => void;
  deleteCase: (id: string) => void;
  setActiveCaseId: (id: string | null) => void;
  addEvidenceToCase: (caseId: string, evidence: Omit<EvidenceItem, 'id' | 'collectedAt'>) => void;
  addIocToKnowledgeBase: (entry: Omit<IocKnowledgeEntry, 'firstSeen' | 'lastSeen' | 'occurrences'>) => void;
}

type StoredCases = Pick<CaseManagementStore, 'cases' | 'iocKnowledgeBase' | 'globalEvidenceLocker'>;
const STORAGE_KEY = 'lsip_case_workspace_v1';
const object = (v: any): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v);
const strings = (v: any) => Array.isArray(v) && v.every(x => typeof x === 'string');
const evidenceValid = (v: any) => object(v) && ['id','type','name','source','sha256','md5','collector'].every(k => typeof v[k] === 'string') && Number.isFinite(v.collectedAt) && strings(v.custodyChain) && typeof v.integrityVerified === 'boolean';
const caseValid = (v: any) => object(v) && ['id','title','description','analystNotes'].every(k => typeof v[k] === 'string') &&
  ['Critical','High','Medium','Low','Info'].includes(v.severity) && ['Open','Investigating','Resolved','Archived'].includes(v.status) &&
  strings(v.tags) && strings(v.aiNotes) && Number.isFinite(v.createdAt) && Number.isFinite(v.updatedAt) &&
  Array.isArray(v.evidence) && v.evidence.every(evidenceValid) &&
  Array.isArray(v.iocs) && v.iocs.every((x: any) => object(x) && typeof x.type === 'string' && typeof x.value === 'string' && Number.isFinite(x.confidence) && Number.isFinite(x.riskScore)) &&
  Array.isArray(v.timeline) && v.timeline.every((x: any) => object(x) && ['id','category','description','source','severity'].every(k => typeof x[k] === 'string') && Number.isFinite(x.timestamp)) &&
  Array.isArray(v.mitreMappings) && v.mitreMappings.every((x: any) => object(x) && ['tactic','techniqueId','techniqueName'].every(k => typeof x[k] === 'string') && Number.isFinite(x.confidence));
const iocsValid = (v: any) => object(v) && Object.values(v).every(x => object(x) &&
  ['indicator','type','notes'].every(k => typeof x[k] === 'string') && strings(x.associatedCases) && strings(x.tags) &&
  ['firstSeen','lastSeen','occurrences','riskScore'].every(k => Number.isFinite(x[k])));
const validators = { cases: (v: any) => Array.isArray(v) && v.every(caseValid), iocKnowledgeBase: iocsValid,
  globalEvidenceLocker: (v: any) => Array.isArray(v) && v.every(evidenceValid) };
let storageBlocked = false;
let initialStorageError: string | null = null;
const loadInitialStore = (): StoredCases => {
  const empty: StoredCases = { cases: [], iocKnowledgeBase: {}, globalEvidenceLocker: [] };
  try {
    const envelope = localStorage.getItem(STORAGE_KEY);
    if (envelope !== null) {
      const parsed = JSON.parse(envelope);
      if (!object(parsed) || parsed.version !== 1 || !object(parsed.data) ||
        !Object.entries(validators).every(([key, validate]) => validate(parsed.data[key]))) throw new Error('Invalid workspace');
      return parsed.data as StoredCases;
    }
    // Validate legacy collections independently. Never overwrite unreadable originals.
    for (const [field, key] of Object.entries({ cases: 'lsip_v3_cases', iocKnowledgeBase: 'lsip_v3_iocs', globalEvidenceLocker: 'lsip_v3_evidence' })) {
      try {
        const raw = localStorage.getItem(key);
        if (raw === null) continue;
        const value = JSON.parse(raw);
        if (!validators[field as keyof StoredCases](value)) throw new Error('Invalid collection');
        (empty as any)[field] = value;
      } catch { storageBlocked = true; initialStorageError = 'recovery'; }
    }
    return empty;
  } catch {
    storageBlocked = true;
    initialStorageError = 'recovery';
    return empty;
  }
};

export const useCaseManagementStore = create<CaseManagementStore>((set, get) => {
  const initial = loadInitialStore();
  const persist = (partial: Partial<StoredCases>) => {
    if (storageBlocked) throw new Error('Stored case data requires recovery; original data has been preserved.');
    const current = get();
    const data: StoredCases = { cases: current.cases, iocKnowledgeBase: current.iocKnowledgeBase, globalEvidenceLocker: current.globalEvidenceLocker, ...partial };
    if (!Object.entries(validators).every(([key, validate]) => validate((data as any)[key]))) throw new Error('Invalid case data');
    try {
      // One atomic localStorage write commits cases and linked evidence together.
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, data }));
      set({ storageError: null });
    } catch (error) {
      set({ storageError: 'write' });
      throw error;
    }
  };
  return {
    storageError: initialStorageError,
    cases: initial.cases,
    activeCaseId: initial.cases.length > 0 ? initial.cases[0].id : null,
    iocKnowledgeBase: initial.iocKnowledgeBase,
    globalEvidenceLocker: initial.globalEvidenceLocker,

    createCase: (caseData) => {
      const newCase: CaseItem = {
        ...caseData,
        id: `CASE-${crypto.randomUUID()}`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const updated = [newCase, ...get().cases];
      persist({ cases: updated });
      set({ cases: updated, activeCaseId: newCase.id });
      return newCase;
    },

    updateCase: (id, partial) => {
      const updated = get().cases.map((c) => (c.id === id ? { ...c, ...partial, updatedAt: Date.now() } : c));
      persist({ cases: updated });
      set({ cases: updated });
    },

    deleteCase: (id) => {
      const updated = get().cases.filter((c) => c.id !== id);
      persist({ cases: updated });
      set({ cases: updated, activeCaseId: updated.length > 0 ? updated[0].id : null });
    },

    setActiveCaseId: (id) => set({ activeCaseId: id }),

    addEvidenceToCase: (caseId, evidence) => {
      if (!get().cases.some(c => c.id === caseId)) throw new Error('Case does not exist');
      const newEvd: EvidenceItem = {
        ...evidence,
        id: `EVD-${crypto.randomUUID()}`,
        collectedAt: Date.now(),
      };
      const cases = get().cases.map((c) => {
        if (c.id === caseId) {
          return { ...c, evidence: [newEvd, ...c.evidence], updatedAt: Date.now() };
        }
        return c;
      });
      const globalEvd = [newEvd, ...get().globalEvidenceLocker];
      persist({ cases, globalEvidenceLocker: globalEvd });
      set({ cases, globalEvidenceLocker: globalEvd });
    },

    addIocToKnowledgeBase: (entry) => {
      const existing = get().iocKnowledgeBase[entry.indicator];
      const now = Date.now();
      const updatedEntry: IocKnowledgeEntry = existing
        ? {
            ...existing,
            lastSeen: now,
            occurrences: existing.occurrences + 1,
            associatedCases: Array.from(new Set([...existing.associatedCases, ...entry.associatedCases])),
            riskScore: Math.max(existing.riskScore, entry.riskScore),
          }
        : {
            ...entry,
            firstSeen: now,
            lastSeen: now,
            occurrences: 1,
          };

      const updatedMap = { ...get().iocKnowledgeBase, [entry.indicator]: updatedEntry };
      persist({ iocKnowledgeBase: updatedMap });
      set({ iocKnowledgeBase: updatedMap });
    },
  };
});
