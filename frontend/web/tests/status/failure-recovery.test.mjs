import test from "node:test";
import assert from "node:assert/strict";

const {
  buildFailureRecoveryModel,
  createFailureRecoveryController,
  queueFullTitle,
  retryCountdownSeconds,
} = await import("../../src/features/job-detail/domain/dialog/failure-recovery.js");

function queueFullInput(overrides = {}) {
  return {
    job: {
      job_id: "job-1",
      failure: {
        failed_stage: "ocr",
        failure_code: "provider_error",
        provider_code: "10010",
        provider: "paddle",
        retryable: true,
      },
      provider_trace_id: "trace-top",
      ocr_provider_diagnostics: {
        provider: "paddle",
        last_error: {
          category: "queue_full",
          provider_code: "10010",
          trace_id: "trace-provider",
        },
      },
    },
    diagnostics: {
      retryable: true,
      retry_after: 30,
    },
    stageActions: {
      stages: [{
        stage: "ocr",
        can_retry: true,
        action: {
          method: "POST",
          url: "http://127.0.0.1:41000/api/v1/jobs/job-1/retry-stage",
          body: { stage: "ocr", ambiguous_request_policy: "block" },
        },
        will_reuse: ["source_pdf"],
        will_rerun: ["ocr"],
      }],
    },
    resumePlan: {
      reuses_artifacts: ["source_pdf"],
    },
    eventsPayload: {
      items: [{
        event: "retry_scheduled",
        timestamp: "2026-09-01T00:00:00Z",
        payload: { attempt: 2, max_attempts: 5 },
      }],
    },
    nowMs: Date.parse("2026-09-01T00:00:10Z"),
    ...overrides,
  };
}

test("failure recovery maps Paddle 10010 from structured fields", () => {
  const model = buildFailureRecoveryModel(queueFullInput());

  assert.equal(model.kind, "queue_full");
  assert.equal(model.providerCode, "10010");
  assert.equal(model.traceId, "trace-provider");
  assert.equal(model.attempt, 2);
  assert.equal(model.maxAttempts, 5);
  assert.equal(model.retryOcr.enabled, true);
  assert.equal(model.retryOcr.body.stage, "ocr");
  assert.equal(model.preservesSourcePdf, true);
  assert.equal(queueFullTitle(model), "Paddle OCR 队列繁忙");
  assert.equal(retryCountdownSeconds(model, Date.parse("2026-09-01T00:00:20Z")), 20);
});

test("failure recovery never guesses QueueFull from arbitrary prose", () => {
  const model = buildFailureRecoveryModel({
    job: {
      failure: {
        summary: "Paddle 10010 queue full，请稍后重试",
        provider: "paddle",
        retryable: true,
      },
    },
    diagnostics: { detail: "QueueFull" },
  });

  assert.equal(model.kind, "generic");
  assert.equal(model.retryAtMs, null);
});

test("QueueFull without retry_after uses safe copy and reports backend gap", () => {
  const input = queueFullInput();
  delete input.diagnostics.retry_after;
  const model = buildFailureRecoveryModel(input);

  assert.equal(model.retryAtMs, null);
  assert.match(model.statusText, /等待服务自动重试；也可立即重试/);
  assert.equal(model.backendGaps.includes("retry_after"), true);
});

test("ambiguous OCR cannot use ordinary immediate retry", async () => {
  let calls = 0;
  const model = buildFailureRecoveryModel({
    job: { failure: { failed_stage: "ocr", retryable: true } },
    diagnostics: { ocr_ambiguity: { status: "ambiguous", provider: "paddle" } },
    stageActions: queueFullInput().stageActions,
  });
  const controller = createFailureRecoveryController({
    retryStage: async () => { calls += 1; },
  });

  assert.equal(model.kind, "ocr_ambiguous");
  assert.equal(model.retryOcr.enabled, false);
  assert.equal(model.retryOcr.requiresDuplicateRisk, true);
  await assert.rejects(() => controller.retryOcrNow("job-1", model), /重复|安全/);
  assert.equal(calls, 0);
});

test("immediate OCR retry uses backend stage action body", async () => {
  const calls = [];
  const model = buildFailureRecoveryModel(queueFullInput());
  const controller = createFailureRecoveryController({
    retryStage: async (...args) => {
      calls.push(args);
      return { job_id: "job-2" };
    },
  });

  const result = await controller.retryOcrNow("job-1", model);
  assert.equal(result.job_id, "job-2");
  assert.deepEqual(calls, [["job-1", "ocr", {
    stage: "ocr",
    ambiguous_request_policy: "block",
  }]]);
});

test("copy trace id exposes success and failure outcomes", async () => {
  const copied = [];
  const model = buildFailureRecoveryModel(queueFullInput());
  const controller = createFailureRecoveryController({
    copyTrace: async (value) => copied.push(value),
  });

  assert.equal(await controller.copyTraceId(model), "trace-provider");
  assert.deepEqual(copied, ["trace-provider"]);
  await assert.rejects(
    () => controller.copyTraceId({ ...model, traceId: "" }),
    /未返回 Trace ID/,
  );
});
