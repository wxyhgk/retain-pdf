import test from "node:test";
import assert from "node:assert/strict";

import {
  createRecentJobsRuntimePatches,
} from "../../src/features/library/domain/recent-jobs/runtime-patches.ts";
import {
  createRecentJobsStatePort,
} from "../../src/features/library/domain/recent-jobs/state.ts";
import {
  isLibraryCardProcessing,
} from "../../src/features/library/domain/card/library-card-badge.js";

function makePatches() {
  const statePort = createRecentJobsStatePort();
  return createRecentJobsRuntimePatches({
    renderCurrentRecentJobs: () => {},
    replaceRecentJobCard: () => true,
    scheduleActiveRefresh: () => {},
    stageAdapterPort: {},
    statePort,
    storeDrivenRendering: true,
  });
}

test("提交即转圈：裸提交包（无status）insert后也是queued运行态", () => {
  const patches = makePatches();
  patches.insert({ job_id: "job-new-1", title: "a.pdf", document_id: "doc-1" });
  const merged = patches.apply([]);
  const card = merged.find((item) => `${item.job_id || ""}`.includes("job-new-1"));
  assert.ok(card, "新任务应出现在列表");
  assert.equal(isLibraryCardProcessing(card), true);
});

test("空状态刷新不降级：运行中补丁遇到后端滞后空行，保持运行态", () => {
  const patches = makePatches();
  patches.insert({ job_id: "job-run-1", title: "b.pdf", document_id: "doc-2" });
  // 首轮轮询带回运行态
  patches.update({ job_id: "job-run-1", document_id: "doc-2", title: "b.pdf", status: "running", stage: "translate" });
  // 后端滞后的刷新行（空状态、无stage）
  const merged = patches.apply([{ job_id: "job-run-1", document_id: "doc-2", title: "b.pdf", status: "", updated_at: "2026-09-04T00:00:00Z" }]);
  const card = merged.find((item) => item.job_id === "job-run-1");
  assert.ok(card, "卡片应保留");
  assert.equal(isLibraryCardProcessing(card), true);
});

test("终态刷新正常落地：轮询先写终态补丁，刷新行对齐后不转", () => {
  const patches = makePatches();
  patches.insert({ job_id: "job-done-1", title: "c.pdf", document_id: "doc-3" });
  patches.update({ job_id: "job-done-1", document_id: "doc-3", title: "c.pdf", status: "running", stage: "render" });
  // 终态轮询先到：补丁落终态
  patches.update({ job_id: "job-done-1", document_id: "doc-3", title: "c.pdf", status: "succeeded", stage: "done" });
  const merged = patches.apply([{ job_id: "job-done-1", document_id: "doc-3", title: "c.pdf", status: "succeeded", stage: "done", updated_at: "2026-09-04T00:00:00Z" }]);
  const card = merged.find((item) => item.job_id === "job-done-1");
  assert.ok(card, "卡片应保留");
  assert.equal(isLibraryCardProcessing(card), false);
});
