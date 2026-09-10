// Backwards-compatibility adapter for the new job API contract.
//
// Backend (rust_api) used to expose stage info as flat top-level fields:
//   display_stage / stage / substage / lane / stage_detail / progress / background_stages
//
// The new contract publishes the same data through a structured object:
//   stage_snapshot:        { display_stage, stage, substage, lane, stage_detail, progress }
//   stage_snapshot === null when status is succeeded/failed/canceled (terminal)
//   background_snapshots:  array, same item shape as the old background_stages
//
// Rather than rewrite ~48 frontend consumers that all read the legacy flat
// shape, we project the new shape back to the old one at the API boundary.
// `display_stage="done"` is intentionally never produced by the backend; the UI
// reads job.status === "succeeded" to light up the final tab.

import type { BackendStageSnapshot, JobLike, JobProgress } from "./types.js";

function backgroundSnapshotsFor(payload: JobLike = {}): unknown[] {
  if (Array.isArray(payload?.background_snapshots)) {
    return payload.background_snapshots;
  }
  if (Array.isArray(payload?.background_stages)) {
    return payload.background_stages;
  }
  return [];
}

export function flattenStageSnapshot(payload: JobLike | null | undefined = {}): JobLike {
  if (!payload || typeof payload !== "object") {
    return (payload || {}) as JobLike;
  }
  const snapshot = payload.stage_snapshot && typeof payload.stage_snapshot === "object"
    ? payload.stage_snapshot as BackendStageSnapshot
    : null;
  const backgroundStages = backgroundSnapshotsFor(payload);

  if (!snapshot) {
    // Terminal job (or list item without an active stage). Keep whatever
    // legacy fields might still be present, normalize background_stages.
    return {
      ...payload,
      display_stage: payload.display_stage || "",
      stage: payload.stage || "",
      substage: payload.substage || "",
      lane: payload.lane || "",
      stage_detail: payload.stage_detail || "",
      progress: payload.progress && typeof payload.progress === "object" ? payload.progress : {},
      background_stages: backgroundStages,
    };
  }

  return {
    ...payload,
    display_stage: snapshot.display_stage || payload.display_stage || "",
    stage: snapshot.stage || payload.stage || "",
    substage: snapshot.substage || payload.substage || "",
    lane: snapshot.lane || payload.lane || "main",
    stage_detail: snapshot.stage_detail || payload.stage_detail || "",
    progress: snapshot.progress && typeof snapshot.progress === "object"
      ? snapshot.progress as JobProgress
      : (payload.progress && typeof payload.progress === "object" ? payload.progress : {}),
    background_stages: backgroundStages,
  };
}
