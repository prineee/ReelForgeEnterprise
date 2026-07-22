export interface QueuedScene {
  sceneNumber: number;
  operationId: string;
  status: "queued" | "rendering" | "completed" | "failed";
}

export class SceneQueueManager {
  private queue: QueuedScene[] = [];

  add(
    sceneNumber: number,
    operationId: string
  ) {
    this.queue.push({
      sceneNumber,
      operationId,
      status: "queued",
    });
  }

  start(sceneNumber: number) {
    const scene = this.queue.find(
      (s) => s.sceneNumber === sceneNumber
    );

    if (scene) {
      scene.status = "rendering";
    }
  }

  complete(sceneNumber: number) {
    const scene = this.queue.find(
      (s) => s.sceneNumber === sceneNumber
    );

    if (scene) {
      scene.status = "completed";
    }
  }

  fail(sceneNumber: number) {
    const scene = this.queue.find(
      (s) => s.sceneNumber === sceneNumber
    );

    if (scene) {
      scene.status = "failed";
    }
  }

  getAll() {
    return this.queue;
  }

  completedCount() {
    return this.queue.filter(
      (s) => s.status === "completed"
    ).length;
  }
}