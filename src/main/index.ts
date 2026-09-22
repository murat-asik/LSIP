import { app, BrowserWindow } from 'electron';
import { applyPendingRestore } from './core/restore-startup';
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { const window = BrowserWindow.getAllWindows()[0]; if (window) { if (window.isMinimized()) window.restore(); window.focus(); } });
  applyPendingRestore();
  const { Application } = require('./app');
  const appInstance = new Application();
  appInstance.start().catch((err: Error) => { console.error('Fatal error during LSIP startup sequence:', err); app.exit(1); });
}
