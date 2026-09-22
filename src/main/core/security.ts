import { ipcMain, WebContents, IpcMainInvokeEvent } from 'electron';

const trustedWindows = new Map<WebContents, string>();
const pending = new Map<WebContents, number>();
let maintenance = false;
export async function withIpcMaintenance<T>(action: () => Promise<T>): Promise<T> {
  if (maintenance) throw new Error('Maintenance is already running');
  maintenance = true;
  try {
    const deadline = Date.now() + 60000;
    while ([...pending.values()].reduce((a, b) => a + b, 0) > 1) {
      if (Date.now() > deadline) throw new Error('Active operations must finish before backup or restore');
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    return await action();
  } finally { maintenance = false; }
}


export function trustRenderer(contents: WebContents, entryUrl: string): void {
  trustedWindows.set(contents, entryUrl);
  contents.once('destroyed', () => trustedWindows.delete(contents));
}

export function assertTrustedSender(event: IpcMainInvokeEvent): void {
  const entry = trustedWindows.get(event.sender);
  const frame = event.senderFrame;
  if (!entry || !frame || frame !== event.sender.mainFrame || frame.parent !== null) {
    throw new Error('Unauthorized IPC sender');
  }
  const actual = new URL(frame.url);
  const expected = new URL(entry);
  // Hash-based UI navigation is allowed; protocol, origin and path are fixed.
  actual.hash = ''; expected.hash = '';
  if (actual.href !== expected.href) throw new Error('Unauthorized IPC document');
}

export function safeIpcHandle(channel: string, handler: (event: IpcMainInvokeEvent, ...args: any[]) => any): void {
  ipcMain.handle(channel, async (event, ...args) => {
    assertTrustedSender(event);
    if (maintenance) throw new Error('Backup or restore is in progress');
    const count = pending.get(event.sender) || 0;
    if (count >= 32) throw new Error('Eşzamanlı işlem sınırı aşıldı.');
    pending.set(event.sender, count + 1);
    try { return await handler(event, ...args); }
    finally {
      const remaining = (pending.get(event.sender) || 1) - 1;
      if (remaining) pending.set(event.sender, remaining); else pending.delete(event.sender);
    }
  });
}

export function integer(value: unknown, name: string, max = 0x7fffffff, min = 1): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name}: ${min}-${max} aralığında tam sayı gerekli.`);
  }
  return value;
}

export function text(value: unknown, name: string, max = 4096): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x1f]/.test(value)) {
    throw new Error(`${name}: geçersiz metin.`);
  }
  return value;
}

export function host(value: unknown): string {
  const result = text(value, 'Hedef', 253).trim();
  if (!/^[a-zA-Z0-9.:%_-]+$/.test(result)) throw new Error('Geçersiz hedef adı/IP.');
  return result;
}
