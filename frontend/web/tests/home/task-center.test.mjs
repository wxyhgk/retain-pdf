import test from "node:test";
import assert from "node:assert/strict";

const {
  groupTaskCenterJobs,
  taskCenterCounts,
  taskDocumentLabel,
  taskIdentity,
  taskProgressPercent,
  taskWorkflowLabel,
} = await import("../../src/features/task-center/domain/model.js");
const {
  cancelTaskCenterJob,
  loadTaskCenterJobs,
  retryTaskCenterJob,
} = await import("../../src/features/task-center/domain/task-center-api.js");

function job(overrides = {}) {
  return {
    job_id: "job-1",
    display_name: "论文.pdf",
    workflow: "translate",
    status: "queued",
    stage_snapshot: null,
    background_snapshots: [],
    stages: {},
    output_pdf_ready: false,
    markdown_ready: false,
    bundle_ready: false,
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    detail_path: "/api/v1/jobs/job-1",
    detail_url: "http://localhost/api/v1/jobs/job-1",
    ...overrides,
  };
}

test("task center:按 job_id 保留同一文档的独立任务并分组", () => {
  const items = [
    job({ job_id: "job-running", status: "running", display_name: "同一论文.pdf" }),
    job({ job_id: "job-queued", status: "queued", display_name: "同一论文.pdf" }),
    job({ job_id: "job-failed", status: "failed" }),
    job({ job_id: "job-done", status: "succeeded" }),
    job({ job_id: "job-cancelled", status: "cancelled" }),
  ];
  const groups = groupTaskCenterJobs(items);
  assert.deepEqual(groups.map((group) => [group.key, group.items.map((item) => item.job_id)]), [
    ["running", ["job-running"]],
    ["queued", ["job-queued"]],
    ["failed", ["job-failed"]],
    ["completed", ["job-done", "job-cancelled"]],
  ]);
  assert.equal(taskIdentity(items[0]), "job:job-running");
  assert.equal(taskIdentity(items[1]), "job:job-queued");
  assert.deepEqual(taskCenterCounts(items), { total: 5, running: 1, queued: 1, failed: 1, completed: 2 });
});

test("task center:文档名称和进度只读取 jobs 契约字段", () => {
  assert.equal(taskDocumentLabel(job({ display_name: "", source_file_name: "source.pdf" })), "source.pdf");
  assert.equal(taskProgressPercent(job({
    stage_snapshot: { progress: { current: 2, total: 5 } },
  })), 40);
  assert.equal(taskProgressPercent(job({ stage_snapshot: null })), null);
  assert.deepEqual(["ocr", "book", "translate", "render"].map((workflow) => (
    taskWorkflowLabel(job({ workflow }))
  )), ["OCR", "整本翻译", "翻译", "渲染"]);
});

test("task center:取消按后端 workflow 选择通用或 OCR 接口", async () => {
  const calls = [];
  const dependencies = {
    cancelTranslation: async (...args) => calls.push(["translate", ...args]),
    cancelOcr: async (...args) => calls.push(["ocr", ...args]),
  };
  await cancelTaskCenterJob(job({ job_id: "translate-1", workflow: "translate" }), dependencies);
  await cancelTaskCenterJob(job({ job_id: "ocr-1", workflow: "ocr" }), dependencies);
  assert.deepEqual(calls.map(([kind, id]) => [kind, id]), [
    ["translate", "translate-1"],
    ["ocr", "ocr-1"],
  ]);
});

test("task center:顶部统计的数据源是 jobs API 分页加载范围", async () => {
  const calls = [];
  const payload = { items: [job()], invocation_summary: { stage_spec_count: 1, unknown_count: 0 } };
  const result = await loadTaskCenterJobs({
    fetchList: async (apiPrefix, query) => { calls.push([apiPrefix, query]); return payload; },
  });
  assert.deepEqual(result, { items: payload.items, reachedLimit: false });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0][1], { limit: 500, offset: 0 });
});

test("task center:jobs 分页按 job_id 去重但不合并文档名称", async () => {
  const firstPage = Array.from({ length: 500 }, (_, index) => (
    job({ job_id: `job-${index}`, display_name: "同一论文.pdf" })
  ));
  const calls = [];
  const result = await loadTaskCenterJobs({
    fetchList: async (_apiPrefix, query) => {
      calls.push(query.offset);
      return {
        items: query.offset === 0
          ? firstPage
          : [job({ job_id: "job-499" }), job({ job_id: "job-500" })],
        invocation_summary: { stage_spec_count: 0, unknown_count: 0 },
      };
    },
  });
  assert.deepEqual(calls, [0, 500]);
  assert.equal(result.items.length, 501);
  assert.equal(result.items.filter((item) => item.display_name === "同一论文.pdf").length, 500);
  assert.equal(result.reachedLimit, false);
});

test("task center:重试只提交详情中启用的后端 rerun URL", async () => {
  const calls = [];
  const result = await retryTaskCenterJob("failed-1", {
    fetchDetail: async (jobId) => ({ job_id: jobId, status: "failed" }),
    resolveActions: () => ({ rerunEnabled: true, rerun: "/api/v1/jobs/failed-1/rerun" }),
    rerun: async (url) => { calls.push(url); return { job_id: "retry-1" }; },
  });
  assert.deepEqual(result, { job_id: "retry-1" });
  assert.deepEqual(calls, ["/api/v1/jobs/failed-1/rerun"]);

  await assert.rejects(
    retryTaskCenterJob("failed-2", {
      fetchDetail: async () => ({ job_id: "failed-2", status: "failed" }),
      resolveActions: () => ({ rerunEnabled: false, rerun: "" }),
      rerun: async () => assert.fail("不可重试时不得构造或提交 URL"),
    }),
    /后端未提供可用的重试操作/,
  );
});
