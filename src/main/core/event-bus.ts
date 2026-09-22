import { EventEmitter } from 'events';
import { createModuleLogger } from './logger';

const log = createModuleLogger('event-bus');

// ---------------------------------------------------------------------------
// Typed Event Payload Map
// ---------------------------------------------------------------------------
export interface EventBusPayloads {
  'internet:policy-changed': {};
  'connectivity:changed': { status: string; isOnlineMode: boolean };
  'database:updated': { dbName: string; table?: string };
  'cache:expired': { indicator: string; providerId: string };
  'provider:finished': { providerId: string; indicator: string; latencyMs: number; fromCache: boolean };
  'provider:initialized': { providerId: string };
  'workspace:changed': { workspace: string };
  'module:sleeping': { moduleName: string };
  'module:waking': { moduleName: string };
  'module:initialized': { moduleName: string };
  'worker:task-completed': { taskId: string; type: string; durationMs: number };
  'worker:task-failed': { taskId: string; type: string; error: string };
  'app:shutdown': {};
}

export type EventBusChannel = keyof EventBusPayloads;

// ---------------------------------------------------------------------------
// Typed EventBus
// ---------------------------------------------------------------------------
class EventBus extends EventEmitter {
  private static instance: EventBus;

  private constructor() {
    super();
    // Increase default max listeners for a platform with many modules
    this.setMaxListeners(64);
  }

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * Publish a typed event to all subscribers.
   */
  public publish<K extends EventBusChannel>(channel: K, payload: EventBusPayloads[K]): void {
    log.debug(`[EventBus] publish → ${channel}`);
    this.emit(channel, payload);
  }

  /**
   * Subscribe to a typed event channel. Returns an unsubscribe function.
   */
  public subscribe<K extends EventBusChannel>(
    channel: K,
    handler: (payload: EventBusPayloads[K]) => void
  ): () => void {
    this.on(channel, handler);
    return () => {
      this.off(channel, handler);
    };
  }

  /**
   * Subscribe to a typed event channel for a single emission.
   */
  public subscribeOnce<K extends EventBusChannel>(
    channel: K,
    handler: (payload: EventBusPayloads[K]) => void
  ): void {
    this.once(channel, handler);
  }
}

export const eventBus = EventBus.getInstance();
