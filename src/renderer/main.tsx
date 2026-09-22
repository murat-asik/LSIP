import React from 'react';
import ReactDOM from 'react-dom/client';

import './styles/index.css';
import './styles/fluent.css';

async function start() {
  const restored = await window.lsip.invoke('backup:pending-storage');
  if (restored) {
    const previous = new Map<string, string | null>();
    try {
      for (const [key, value] of Object.entries(restored)) {
        if (!['lsip_case_workspace_v1','lsip_v3_cases','lsip_v3_iocs','lsip_v3_evidence','lsip_theme','lsip_language'].includes(key)) throw new Error('Invalid restore key');
        previous.set(key, localStorage.getItem(key));
        if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, String(value));
      }
      await window.lsip.invoke('backup:ack-storage');
    } catch (error) {
      for (const [key, value] of previous) { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); }
      throw error;
    }
  }
  const { default: App } = await import('./App');
  ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
}
void start().catch(error => { document.getElementById('root')!.textContent = 'Startup / Başlatma: ' + String(error?.message || error); });
