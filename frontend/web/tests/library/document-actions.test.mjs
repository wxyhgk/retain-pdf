import test from "node:test";
import assert from "node:assert/strict";

// controller.ts 拆出的 documents/* 模块单测（纯逻辑与可注入 factory）。

const { friendlyTranslateError, friendlyDocumentDeleteError } = await import(
  "../../src/features/library/domain/documents/error-messages.js"
);
const { assembleTranslatePayload, assembleOcrPayload } = await import(
  "../../src/features/library/domain/documents/submit-payloads.js"
);
const { createDocumentDeleteActions } = await import(
  "../../src/features/library/domain/documents/delete-actions.js"
);
const { createDocumentJobActions } = await import(
  "../../src/features/library/domain/documents/job-actions.js"
);
const { createBookDetailNavigation } = await import(
  "../../src/features/library/domain/documents/navigation-actions.js"
);

test("错误文案：凭据缺失、OCR 复用失败", () => {
  assert.match(friendlyTranslateError(new Error("paddle_token is required")), /配置 OCR/);
  assert.match(
    friendlyTranslateError({ errorCode: "OCR_PAGE_COVERAGE_MISMATCH" }),
    /未覆盖所选页码/,
  );
  assert.match(
    friendlyTranslateError(new Error("paddle_token is required"), { reusingOcr: true }),
    /配置翻译 API/,
  );
  assert.equal(friendlyTranslateError(""), "发起翻译失败，请稍后重试。");

  assert.equal(friendlyDocumentDeleteError(new Error("boom")), "boom");
  // 没带 reason 的 409 是"还有排队或运行中的任务"（收藏挡删除的 409 后端已删）。
  const conflict = Object.assign(new Error("book is Running; pass force=true to delete it(409)"), { status: 409 });
  assert.equal(friendlyDocumentDeleteError(conflict), "还有排队或运行中的任务，请先取消再删除。");
  assert.equal(friendlyDocumentDeleteError(new Error("x(409)")), "还有排队或运行中的任务，请先取消再删除。");
  // 别的任务还在用它的产物：按 reason 单独提示，不说成“任务在跑”。
  const dependents = Object.assign(
    new Error("other jobs still use this job's artifacts: job-r (uses job-a); delete them first or pass force=true(409)"),
    { status: 409, errorCode: "CONFLICT", reason: "job_has_dependents" },
  );
  assert.equal(
    friendlyDocumentDeleteError(dependents),
    "还有别的任务在用这个任务的产物（比如换字体重排出的版本），请先删掉那些任务再删。",
  );
});

test("提交载荷：凭据基座 + overrides 叠加；复用 OCR 时删掉 ocr 字段", () => {
  const baseTranslate = (pageRanges = "") => ({
    ocr: { provider: "paddle", page_ranges: pageRanges },
    translation: { model: "deepseek" },
  });
  const merged = assembleTranslatePayload({ ocr: { page_ranges: "2-4" } }, baseTranslate);
  assert.equal(merged.ocr.page_ranges, "2-4");
  assert.equal(merged.translation.model, "deepseek");

  const reuse = assembleTranslatePayload(
    { workflow: "translate", source: { artifact_job_id: "job-ocr" }, translation: { page_ranges: [1, 2] } },
    baseTranslate,
  );
  assert.equal("ocr" in reuse, false, "复用 OCR 不得再带 ocr 配置");
  assert.equal(reuse.workflow, "translate");
  assert.deepEqual(reuse.source, { artifact_job_id: "job-ocr" });

  const ocr = assembleOcrPayload({ ocr: { page_ranges: "5-6" } }, (pageRanges = "") => ({
    ocr: { provider: "paddle", page_ranges: pageRanges },
  }));
  assert.equal(ocr.workflow, "ocr");
  assert.equal(ocr.ocr.page_ranges, "5-6");
});

