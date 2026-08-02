/**
 * AssetDependencyGraph.ts
 *
 * A genuinely new concept — no dependency-graph/DAG abstraction exists
 * anywhere else in this codebase (confirmed by inspection). Builds a real
 * directed acyclic graph over a MovieBlueprint's already-generated
 * entities, using only the id-reference fields already in
 * services/ai/director/OutputSchema.ts (Scene.characterIds/environmentId/
 * cameraPlanId/emotionPlanId, Character.referenceImages,
 * Environment.referenceImages) — no new entity relationships are
 * invented. Edges point from prerequisite to dependent (u -> v means "u
 * must be ready before v"), so topologicalOrder() returns a valid
 * readiness order and readinessFor(nodeId) returns every real ancestor.
 *
 * No AI model calls, no media generation — pure graph construction and
 * traversal (Kahn's algorithm for the topological sort).
 */

import type { MovieBlueprint } from "../director/DirectorEngine";
import type { EntityId } from "../director/OutputSchema";

export type AssetNodeType = "CHARACTER" | "ENVIRONMENT" | "CAMERA_PLAN" | "EMOTION_PLAN" | "SCENE" | "REFERENCE_IMAGE";

export interface AssetNode {
  id: EntityId;
  type: AssetNodeType;
  label: string;
}

export class AssetDependencyGraphError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssetDependencyGraphError";
  }
}

export class AssetDependencyGraph {
  private readonly nodes = new Map<EntityId, AssetNode>();
  /** prerequisite id -> set of dependent ids (nodes that need this one first). */
  private readonly dependents = new Map<EntityId, Set<EntityId>>();
  /** dependent id -> set of prerequisite ids. */
  private readonly prerequisites = new Map<EntityId, Set<EntityId>>();

  build(movie: MovieBlueprint): void {
    for (const character of movie.characters) {
      this.addNode({ id: character.id, type: "CHARACTER", label: character.name });
      for (const image of character.referenceImages) {
        this.addNode({ id: image.id, type: "REFERENCE_IMAGE", label: image.description ?? `${character.name} reference (${image.angle ?? "unspecified angle"})` });
        this.addEdge(character.id, image.id);
      }
    }

    for (const environment of movie.environments) {
      this.addNode({ id: environment.id, type: "ENVIRONMENT", label: environment.name });
      for (const image of environment.referenceImages ?? []) {
        this.addNode({ id: image.id, type: "REFERENCE_IMAGE", label: image.description ?? `${environment.name} reference (${image.angle ?? "unspecified angle"})` });
        this.addEdge(environment.id, image.id);
      }
    }

    for (const cameraPlan of movie.cameraPlans) {
      this.addNode({ id: cameraPlan.id, type: "CAMERA_PLAN", label: `Camera plan for scene ${cameraPlan.sceneNumber}` });
    }

    for (const emotionPlan of movie.emotionPlans) {
      this.addNode({ id: emotionPlan.id, type: "EMOTION_PLAN", label: `Emotion plan for scene ${emotionPlan.sceneNumber}` });
    }

    for (const scene of movie.scenes) {
      this.addNode({ id: scene.id, type: "SCENE", label: scene.title ?? `Scene ${scene.sceneNumber}` });
      this.addEdge(scene.environmentId, scene.id);
      this.addEdge(scene.cameraPlanId, scene.id);
      this.addEdge(scene.emotionPlanId, scene.id);
      for (const characterId of scene.characterIds) {
        this.addEdge(characterId, scene.id);
        const character = movie.characters.find((c) => c.id === characterId);
        for (const image of character?.referenceImages ?? []) {
          this.addEdge(image.id, scene.id);
        }
      }
      const environment = movie.environments.find((e) => e.id === scene.environmentId);
      for (const image of environment?.referenceImages ?? []) {
        this.addEdge(image.id, scene.id);
      }
    }
  }

  getNode(id: EntityId): AssetNode | undefined {
    return this.nodes.get(id);
  }

  getDependencies(id: EntityId): readonly AssetNode[] {
    return Array.from(this.prerequisites.get(id) ?? []).map((depId) => this.requireNode(depId));
  }

  getDependents(id: EntityId): readonly AssetNode[] {
    return Array.from(this.dependents.get(id) ?? []).map((depId) => this.requireNode(depId));
  }

  /** Every node that must be ready before `id` — the full ancestor set, not just direct dependencies. */
  readinessFor(id: EntityId): readonly AssetNode[] {
    this.requireNode(id);
    const visited = new Set<EntityId>();
    const queue = [...(this.prerequisites.get(id) ?? [])];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      for (const next of this.prerequisites.get(current) ?? []) {
        if (!visited.has(next)) queue.push(next);
      }
    }

    return Array.from(visited).map((nodeId) => this.requireNode(nodeId));
  }

  /** Kahn's algorithm — a valid build order where every node appears after all of its prerequisites. Throws AssetDependencyGraphError if the graph has a cycle. */
  topologicalOrder(): readonly AssetNode[] {
    const inDegree = new Map<EntityId, number>();
    for (const id of this.nodes.keys()) {
      inDegree.set(id, this.prerequisites.get(id)?.size ?? 0);
    }

    const queue = Array.from(inDegree.entries())
      .filter(([, degree]) => degree === 0)
      .map(([id]) => id);
    const order: AssetNode[] = [];

    while (queue.length > 0) {
      const id = queue.shift()!;
      order.push(this.requireNode(id));

      for (const dependentId of this.dependents.get(id) ?? []) {
        const remaining = (inDegree.get(dependentId) ?? 0) - 1;
        inDegree.set(dependentId, remaining);
        if (remaining === 0) queue.push(dependentId);
      }
    }

    if (order.length !== this.nodes.size) {
      throw new AssetDependencyGraphError("Cycle detected in asset dependency graph — cannot compute a topological order.");
    }

    return order;
  }

  private addNode(node: AssetNode): void {
    if (this.nodes.has(node.id)) return;
    this.nodes.set(node.id, node);
    // Don't clobber Sets addEdge() may have already created for this id.
    if (!this.dependents.has(node.id)) this.dependents.set(node.id, new Set());
    if (!this.prerequisites.has(node.id)) this.prerequisites.set(node.id, new Set());
  }

  /** Defensive about call order: ensures both Sets exist even if addEdge() is ever called before the corresponding addNode() — an edge is never silently dropped. */
  private addEdge(prerequisiteId: EntityId, dependentId: EntityId): void {
    if (!this.dependents.has(prerequisiteId)) this.dependents.set(prerequisiteId, new Set());
    if (!this.prerequisites.has(dependentId)) this.prerequisites.set(dependentId, new Set());
    this.dependents.get(prerequisiteId)!.add(dependentId);
    this.prerequisites.get(dependentId)!.add(prerequisiteId);
  }

  private requireNode(id: EntityId): AssetNode {
    const node = this.nodes.get(id);
    if (!node) {
      throw new AssetDependencyGraphError(`No node "${id}" in this graph.`);
    }
    return node;
  }
}
