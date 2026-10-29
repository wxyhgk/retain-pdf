// 恢复数据库备份的那几秒里，上传、建任务、原地重跑回 409 restore_in_progress（后端 fix/restore-in-progress-gate）。
// 前端给一句中文；一次上传多本时这本放回等待、过一会儿自动接着传，不算传坏。
import test from "node:test";
import assert from "node:assert/strict";

const { createBatchUploadSession } = await import("../../src/features/ingest/domain/upload/batch-session.ts");
const { runBatchSubmit } = await import("../../src/features/ingest/domain/actions/submit/batch.ts");
const {
  RESTORE_IN_PROGRESS_MESSAGE,
  isRefusedSubmission,
  isRestoreInProgressError,
  restoreInProgressErrorFromPayload,
} = await import("../../../packages/api/src/http.ts");

const BODY = {
  code: 40900,
  message: "a database backup is being restored; try again in a moment",
  error: { code: "CONFLICT", details: { reason: "restore_in_progress" } },
};
const pdf = (name) => ({ name, size: 1000, type: "application/pdf" });

test("409 restore_in_progress 做成一句中文，算「被拒、不是故障」；别的 409 照旧", () => {
  const error = restoreInProgressErrorFromPayload(409, BODY);
  assert.equal(error.message, "正在恢复备份，稍等再试。");
  assert.equal(error.status, 409);
  assert.equal(error.reason, "restore_in_progress");
  assert.ok(isRestoreInProgressError(error));
  assert.ok(isRefusedSubmission(error));
  assert.equal(restoreInProgressErrorFromPayload(409, { error: { code: "CONFLICT", details: { reason: "job_active" } } }), null);
});

test("上传、建任务、书的翻译、续跑、重试：报错就是那句中文，不带英文原话", async () => {
  const { submitJobRequest } = await import("../../../packages/api/src/jobs-submit.ts");
  const { translateDocument } = await import("../../../packages/api/src/documents.ts");
  const { resumeJob, retryJobStage } = await import("../../../packages/api/src/jobs-actions.ts");
  const { submitJson } = await import("../../../packages/api/src/http.ts");
  const original = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify(BODY), { status: 409, headers: { "content-type": "application/json" } });
  try {
    for (const run of [
      () => submitJobRequest("/api/v1", { workflow: "translate", source: { upload_id: "up-1" } }),
      () => translateDocument("/api/v1", "doc-1", {}),
      () => resumeJob("job-1", "/api/v1", {}),
      () => retryJobStage("job-1", "/api/v1", "render"),
      () => submitJson("http://127.0.0.1:41000/api/v1/jobs", {}),
    ]) {
      const error = await run().catch((e) => e);
      assert.ok(isRestoreInProgressError(error), `${run}`);
      assert.equal(error.message, RESTORE_IN_PROGRESS_MESSAGE);
    }
  } finally {
    globalThis.fetch = original;
  }
});

test("一次上传多本：恢复备份时这本放回等待、显示原因，过一会儿重传，传上了不算失败", async () => {
  const refused = restoreInProgressErrorFromPayload(409, BODY);
  const attempts = [];
  const waits = [];
  let releaseWait;
  const session = createBatchUploadSession({
    uploadFile: async (file) => {
      attempts.push(file.name);
      if (attempts.length === 1) throw refused;
      return { uploadId: `up-${file.name}`, documentId: "", fileName: file.name, pageCount: 3 };
    },
    submitBatch: async () => ({ status: "done", submitted: 0, failed: 0 }),
    wait: (ms) => {
      waits.push(ms);
      return new Promise((resolve) => { releaseWait = resolve; });
    },
  });
  const done = session.start([pdf("a.pdf"), pdf("b.pdf")]);
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  const waiting = session.getSnapshot().items[0];
  assert.equal(waiting.status, "waiting", "不标成传坏");
  assert.match(waiting.message, /正在恢复备份/);
  assert.equal(waits.length, 1);
  releaseWait();
  await done;
  assert.deepEqual(attempts, ["a.pdf", "a.pdf", "b.pdf"], "同一本重传，后面的照常传");
  assert.deepEqual(session.getSnapshot().items.map((item) => [item.status, item.message]), [["uploaded", ""], ["uploaded", ""]]);
});

test("一次上传多本：一直在恢复（超过两分钟）就别等了，标成传坏、写原因", async () => {
  const refused = restoreInProgressErrorFromPayload(409, BODY);
  let waits = 0;
  const session = createBatchUploadSession({
    uploadFile: async () => { throw refused; },
    submitBatch: async () => ({ status: "done", submitted: 0, failed: 0 }),
    // 等待立即返回：要是没封顶，这里会一直转、把事件循环占满，测试超时都触发不了，所以自己抛出来。
    wait: async () => {
      waits += 1;
      if (waits > 100) throw new Error("等了 100 次还在等：没封顶");
    },
  });
  await session.start([pdf("a.pdf")]);
  assert.equal(waits, 40);
  assert.deepEqual(session.getSnapshot().items.map((item) => [item.status, item.message]), [["upload_failed", RESTORE_IN_PROGRESS_MESSAGE]]);
});

test("一次交多本：交到一半开始恢复备份，剩下的不再交，各自标上那句中文", async () => {
  const refused = restoreInProgressErrorFromPayload(409, BODY);
  const sent = [];
  const results = [];
  const outcome = await runBatchSubmit({
    uploadIds: ["up-1", "up-2", "up-3"],
    collectRunPayload: ({ uploadId }) => ({ source: { upload_id: uploadId } }),
    onItem: (uploadId, result) => results.push([uploadId, result.ok ? "ok" : result.message]),
    workflow: "translate",
    configPort: { isMock: () => true },
    setText: () => {},
    submitJobRequest: async (_prefix, payload) => {
      sent.push(payload);
      if (sent.length === 2) throw refused;
      return { job_id: `job-${sent.length}` };
    },
  });
  assert.equal(sent.length, 2, "第 3 本没再发");
  assert.deepEqual(results, [
    ["up-1", "ok"],
    ["up-2", RESTORE_IN_PROGRESS_MESSAGE],
    ["up-3", RESTORE_IN_PROGRESS_MESSAGE],
  ]);
  assert.deepEqual([outcome.submitted, outcome.failed], [1, 2]);
});
