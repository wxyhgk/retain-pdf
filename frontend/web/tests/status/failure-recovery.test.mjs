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
  // 阶段泛化后 OCR 专项文案不许漂移：后端没给 resume_from 时仍按 OCR 阶段算。
  assert.equal(model.preservationText, "原 PDF 会保留并用于重新 OCR。");
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

// 渲染失败：OCR 和翻译的产物都还在，后端 stage-actions 会给出 translation /
// render 两个可用阶段。泛化之前这类任务在面板上只剩一句「当前没有可识别的专门
// 恢复状态。」——本机 15 个失败任务里有 7 个是这种。
function renderFailureInput(overrides = {}) {
  return {
    job: {
      job_id: "job-render",
      failure: {
        failed_stage: "render",
        failure_code: "render_failed",
        failure_category: "render_failed",
        retryable: true,
        resume_from: "render",
        recovery_hint: "翻译结果完好，只需重跑渲染，不会重复调用 OCR 或翻译接口。",
      },
      provider_trace_id: "trace-render",
    },
    diagnostics: {},
    stageActions: {
      job_id: "job-render",
      stages: [
        {
          stage: "ocr",
          label: "重试 OCR",
          can_retry: false,
          reason: "source PDF is not available",
          disabled_reason: "source PDF is not available",
          will_reuse: ["source_pdf"],
          will_rerun: ["ocr", "translation", "render"],
          danger: true,
        },
        {
          stage: "translation",
          label: "重试翻译",
          can_retry: true,
          disabled_reason: "",
          action: {
            method: "POST",
            url: "http://127.0.0.1:41000/api/v1/jobs/job-render/retry-stage",
            body: { stage: "translation", ambiguous_request_policy: "block" },
          },
          will_reuse: ["source_pdf", "ocr_result"],
          will_rerun: ["translation", "render"],
          danger: false,
        },
        {
          stage: "render",
          label: "重新渲染",
          can_retry: true,
          disabled_reason: "",
          action: {
            method: "POST",
            url: "http://127.0.0.1:41000/api/v1/jobs/job-render/retry-stage",
            body: { stage: "render", ambiguous_request_policy: "block" },
          },
          will_reuse: ["source_pdf", "ocr_result", "translation_result"],
          will_rerun: ["render"],
          danger: false,
        },
      ],
    },
    ...overrides,
  };
}

test("渲染失败渲染后端给的全部阶段，推荐续跑阶段排第一", () => {
  const model = buildFailureRecoveryModel(renderFailureInput());

  assert.equal(model.kind, "generic");
  assert.equal(model.resumeFrom, "render");
  // 后端 resume_from 指向的阶段排第一，其余保持后端顺序。
  assert.deepEqual(model.stages.map((item) => item.stage), ["render", "ocr", "translation"]);

  const [render, ocr, translation] = model.stages;
  assert.equal(render.recommended, true);
  assert.equal(render.label, "重新渲染");
  assert.equal(render.action.enabled, true);
  assert.equal(render.action.body.stage, "render");
  assert.match(render.noteText, /推荐/);
  assert.match(render.noteText, /translation_result/);
  assert.match(render.noteText, /将重跑：render。/);

  assert.equal(translation.recommended, false);
  assert.equal(translation.action.enabled, true);
  assert.match(translation.noteText, /将重跑：translation、render。/);

  // 不能点的阶段照样列出来，但要说清为什么不能点。
  assert.equal(ocr.action.available, false);
  assert.equal(ocr.noteText, "source PDF is not available");
});

test("阶段恢复的文案与断点产物跟着 resume_from 走，不再只看 OCR", () => {
  const model = buildFailureRecoveryModel(renderFailureInput());

  assert.equal(model.statusText, "翻译结果完好，只需重跑渲染，不会重复调用 OCR 或翻译接口。");
  assert.equal(model.recoveryHint, "翻译结果完好，只需重跑渲染，不会重复调用 OCR 或翻译接口。");
  assert.deepEqual(model.checkpointArtifacts, ["source_pdf", "ocr_result", "translation_result"]);
  assert.equal(model.preservesSourcePdf, true);
  assert.match(model.preservationText, /将复用 source_pdf、ocr_result、translation_result/);
  // OCR 这一条本来就不可用，不该再被当成「后端没给恢复动作」上报。
  assert.equal(model.retryOcr.available, false);
  assert.equal(model.backendGaps.includes("stage_actions.action"), false);
});

test("前端不认识的失败分类，照样渲染后端给的恢复动作", () => {
  const input = renderFailureInput();
  input.job.failure.failure_code = "nobody-registered-this-yet";
  input.job.failure.failure_category = "nobody-registered-this-yet";
  input.job.failure.resume_from = "translation";
  input.job.failure.recovery_hint = "OCR 产物完好，从翻译阶段续跑，不会重复调用 OCR。";
  const model = buildFailureRecoveryModel(input);

  assert.equal(model.statusText, "OCR 产物完好，从翻译阶段续跑，不会重复调用 OCR。");
  assert.equal(model.stages[0].stage, "translation");
  assert.equal(model.stages[0].recommended, true);
  assert.equal(model.stages[0].action.enabled, true);
  assert.deepEqual(model.checkpointArtifacts, ["source_pdf", "ocr_result"]);
});

test("阶段重试打到后端指定的阶段上，body 原样透传", async () => {
  const calls = [];
  const model = buildFailureRecoveryModel(renderFailureInput());
  const controller = createFailureRecoveryController({
    retryStage: async (...args) => {
      calls.push(args);
      return { job_id: "job-render-2" };
    },
  });

  const result = await controller.retryStageNow("job-render", model, "render");
  assert.equal(result.job_id, "job-render-2");
  assert.deepEqual(calls, [["job-render", "render", {
    stage: "render",
    ambiguous_request_policy: "block",
  }]]);
});

test("不可用的阶段挡在控制器这一层，不会真发请求", async () => {
  let calls = 0;
  const model = buildFailureRecoveryModel(renderFailureInput());
  const controller = createFailureRecoveryController({
    retryStage: async () => { calls += 1; },
  });

  await assert.rejects(
    () => controller.retryStageNow("job-render", model, "ocr"),
    /source PDF is not available/,
  );
  assert.equal(calls, 0);
});
