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

function blockedFavoritesError(count = 2, path = "/api/v1/documents/doc-b/favorites") {
  return Object.assign(new Error("document is referenced by favorite(s)"), {
    errorCode: "DELETE_BLOCKED_BY_FAVORITES",
    favoriteCount: count,
    clearFavoritesPath: path,
  });
}

test("错误文案：凭据缺失、OCR 复用失败、结构化收藏 409", () => {
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

  assert.match(friendlyDocumentDeleteError(blockedFavoritesError(3)), /3 条收藏/);
  assert.equal(friendlyDocumentDeleteError(new Error("boom")), "boom");
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

test("删除动作：成功乐观移除 + reload；收藏挡住结构化透传；批量区分 blocked/failed", async () => {
  const removed = [];
  const calls = [];
  const actions = createDocumentDeleteActions({
    reload: () => calls.push(["reload"]),
    removeLibraryDocuments: (ids) => removed.push(...ids),
    deleteDocumentApi: async (prefix, id) => calls.push(["delete", prefix, id]),
    clearFavoritesApi: async (prefix, path) => {
      calls.push(["clear", prefix, path]);
      return 5;
    },
  });

  await actions.deleteDocument("doc-1");
  assert.deepEqual(removed, ["doc-1"]);
  assert.equal(await actions.clearFavorites("/api/v1/documents/x/favorites"), 5);
  assert.equal(await actions.clearFavorites(""), 0);

  const blocked = blockedFavoritesError();
  const onlyBlocked = createDocumentDeleteActions({
    reload() {},
    deleteDocumentApi: async () => {
      throw blocked;
    },
  });
  await assert.rejects(() => onlyBlocked.deleteDocument("doc-2"), (error) => error === blocked);

  const batch = createDocumentDeleteActions({
    reload() {},
    removeLibraryDocuments: (ids) => removed.push(...ids),
    deleteDocumentApi: async (_prefix, id) => {
      if (id === "doc-b") throw blocked;
      if (id === "doc-c") throw new Error("boom");
    },
  });
  const result = await batch.deleteDocuments(["doc-a", "doc-b", "doc-c"]);
  assert.equal(result.confirmed, 1);
  assert.equal(result.failed, 1);
  assert.equal(result.blocked.length, 1);
  assert.equal(result.blocked[0].documentId, "doc-b");
  assert.equal(result.blocked[0].clearFavoritesPath, blocked.clearFavoritesPath);
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
