/** 任务状态显示的唯一出处（@retainpdf/domain/job 的 status-presentation）。
 *
 * 以前同一件事各界面各写一份：任务中心把运行中写「运行中」、别处「处理中」；书籍详情
 * 把排队也写成「处理中」；任务详情把取消写成「准备中」；状态卡只认美式 canceled。
 */
import test from "node:test";
import assert from "node:assert/strict";

import {
  isActiveJobStatus,
  isFinishedJobStatus,
  jobStatusLabel,
  jobStatusPresentation,
  normalizeJobStatus,
} from "@retainpdf/domain/job";
import { documentJobPresentation } from "../../src/features/book-detail/domain/document-jobs-model.js";
import { recentJobStatusLabel } from "../../src/features/library/domain/card/recent-job-card-presenter.js";
import { taskGroupKey, taskStatusLabel } from "../../src/features/task-center/domain/model.js";

test("各种写法折回后端的五种状态", () => {
  assert.equal(normalizeJobStatus("Cancelled"), "canceled");
  assert.equal(normalizeJobStatus(" pending "), "queued");
  assert.equal(normalizeJobStatus("validating"), "running");
  assert.equal(normalizeJobStatus("timeout"), "failed");
  assert.equal(normalizeJobStatus(""), "");
  assert.equal(normalizeJobStatus(undefined), "");
  assert.equal(normalizeJobStatus("weird"), null);
});

test("进行中 / 已结束", () => {
  for (const status of ["queued", "running", "pending", "validating"]) assert.equal(isActiveJobStatus(status), true, status);
  for (const status of ["succeeded", "failed", "canceled", "cancelled", "", "weird"]) assert.equal(isActiveJobStatus(status), false, status);
  for (const status of ["succeeded", "failed", "canceled", "cancelled", "dead"]) assert.equal(isFinishedJobStatus(status), true, status);
  for (const status of ["queued", "running", ""]) assert.equal(isFinishedJobStatus(status), false, status);
});

test("文字与颜色：每种状态一个说法", () => {
  assert.deepEqual(jobStatusPresentation("queued"), { key: "queued", label: "排队中", tone: "active" });
  assert.deepEqual(jobStatusPresentation("running"), { key: "running", label: "处理中", tone: "active" });
  assert.deepEqual(jobStatusPresentation("succeeded"), { key: "succeeded", label: "已完成", tone: "done" });
  assert.deepEqual(jobStatusPresentation("failed"), { key: "failed", label: "失败", tone: "failed" });
  assert.deepEqual(jobStatusPresentation("cancelled"), { key: "canceled", label: "已取消", tone: "muted" });
  assert.equal(jobStatusLabel("", { idleLabel: "尚未翻译" }), "尚未翻译");
  assert.equal(jobStatusLabel("weird"), "weird", "认不出的原样显示");
  assert.equal(jobStatusLabel("weird", { unknownLabel: "准备中" }), "准备中");
});

test("成功但完成信号还没到：按处理中显示", () => {
  assert.deepEqual(jobStatusPresentation("succeeded", { succeededIsFinal: false }), { key: "running", label: "处理中", tone: "active" });
});

test("书架、书籍详情、任务中心说同一套话", () => {
  for (const status of ["queued", "running", "succeeded", "failed", "canceled", "cancelled"]) {
    const expected = jobStatusLabel(status);
    assert.equal(recentJobStatusLabel(status), expected, `书架 ${status}`);
    assert.equal(documentJobPresentation({ status }).label, expected, `书籍详情 ${status}`);
    assert.equal(taskStatusLabel({ status }), expected, `任务中心 ${status}`);
  }
  assert.equal(taskStatusLabel({ status: "running" }), "处理中", "任务中心不再写「运行中」");
  assert.equal(documentJobPresentation({ status: "queued" }).label, "排队中", "书籍详情不再把排队写成处理中");
  assert.equal(taskGroupKey({ status: "Cancelled" }), "completed");
});

test("任务详情：取消的任务写「已取消」（以前落到兜底写成「准备中」）", async () => {
  const { buildStatusDetailSnapshot } = await import("../../src/features/job-detail/domain/snapshot/snapshot.js");
  const canceled = buildStatusDetailSnapshot({ job_id: "job-canceled", status: "canceled" }, null);
  assert.equal(canceled.headline.statusLabel, "已取消");
  const running = buildStatusDetailSnapshot({ job_id: "job-running", status: "running" }, null);
  assert.equal(running.headline.statusLabel, "处理中");
  assert.equal(running.headline.tone, "running");
});