test("任务动作：cancel 按 workflow 路由；retry 带 document_id 并 promote", async () => {
  const fakeStore = {
    getState: () => ({ open: true, payload: { document_id: "doc-1", title: "标题" } }),
  };
  const calls = [];
  const actions = createDocumentJobActions({
    bookDetailStore: fakeStore,
    promoteDocumentToJob: () => {},
    fetchDocumentJobs: async () => ({ items: [] }),
    fetchDocumentByJobId: async () => null,
    fetchJobStageActions: async () => ({ stages: [] }),
    cancelJobApi: async (id, prefix) => calls.push(["cancel-job", id, prefix]),
    cancelOcrJobApi: async (id, prefix) => calls.push(["cancel-ocr", id, prefix]),
  });

  await actions.cancelJob("job-1", "ocr");
  await actions.cancelJob("job-2", "book");
  assert.deepEqual(calls.map((entry) => entry[0]), ["cancel-ocr", "cancel-job"]);
  assert.deepEqual(await actions.getDocumentJobs(""), { items: [] });
  assert.equal(await actions.getJobStageActions("doc:synthetic"), null);
  assert.equal(await actions.getDocumentByJobId(""), null);

  const retryCalls = [];
  const retryActions = createDocumentJobActions({
    bookDetailStore: fakeStore,
    buildTranslateConfig: () => ({ translation: { model: "deepseek" } }),
    promoteDocumentToJob: (documentId, result) => retryCalls.push(["promote", documentId, result.job_id]),
    retryJobStageApi: async (id, _prefix, stage, payload) => {
      retryCalls.push(["retry", id, stage, payload.document_id, payload.overrides.translation.model]);
      return { job_id: "job-new" };
    },
  });
  await retryActions.retryJobStage("job-old", "translation", {});
  assert.deepEqual(retryCalls[0], ["retry", "job-old", "translation", "doc-1", "deepseek"]);
  assert.deepEqual(retryCalls[1], ["promote", "doc-1", "job-new"]);
});

test("重新翻译：书详情里选了的模型连接、翻译方式盖在设置上面；换了连接不带设置里的 credential_ref", async () => {
  const captured = [];
  const actions = createDocumentJobActions({
    bookDetailStore: { getState: () => ({ payload: { document_id: "doc-1", title: "t" } }), setJobs: () => {} },
    buildTranslateConfig: () => ({
      translation: {
        model: "claude-haiku-5-5",
        base_url: "https://api.anthropic.com/v1",
        api_key: "sk-settings",
        credential_ref: "cred-settings",
        api_protocol: "anthropic",
        engine: "legacy",
        workers: 8,
      },
    }),
    promoteDocumentToJob: () => {},
    retryJobStageApi: async (_id, _prefix, _stage, payload) => {
      captured.push(payload.overrides.translation);
      return { job_id: "job-new" };
    },
  });
  await actions.retryJobStage("job-old", "translation", {
    overrides: {
      translation: {
        engine: "agent",
        base_url: "http://1.94.67.196:1561/v1",
        model: "Qwen3.8-27B-Uncensored",
        api_key: "sk-qwen",
        api_protocol: "openai_responses",
        thinking: "off",
      },
    },
  });
  assert.deepEqual(captured[0], {
    model: "Qwen3.8-27B-Uncensored",
    base_url: "http://1.94.67.196:1561/v1",
    api_key: "sk-qwen",
    api_protocol: "openai_responses",
    thinking: "off",
    engine: "agent",
    workers: 8,
  }, "选的整套盖住设置；设置里的 credential_ref 没带");

  await actions.retryJobStage("job-old", "translation", {});
  assert.equal(captured[1].model, "claude-haiku-5-5", "什么都没选：用设置里的");
  assert.equal(captured[1].credential_ref, "cred-settings");
});

