import { createModuleLogger } from './logger';

const log = createModuleLogger('service-container');

type Factory<T> = () => T;

export class ServiceContainer {
  private services = new Map<string, any>();
  private factories = new Map<string, Factory<any>>();

  /**
   * Register an already-constructed service instance.
   */
  public register<T>(token: string, instance: T): void {
    if (this.services.has(token)) {
      log.warn(`Service token '${token}' is already registered and will be overwritten.`);
    }
    this.services.set(token, instance);
    log.debug(`Registered service: ${token}`);
  }

  /**
   * Register a lazy factory — the instance is only created on the first get() call.
   */
  public registerFactory<T>(token: string, factory: Factory<T>): void {
    if (this.factories.has(token)) {
      log.warn(`Factory token '${token}' is already registered and will be overwritten.`);
    }
    this.factories.set(token, factory);
    log.debug(`Registered lazy factory: ${token}`);
  }

  /**
   * Retrieve a service by token. Lazy factories are instantiated on first call.
   */
  public get<T>(token: string): T {
    // Check for already-constructed instance
    if (this.services.has(token)) {
      return this.services.get(token) as T;
    }

    // Check for lazy factory
    if (this.factories.has(token)) {
      log.debug(`Instantiating lazy service: ${token}`);
      const instance = this.factories.get(token)!();
      this.services.set(token, instance);
      this.factories.delete(token);
      return instance as T;
    }

    log.error(`Service token '${token}' not found.`);
    throw new Error(`Service not found: ${token}`);
  }

  public has(token: string): boolean {
    return this.services.has(token) || this.factories.has(token);
  }

  public clear(): void {
    this.services.clear();
    this.factories.clear();
    log.debug('Service container cleared.');
  }
}

export const container = new ServiceContainer();
