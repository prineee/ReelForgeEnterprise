/**
 * WorkflowState.ts
 *
 * The workflow lifecycle state machine: every status a workflow instance
 * can be in, every stage of the business-level pipeline it moves through,
 * and the legal transitions between statuses. Type-only plus one small
 * pure validator class — no I/O, no side effects.
 *
 * WorkflowStage is a business-process view of the movie lifecycle, not a
 * copy of services/ai/orchestration/MovieProductionContracts.ts's
 * ProductionStage. That enum has 11 finer-grained AI-pipeline stages
 * (including Emotion Planning and Prompt Composition, which this
 * workflow's diagram doesn't name); this one has the 15 stages this
 * workflow actually specifies, bookended by the business steps
 * (validate, reserve credits, queue, store assets, release credits) the
 * AI pipeline itself knows nothing about. WorkflowExecutor.ts bridges the
 * two by mapping real ProductionStage values onto the nearest
 * WorkflowStage here, without MovieProductionService needing to change.
 */

export enum WorkflowStatus {
  Created = 'CREATED',
  Validating = 'VALIDATING',
  Queued = 'QUEUED',
  Running = 'RUNNING',
  Paused = 'PAUSED',
  Retrying = 'RETRYING',
  Cancelled = 'CANCELLED',
  Completed = 'COMPLETED',
  Failed = 'FAILED',
}

export enum WorkflowStage {
  ValidateRequest = 'VALIDATE_REQUEST',
  ReserveCredits = 'RESERVE_CREDITS',
  CreateWorkflow = 'CREATE_WORKFLOW',
  CreateQueueJob = 'CREATE_QUEUE_JOB',
  StoryPlanning = 'STORY_PLANNING',
  CharacterPlanning = 'CHARACTER_PLANNING',
  EnvironmentPlanning = 'ENVIRONMENT_PLANNING',
  CameraPlanning = 'CAMERA_PLANNING',
  ScenePlanning = 'SCENE_PLANNING',
  ReferenceImages = 'REFERENCE_IMAGES',
  VideoGeneration = 'VIDEO_GENERATION',
  Rendering = 'RENDERING',
  StoreAssets = 'STORE_ASSETS',
  Complete = 'COMPLETE',
  ReleaseCredits = 'RELEASE_CREDITS',
}

/** The 15 stages in the order the mission's workflow diagram specifies them. */
export const WORKFLOW_STAGE_ORDER: WorkflowStage[] = [
  WorkflowStage.ValidateRequest,
  WorkflowStage.ReserveCredits,
  WorkflowStage.CreateWorkflow,
  WorkflowStage.CreateQueueJob,
  WorkflowStage.StoryPlanning,
  WorkflowStage.CharacterPlanning,
  WorkflowStage.EnvironmentPlanning,
  WorkflowStage.CameraPlanning,
  WorkflowStage.ScenePlanning,
  WorkflowStage.ReferenceImages,
  WorkflowStage.VideoGeneration,
  WorkflowStage.Rendering,
  WorkflowStage.StoreAssets,
  WorkflowStage.Complete,
  WorkflowStage.ReleaseCredits,
]

export type StageExecutionStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED'

export class WorkflowStateError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkflowStateError'
  }
}

const VALID_TRANSITIONS: Record<WorkflowStatus, WorkflowStatus[]> = {
  [WorkflowStatus.Created]: [WorkflowStatus.Validating, WorkflowStatus.Cancelled],
  [WorkflowStatus.Validating]: [WorkflowStatus.Queued, WorkflowStatus.Failed, WorkflowStatus.Cancelled],
  [WorkflowStatus.Queued]: [WorkflowStatus.Running, WorkflowStatus.Cancelled],
  [WorkflowStatus.Running]: [
    WorkflowStatus.Paused,
    WorkflowStatus.Retrying,
    WorkflowStatus.Completed,
    WorkflowStatus.Failed,
    WorkflowStatus.Cancelled,
  ],
  [WorkflowStatus.Paused]: [WorkflowStatus.Running, WorkflowStatus.Cancelled, WorkflowStatus.Failed],
  [WorkflowStatus.Retrying]: [WorkflowStatus.Running, WorkflowStatus.Failed, WorkflowStatus.Cancelled],
  [WorkflowStatus.Cancelled]: [],
  [WorkflowStatus.Completed]: [],
  [WorkflowStatus.Failed]: [],
}

/** Validates status transitions against VALID_TRANSITIONS. Holds no state of its own. */
export class WorkflowStateMachine {
  canTransition(from: WorkflowStatus, to: WorkflowStatus): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false
  }

  assertTransition(from: WorkflowStatus, to: WorkflowStatus): void {
    if (!this.canTransition(from, to)) {
      throw new WorkflowStateError(`Illegal workflow transition: ${from} -> ${to}.`)
    }
  }

  isTerminal(status: WorkflowStatus): boolean {
    return status === WorkflowStatus.Cancelled || status === WorkflowStatus.Completed || status === WorkflowStatus.Failed
  }
}
