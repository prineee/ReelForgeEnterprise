/**
 * WorkerPool.ts
 *
 * Real, minimal worker-slot abstraction: a fixed number of named slots,
 * each either IDLE or BUSY. jobs/RenderJobManager.ts acquires a slot
 * before starting a job and releases it when the job settles — this is
 * the actual concurrency gate (not services/queue/QueueManager.ts's own
 * `concurrency` option, which is a separate subsystem for the
 * movie-workflow queue and isn't reused here to avoid two independent
 * mechanisms fighting over the same decision).
 *
 * Sized to 1 today, per this sprint's explicit scope ("single worker for
 * now" — no multi-GPU, no distributed scheduling). Nothing about this
 * class assumes size 1: acquire()/release() already work for N slots, so
 * a future multi-GPU sprint raises `size` and nothing else changes here.
 */

export interface PoolWorker {
  readonly id: string;
  status: "IDLE" | "BUSY";
  currentJobId?: string;
}

export class WorkerPoolError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkerPoolError";
  }
}

export class WorkerPool {
  private readonly workers: PoolWorker[];

  constructor(size: number = 1) {
    if (size < 1) {
      throw new WorkerPoolError(`WorkerPool size must be at least 1, got ${size}.`);
    }
    this.workers = Array.from({ length: size }, (_, index) => ({
      id: `worker-${index + 1}`,
      status: "IDLE" as const,
    }));
  }

  /** Returns the first IDLE worker, marking it BUSY, or undefined if the pool is full. */
  acquire(jobId: string): PoolWorker | undefined {
    const worker = this.workers.find((w) => w.status === "IDLE");
    if (!worker) return undefined;
    worker.status = "BUSY";
    worker.currentJobId = jobId;
    return worker;
  }

  release(workerId: string): void {
    const worker = this.requireWorker(workerId);
    worker.status = "IDLE";
    worker.currentJobId = undefined;
  }

  getWorkers(): readonly PoolWorker[] {
    return this.workers;
  }

  getAvailableCount(): number {
    return this.workers.filter((w) => w.status === "IDLE").length;
  }

  isFull(): boolean {
    return this.getAvailableCount() === 0;
  }

  size(): number {
    return this.workers.length;
  }

  private requireWorker(workerId: string): PoolWorker {
    const worker = this.workers.find((w) => w.id === workerId);
    if (!worker) {
      throw new WorkerPoolError(`No worker "${workerId}" in this pool.`);
    }
    return worker;
  }
}
