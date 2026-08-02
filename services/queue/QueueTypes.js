"use strict";
/**
 * QueueTypes.ts
 *
 * The public vocabulary for the AI Job Queue: job identity, lifecycle
 * states, priority levels, and the shapes every other file in this module
 * operates on. Type-only — no business logic, no classes, no imports —
 * mirroring the same rule OrchestratorTypes.ts and
 * MovieProductionContracts.ts follow, so this stays a stable contract even
 * as the in-memory implementation underneath it is replaced later (a
 * Redis- or database-backed JobQueue, for instance).
 *
 * This module is deliberately independent of services/orchestrator/* and
 * services/ai/orchestration/*: a Job's payload is untyped (`unknown`) and
 * dispatched by a string `type` to a registered handler, so the queue has
 * no compile-time knowledge of movie production at all. Anything —
 * AIOrchestrator.planProduction(), MovieProductionService.startProduction(),
 * or something entirely unrelated — can be queued through the same
 * QueueManager without this file changing.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobPriorityLevel = exports.JobStatus = void 0;
var JobStatus;
(function (JobStatus) {
    JobStatus["Queued"] = "QUEUED";
    JobStatus["Waiting"] = "WAITING";
    JobStatus["Running"] = "RUNNING";
    JobStatus["Completed"] = "COMPLETED";
    JobStatus["Failed"] = "FAILED";
    JobStatus["Cancelled"] = "CANCELLED";
    JobStatus["Retrying"] = "RETRYING";
})(JobStatus || (exports.JobStatus = JobStatus = {}));
var JobPriorityLevel;
(function (JobPriorityLevel) {
    JobPriorityLevel["Emergency"] = "EMERGENCY";
    JobPriorityLevel["Premium"] = "PREMIUM";
    JobPriorityLevel["Normal"] = "NORMAL";
    JobPriorityLevel["Background"] = "BACKGROUND";
})(JobPriorityLevel || (exports.JobPriorityLevel = JobPriorityLevel = {}));
