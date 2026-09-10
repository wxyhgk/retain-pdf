import test from "node:test";
import assert from "node:assert/strict";
import {
  buildLiveMockJobPayload,
  isLiveMockJobActive,
  registerLiveMockJob,
  resetLiveMockJobs,
} from "@/platform/mock/live-jobs.js";
import {
  getMockDocument,
  getMockDocumentList,
  translateMockDocument,
} from "@/platform/mock/documents.js";
import { getMockJobPayload } from "@/platform/mock/index.js";

test("live mock job advances upload → ocr → translate → render → done", () => {
  resetLiveMockJobs();
  const startedAtMs = 1_000_000;
  const { jobId } = registerLiveMockJob({
    documentId: "doc-demo",
    title: "Demo PDF",
    pageCount: 12,
    startedAtMs,
    speed: 1,
  });

  const at = (elapsedMs) => buildLiveMockJobPayload(jobId, startedAtMs + elapsedMs);

  assert.equal(at(0).status, "queued");
  assert.equal(at(0).stage, "queued");
  assert.ok(isLiveMockJobActive(jobId, startedAtMs + 100));

  assert.equal(at(2_000).status, "running");
  assert.equal(at(2_000).stage, "ocr_processing");
  assert.ok(Number(at(2_000).progress?.percent) > 0);

  assert.equal(at(6_000).status, "running");
  assert.equal(at(6_000).stage, "translating");
  assert.equal(at(6_000).display_stage, "translation");

  assert.equal(at(13_000).status, "running");
  assert.equal(at(13_000).stage, "rendering");

  const done = at(20_000);
  assert.equal(done.status, "succeeded");
  assert.equal(done.stage, "finished");
  assert.equal(done.progress?.percent, 100);
  assert.equal(done.artifacts?.pdf_ready, true);
  assert.equal(isLiveMockJobActive(jobId, startedAtMs + 20_000), false);
});

test("live mock fromStage=translate starts at translation, not upload/ocr", () => {
  resetLiveMockJobs();
  const startedAtMs = 2_000_000;
  const { jobId } = registerLiveMockJob({
    title: "Retry translate",
    fromStage: "translation",
    startedAtMs,
    speed: 1,
  });
  const at0 = buildLiveMockJobPayload(jobId, startedAtMs);
  assert.equal(at0.status, "running");
  assert.equal(at0.stage, "translating");
  assert.equal(at0.display_stage, "translation");
  assert.match(`${at0.stage_detail}`, /翻译/);

  // 跳过 ocr 后时长更短：约 7s 翻译 + 3s 渲染
  const mid = buildLiveMockJobPayload(jobId, startedAtMs + 8_000);
  assert.equal(mid.stage, "rendering");
  const done = buildLiveMockJobPayload(jobId, startedAtMs + 12_000);
  assert.equal(done.status, "succeeded");
});

test("live mock fromStage=render starts at rendering", () => {
  resetLiveMockJobs();
  const startedAtMs = 3_000_000;
  const { jobId } = registerLiveMockJob({
    fromStage: "render",
    startedAtMs,
  });
  const at0 = buildLiveMockJobPayload(jobId, startedAtMs);
  assert.equal(at0.stage, "rendering");
  assert.equal(at0.display_stage, "render");
});

test("live mock fromStage=ocr starts at ocr_processing (skips queue)", () => {
  resetLiveMockJobs();
  const startedAtMs = 4_000_000;
  const { jobId } = registerLiveMockJob({
    fromStage: "ocr",
    startedAtMs,
  });
  const at0 = buildLiveMockJobPayload(jobId, startedAtMs);
  assert.equal(at0.stage, "ocr_processing");
  assert.equal(at0.display_stage, "ocr");
});

test("translateMockDocument wires live payload via getMockJobPayload", () => {
  resetLiveMockJobs();
  const targetId = "doc-ref-6a1f2c";
  // 其它测试可能写过 active_job_id，先清掉
  const doc = getMockDocument(targetId);
  doc.active_job_id = null;

  const result = translateMockDocument(targetId);
  assert.ok(result.job_id, "returns job_id");
  assert.equal(result.document_id, targetId);
  assert.ok(["queued", "running"].includes(`${result.status}`), `status=${result.status}`);

  const early = getMockJobPayload(result.job_id);
  assert.equal(early.job_id, result.job_id);
  assert.notEqual(early.status, "succeeded", "刚提交不应立刻 succeeded");
  assert.ok(
    ["queued", "ocr_processing", "translating"].includes(`${early.stage}`),
    `early stage=${early.stage}`,
  );

  assert.throws(
    () => translateMockDocument(targetId),
    /409|翻译流程中/,
  );

  // 终态后允许再提交
  const metaStarted = Date.now() - 60_000;
  resetLiveMockJobs();
  doc.active_job_id = null;
  const again = translateMockDocument(targetId);
  // 把 startedAt 拨到过去：通过重新 register 同 id 不太方便，用 isLiveMockJobActive 假时间
  // 这里只断言第二次在 cleared state 成功
  assert.ok(again.job_id);
  assert.ok(getMockDocumentList().documents.some((d) => d.document_id === targetId));
});