test("从断点继续：回执 promote 到详情 payload，详情跟上新任务而不是停在旧的失败任务", async () => {
  const { createDialogStore } = await import("../../src/platform/store/dialog-store.js");
  const { promoteDocumentToJob } = await import("../../src/features/library/domain/documents/promote.js");
  const bookDetailStore = createDialogStore(null);
  bookDetailStore.open({ document_id: "doc-1", job_id: "job-old", status: "failed", workflow: "book", title: "标题" });
  const attached = [];
  const resumed = [];
  const actions = createDocumentJobActions({
    bookDetailStore,
    promoteDocumentToJob: (documentId, result, sourceJobId) => promoteDocumentToJob({
      bookDetailStore,
      attachJobProgress: (jobId) => attached.push(jobId),
      documentId,
      result,
      sourceJobId,
    }),
    resumeJobApi: async (id, prefix) => {
      resumed.push([id, prefix]);
      return { job_id: "job-new", status: "queued" };
    },
  });

  const receipt = await actions.resumeJob("job-old");
  assert.equal(receipt.job_id, "job-new");
  assert.equal(resumed[0][0], "job-old");
  const payload = bookDetailStore.getState().payload;
  assert.equal(payload.job_id, "job-new", "详情 payload 换成新任务");
  assert.equal(payload.status, "queued", "不再是旧任务的 failed");
  assert.equal(payload.document_id, "doc-1");
  assert.deepEqual(attached, ["job-new"], "静默接上新任务的进度");
  assert.equal(await actions.resumeJob("doc:synthetic"), null);
});

test("重新翻译：只覆盖详情页真能改的字段，不碰原任务的术语表/自定义规则", () => {
  // 语义分工：「重试」用原任务配置，「重新翻译」用当前配置。但详情页没有术语表
  // 选择器、也没有自定义规则输入框——buildTranslateConfig 复用的是上传弹窗的
  // payload 构造器，这三个字段在那里恒为空值。后端 merge_json 是逐键浅覆盖，
  // 发过去就等于把原任务的术语表静默清空，而用户在这个页面上没被问过。
  return (async () => {
    const captured = [];
    const store = {
      getState: () => ({ payload: { document_id: "doc-1", title: "t" } }),
      setJobs: () => {},
    };
    const actions = createDocumentJobActions({
      bookDetailStore: store,
      buildTranslateConfig: () => ({
        translation: {
          model: "deepseek-new",
          base_url: "https://api.deepseek.com/v1",
          workers: 42,
          glossary_id: "",
          glossary_entries: [],
          custom_rules_text: "",
        },
      }),
      promoteDocumentToJob: () => {},
      retryJobStageApi: async (_id, _prefix, _stage, payload) => {
        captured.push(payload.overrides.translation);
        return { job_id: "job-new" };
      },
    });
    await actions.retryJobStage("job-old", "translation", {});

    const override = captured[0];
    // 凭据面板能改的照常覆盖
    assert.equal(override.model, "deepseek-new");
    assert.equal(override.workers, 42);
    // 详情页没有控件的三个字段必须完全不出现——出现即覆盖原任务
    for (const field of ["glossary_id", "glossary_entries", "custom_rules_text"]) {
      assert.ok(
        !(field in override),
        `override 里不该有 ${field}：详情页没有这个控件，发过去会清掉原任务的值`,
      );
    }
  })();
});

test("导航：活跃任务打开详情时接管静默进度", () => {
  const opened = [];
  const attached = [];
  const nav = createBookDetailNavigation({
    bookDetailStore: { open: (payload) => opened.push(payload) },
    attachJobProgress: (jobId, options) => attached.push([jobId, options]),
    recentJobsStatePort: { getSnapshot: () => ({ items: [{ job_id: "j1", document_id: "doc-1" }] }) },
  });

  nav.openBookDetail({ document_id: "doc-1", job_id: "j1", status: "running" });
  assert.equal(opened.length, 1);
  assert.deepEqual(attached, [["j1", { recovering: true }]]);

  opened.length = 0;
  attached.length = 0;
  nav.openBookDetail({ document_id: "doc-1", job_id: "j9", status: "succeeded" });
  assert.equal(opened.length, 1, "非活跃任务仍可打开详情");
  assert.equal(attached.length, 0, "非活跃任务不接管轮询");
});
