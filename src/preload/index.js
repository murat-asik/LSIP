"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");

const allowedPrefixes = [
  'assets:',
  'events:',
  'process:',
  'topology:',
  'connection:',
  'reputation:',
  'timeline:',
  'dns:',
  'smb:',
  'rdp:',
  'cert:',
  'usb:',
  'fim:',
  'persistence:',
  'ioc:',
  'behavior:',
  'reports:',
  'plugins:',
  'internet:',
  'internet-intelligence:',
  'connectivity:',
  'correlation:',
  'correlation-engine:',
  'app:',
  'dashboard:',
  'dfir:',
  'redteam:',
  'ai-analyst:',
  // V3.0 — Lazy module activation + performance monitor
  'module-manager:',
  'perf:',
];

electron_1.contextBridge.exposeInMainWorld('lsip', {
    invoke: (channel, ...args) => {
        if (!allowedPrefixes.some(prefix => channel.startsWith(prefix))) {
            return Promise.reject(new Error(`Unauthorized IPC channel: ${channel}`));
        }
        return electron_1.ipcRenderer.invoke(channel, ...args);
    },
    on: (channel, callback) => {
        if (!allowedPrefixes.some(prefix => channel.startsWith(prefix))) {
            return () => { };
        }
        const subscription = (_event, ...args) => callback(...args);
        electron_1.ipcRenderer.on(channel, subscription);
        return () => {
            electron_1.ipcRenderer.removeListener(channel, subscription);
        };
    },
    send: (channel, ...args) => {
        if (!allowedPrefixes.some(prefix => channel.startsWith(prefix))) {
            return;
        }
        electron_1.ipcRenderer.send(channel, ...args);
    }
});
