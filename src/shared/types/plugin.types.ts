/**
 * Plugin System shared types.
 * Architecture for loading dynamic external modules.
 */

export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  filePath: string;
  status: 'active' | 'error' | 'disabled';
  loadError?: string;
}

export interface PluginSummary {
  loadedPlugins: number;
  activePlugins: number;
  errorPlugins: number;
  plugins: PluginInfo[];
}
