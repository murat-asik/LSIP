import { Worker } from 'worker_threads';
import path from 'path';
import { createModuleLogger } from './logger';

const log = createModuleLogger('worker-pool');

export interface TaskDescriptor {
  id: string;
  type: string;
  payload: any;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  queuedAt: number;
}

export interface WorkerPoolStats {
  totalWorkers: number;
  activeWorkers: number;
  idleWorkers: number;
  queueDepth: number;
  completedTasks: number;
  failedTasks: number;
  averageTaskDurationMs: number;
}

const WORKER_IDLE_TIMEOUT_MS = 30_000; // 30 seconds idle → terminate worker

export class WorkerPool {
  private workers: Worker[] = [];
  private activeWorkers = new Set<Worker>();
  private workerIdleTimers = new Map<Worker, NodeJS.Timeout>();
  private taskQueue: TaskDescriptor[] = [];
  private maxSize: number;
  private workerScriptPath: string;

  // Statistics
  private completedTasks = 0;
  private failedTasks = 0;
  private totalTaskDurationMs = 0;

  constructor(size = 4, scriptName = 'general-worker.js') {
    this.maxSize = size;
    this.workerScriptPath = path.join(__dirname, '..', 'workers', scriptName);
  }

  public initialize() {
    log.info(`Worker pool initialized. Max size: ${this.maxSize}. Workers start lazily on demand.`);
    // No workers created at initialization — they spawn on first task
  }

  /**
   * Run a task using the shared pool. Workers are created lazily and reused.
   */
  public runTask<TResult = any>(type: string, payload: any): Promise<TResult> {
    return new Promise((resolve, reject) => {
      const task: TaskDescriptor = {
        id: Math.random().toString(36).substring(7),
        type,
        payload,
        resolve,
        reject,
        queuedAt: Date.now(),
      };

      this.taskQueue.push(task);
      this.processQueue();
    });
  }

  /**
   * Run an ephemeral (Category C) task. Creates a dedicated worker, executes,
   * then immediately terminates the worker to release RAM.
   */
  public runEphemeral<TResult = any>(type: string, payload: any): Promise<TResult> {
    return new Promise((resolve, reject) => {
      let worker: Worker;
      try {
        worker = new Worker(this.workerScriptPath);
      } catch (err: any) {
        log.error('Failed to spawn ephemeral worker', { error: err.message });
        return reject(err);
      }

      const taskId = Math.random().toString(36).substring(7);
      const startTime = Date.now();

      const onMessage = (response: any) => {
        if (response.id === taskId) {
          worker.terminate();
          const duration = Date.now() - startTime;
          this.completedTasks++;
          this.totalTaskDurationMs += duration;
          if (response.success) {
            resolve(response.data);
          } else {
            this.failedTasks++;
            reject(new Error(response.error || 'Ephemeral task failed.'));
          }
        }
      };

      const onError = (err: Error) => {
        worker.terminate();
        this.failedTasks++;
        reject(err);
      };

      worker.on('message', onMessage);
      worker.on('error', onError);

      worker.postMessage({ id: taskId, type, payload });
    });
  }

  public shutdown() {
    log.info('Shutting down worker pool...');

    // Clear idle timers
    for (const timer of this.workerIdleTimers.values()) {
      clearTimeout(timer);
    }
    this.workerIdleTimers.clear();

    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers = [];
    this.activeWorkers.clear();
    this.taskQueue = [];
  }

  public getStats(): WorkerPoolStats {
    return {
      totalWorkers: this.workers.length,
      activeWorkers: this.activeWorkers.size,
      idleWorkers: this.workers.length - this.activeWorkers.size,
      queueDepth: this.taskQueue.length,
      completedTasks: this.completedTasks,
      failedTasks: this.failedTasks,
      averageTaskDurationMs:
        this.completedTasks > 0
          ? Math.round(this.totalTaskDurationMs / this.completedTasks)
          : 0,
    };
  }

  private getAvailableWorker(): Worker | null {
    // Return existing idle worker
    for (const worker of this.workers) {
      if (!this.activeWorkers.has(worker)) {
        // Cancel its idle termination timer since it's being used
        const timer = this.workerIdleTimers.get(worker);
        if (timer) {
          clearTimeout(timer);
          this.workerIdleTimers.delete(worker);
        }
        return worker;
      }
    }

    // Spawn a new one if limit is not reached
    if (this.workers.length < this.maxSize) {
      try {
        log.debug(`Spawning worker. Pool size: ${this.workers.length + 1}/${this.maxSize}`);
        const worker = new Worker(this.workerScriptPath);

        worker.on('error', (err) => {
          log.error('Worker error', { error: err.message });
          // Remove dead worker from pool
          this.workers = this.workers.filter(w => w !== worker);
          this.activeWorkers.delete(worker);
          this.processQueue();
        });

        this.workers.push(worker);
        return worker;
      } catch (err: any) {
        log.error('Failed to spawn worker thread', { error: err.message });
        return null;
      }
    }

    return null; // All workers busy, task stays in queue
  }

  private processQueue() {
    if (this.taskQueue.length === 0) return;

    const worker = this.getAvailableWorker();
    if (!worker) return; // All busy

    const task = this.taskQueue.shift()!;
    this.activeWorkers.add(worker);

    const startTime = Date.now();

    const onMessage = (response: any) => {
      if (response.id === task.id) {
        cleanup();
        this.activeWorkers.delete(worker);

        const duration = Date.now() - startTime;
        this.completedTasks++;
        this.totalTaskDurationMs += duration;

        if (response.success) {
          task.resolve(response.data);
        } else {
          this.failedTasks++;
          task.reject(new Error(response.error || 'Task failed inside worker.'));
        }

        // Schedule idle termination for this worker
        this.scheduleWorkerIdleTermination(worker);
        this.processQueue();
      }
    };

    const onError = (err: Error) => {
      cleanup();
      this.activeWorkers.delete(worker);
      this.workers = this.workers.filter(w => w !== worker);
      worker.terminate();
      this.failedTasks++;
      task.reject(err);
      this.processQueue();
    };

    const cleanup = () => {
      worker.off('message', onMessage);
      worker.off('error', onError);
    };

    worker.on('message', onMessage);
    worker.on('error', onError);

    worker.postMessage({
      id: task.id,
      type: task.type,
      payload: task.payload,
    });
  }

  /**
   * Schedule an idle worker for termination after WORKER_IDLE_TIMEOUT_MS.
   * This dynamically shrinks the pool when demand is low.
   */
  private scheduleWorkerIdleTermination(worker: Worker): void {
    // Only shrink if pool has more than 1 idle worker
    const idleCount = this.workers.length - this.activeWorkers.size;
    if (idleCount <= 1) return;

    const timer = setTimeout(() => {
      if (!this.activeWorkers.has(worker)) {
        log.debug(`Terminating idle worker (pool: ${this.workers.length - 1}/${this.maxSize})`);
        worker.terminate();
        this.workers = this.workers.filter(w => w !== worker);
        this.workerIdleTimers.delete(worker);
      }
    }, WORKER_IDLE_TIMEOUT_MS);

    this.workerIdleTimers.set(worker, timer);
  }
}
