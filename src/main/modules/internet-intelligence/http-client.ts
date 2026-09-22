import { createModuleLogger } from '../../core/logger';
import { connectivityManager } from '../../core/connectivity-manager';
import { configManager } from '../../core/config-manager';
import { eventBus } from '../../core/event-bus';
import { integer } from '../../core/security';
const log = createModuleLogger('internet-http-client');
export interface HttpRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; headers?: Record<string,string>; body?: any;
  timeoutMs?: number; retries?: number; retryDelayMs?: number; signal?: AbortSignal;
}
export interface HttpResponse<T = any> { status: number; data: T; headers: Record<string,string>; durationMs: number; }
export class IntelligenceHttpError extends Error {
  readonly status?: number; readonly isRateLimit: boolean; readonly isTimeout: boolean; readonly rawResponseBody?: string;
  constructor(message: string, options: { status?: number; isRateLimit?: boolean; isTimeout?: boolean; rawResponseBody?: string } = {}) {
    super(message); this.name = 'IntelligenceHttpError'; this.status = options.status;
    this.isRateLimit = options.isRateLimit || false; this.isTimeout = options.isTimeout || false;
  }
}
export class IntelligenceHttpClient {
  private active = new Set<AbortController>();
  constructor() {
    eventBus.subscribe('connectivity:changed', ({ isOnlineMode }) => { if (!isOnlineMode) this.cancelAll(); });
    eventBus.subscribe('internet:policy-changed', () => this.cancelAll());
  }
  public cancelAll() { for (const controller of this.active) controller.abort(); }
  private assertOnline() {
    const config = configManager.getModuleConfig('internet-intelligence');
    if (!connectivityManager.getState().isOnlineMode || config.enabled === false || config.offlineMode === true) {
      throw new IntelligenceHttpError('Çevrimdışı modda dış sorgu gönderilmez.');
    }
  }
  public async request<T = any>(url: string, options: HttpRequestOptions = {}): Promise<HttpResponse<T>> {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new IntelligenceHttpError('Güvenli HTTPS adresi gerekli.');
    const timeout = integer(options.timeoutMs ?? 10000, 'Zaman aşımı', 60000);
    const retries = integer(options.retries ?? 2, 'Tekrar', 3, 0);
    const delay = integer(options.retryDelayMs ?? 1000, 'Tekrar aralığı', 10000);
    for (let attempt = 0; attempt <= retries; attempt++) {
      this.assertOnline();
      if (options.signal?.aborted) throw new IntelligenceHttpError('İstek iptal edildi.');
      if (this.active.size >= 16) throw new IntelligenceHttpError('Eşzamanlı istek sınırı aşıldı.');
      const controller = new AbortController(); this.active.add(controller);
      const cancel = () => controller.abort();
      options.signal?.addEventListener('abort', cancel, { once: true });
      const timer = setTimeout(cancel, timeout);
      const started = Date.now();
      let rejectAbort: (() => void) | undefined;
      try {
        const aborted = new Promise<never>((_resolve,reject) => {
          rejectAbort = () => reject(new IntelligenceHttpError('İstek iptal edildi veya zaman aşımına uğradı.', { isTimeout: true }));
          controller.signal.addEventListener('abort', rejectAbort, { once: true });
        });
        const operation = async (): Promise<HttpResponse<T>> => {
          const headers = { ...(options.headers || {}) };
          let body: string | undefined;
          if (options.body !== undefined) {
            body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
            if (!Object.keys(headers).some(k => k.toLowerCase() === 'content-type')) headers['Content-Type'] = 'application/json';
          }
          const response = await fetch(url, { method: options.method || 'GET', headers, body, signal: controller.signal, redirect: 'error' });
          if (!response.ok) {
            await response.body?.cancel();
            throw new IntelligenceHttpError('HTTP ' + response.status, { status: response.status, isRateLimit: response.status === 429 });
          }
          const maxBytes = 8 * 1024 * 1024;
          if (Number(response.headers.get('content-length')) > maxBytes) { controller.abort(); throw new IntelligenceHttpError('Yanıt boyutu sınırı aşıldı.'); }
          const reader = response.body?.getReader();
          const chunks: Uint8Array[] = []; let length = 0;
          if (reader) {
            try {
              while (true) {
                const { done, value } = await reader.read(); if (done) break;
                length += value.length;
                if (length > maxBytes) { await reader.cancel(); throw new IntelligenceHttpError('Yanıt boyutu sınırı aşıldı.'); }
                chunks.push(value);
              }
            } finally { reader.releaseLock(); }
          }
          const content = Buffer.concat(chunks).toString('utf8');
          const data = response.headers.get('content-type')?.includes('application/json') ? (content ? JSON.parse(content) : null) : content;
          const responseHeaders: Record<string,string> = {}; response.headers.forEach((v,k) => responseHeaders[k] = v);
          return { status: response.status, data, headers: responseHeaders, durationMs: Date.now() - started };
        };
        return await Promise.race([operation(), aborted]);
      } catch (error: any) {
        // Raw URLs, request credentials and provider response bodies never enter logs/errors.
        log.warn('Sağlayıcı isteği tamamlanamadı.', { host: parsed.hostname, status: error instanceof IntelligenceHttpError ? error.status : undefined });
        if (controller.signal.aborted || options.signal?.aborted || attempt === retries || (error instanceof IntelligenceHttpError && error.status && error.status < 500)) {
          if (error instanceof IntelligenceHttpError) throw error;
          throw new IntelligenceHttpError('Sağlayıcı isteği başarısız.', { isTimeout: controller.signal.aborted });
        }
      } finally {
        clearTimeout(timer); this.active.delete(controller);
        options.signal?.removeEventListener('abort', cancel);
        if (rejectAbort) controller.signal.removeEventListener('abort', rejectAbort);
      }
      await new Promise(resolve => setTimeout(resolve, delay * (attempt + 1)));
    }
    throw new IntelligenceHttpError('İstek tamamlanamadı.');
  }
}
export const httpClient = new IntelligenceHttpClient();
