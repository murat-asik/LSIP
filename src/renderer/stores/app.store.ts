import { create } from 'zustand';

export type ConnectivityStatus = 'OFFLINE' | 'ONLINE' | 'LIMITED' | 'NO INTERNET' | 'PROVIDER ERROR';
export type WorkspaceType = 'blue' | 'dfir' | 'red';
export type ThemeType = 'dark' | 'light';
export type LanguageType = 'en' | 'tr';

export interface AppState {
  activeWorkspace: WorkspaceType;
  activeTab: string;
  searchQuery: string;
  isScanning: boolean;
  scanProgress: number; // 0 to 100
  systemMetrics: {
    cpu: number;
    ram: number;
    totalRam: number;
    disk: number;
    totalDisk: number;
    uptime: number;
    hostname: string;
    osVersion: string;
    connectedAdapters: number;
  };
  sidebarOpen: boolean;
  connectivityStatus: ConnectivityStatus;
  isOnlineMode: boolean;
  theme: ThemeType;
  language: LanguageType;
  
  setActiveWorkspace: (workspace: WorkspaceType, defaultTab?: string) => void;
  setActiveTab: (tab: string) => void;
  setSearchQuery: (query: string) => void;
  setIsScanning: (scanning: boolean, progress?: number) => void;
  setSystemMetrics: (metrics: AppState['systemMetrics']) => void;
  toggleSidebar: () => void;
  setConnectivity: (status: ConnectivityStatus, isOnlineMode: boolean) => void;
  setTheme: (theme: ThemeType) => void;
  setLanguage: (language: LanguageType) => void;
}

const savedTheme = (localStorage.getItem('lsip_theme') as ThemeType) || 'dark';
const savedLanguage = (localStorage.getItem('lsip_language') as LanguageType) || 'en';
document.documentElement.setAttribute('data-theme', savedTheme);

export const useAppStore = create<AppState>((set) => ({
  activeWorkspace: 'blue',
  activeTab: 'dashboard',
  searchQuery: '',
  isScanning: false,
  scanProgress: 0,
  systemMetrics: {
    cpu: 0,
    ram: 0,
    totalRam: 32, // GB default
    disk: 0,
    totalDisk: 512,
    uptime: 0,
    hostname: 'LSIP-HOST',
    osVersion: 'Windows 11',
    connectedAdapters: 0,
  },
  sidebarOpen: true,
  connectivityStatus: 'OFFLINE',
  isOnlineMode: false,
  theme: savedTheme,
  language: savedLanguage,

  setActiveWorkspace: (workspace, defaultTab) => set({
    activeWorkspace: workspace,
    activeTab: defaultTab || (workspace === 'blue' ? 'dashboard' : workspace === 'dfir' ? 'dfir-evidence' : 'red-ports'),
  }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setIsScanning: (scanning, progress = 0) => set({ isScanning: scanning, scanProgress: progress }),
  setSystemMetrics: (systemMetrics) => set({ systemMetrics }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setConnectivity: (connectivityStatus, isOnlineMode) => set({ connectivityStatus, isOnlineMode }),
  setTheme: (theme) => {
    localStorage.setItem('lsip_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  },
  setLanguage: (language) => {
    localStorage.setItem('lsip_language', language);
    set({ language });
  },
}));
