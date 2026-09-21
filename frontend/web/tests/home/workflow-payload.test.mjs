import test from "node:test";
import assert from "node:assert/strict";

import {
  buildOcrPayload,
  buildRenderPayload,
  buildSourcePayload,
  buildTranslationPayload,
} from "../../src/features/ingest/domain/workflow/payload.js";
import { mountWorkflowFeature } from "../../src/features/ingest/domain/workflow/controller.js";
import { createGlossaryOptionsLoader } from "../../src/features/ingest/domain/workflow/glossary-options.js";
import { createWorkflowViewFeature } from "../../src/features/ingest/domain/workflow-view-store.js";
import {
  createWorkflowConfigPort,
  resolveMockScenario,
} from "../../src/features/ingest/domain/workflow/config-port.js";

const constants = {
  DEFAULT_MODEL_VERSION: "PP-StructureV3",
  DEFAULT_LANGUAGE: "ch",
  DEFAULT_MODE: "full",
  DEFAULT_RULE_PROFILE: "retain-layout",
  DEFAULT_RENDER_MODE: "overlay",
  DEFAULT_TYPST_FONT_FAMILY: "Noto Serif CJK SC",
  DEFAULT_PDF_COMPRESS_DPI: 0,
  DEFAULT_TRANSLATED_PDF_NAME: "translated.pdf",
  DEFAULT_BODY_FONT_SIZE_FACTOR: 1,
  DEFAULT_BODY_LEADING_FACTOR: 1,
  DEFAULT_INNER_BBOX_SHRINK_X: 0,
  DEFAULT_INNER_BBOX_SHRINK_Y: 0,
  DEFAULT_INNER_BBOX_DENSE_SHRINK_X: 0,
  DEFAULT_INNER_BBOX_DENSE_SHRINK_Y: 0,
  DEFAULT_FONT_UNIFY_MODE: "role_min",
  WORKFLOW_BOOK: "book",
  WORKFLOW_TRANSLATE: "translate",
  WORKFLOW_RENDER: "render",
  DEFAULT_WORKERS: 4,
  DEFAULT_BATCH_SIZE: 12,
  DEFAULT_CLASSIFY_BATCH_SIZE: 8,
  DEFAULT_COMPILE_WORKERS: 2,
  DEFAULT_TIMEOUT_SECONDS: 3600,
};

function developerConfig(overrides = {}) {
  return {
    workflow: "book",
    renderSourceJobId: "",
    mathMode: "direct_typst",
    model: "deepseek-chat",
    baseUrl: "https://api.deepseek.com",
    glossaryId: "glossary-saved",
    workers: 4,
    batchSize: 12,
    classifyBatchSize: 8,
    compileWorkers: 2,
    timeoutSeconds: 3600,
    translateTitles: true,
    ...overrides,
  };
}

test("buildTranslationPayload uses injected glossary and credential ref without DOM", () => {
  const payload = buildTranslationPayload({
    developerConfig: developerConfig(),
    translationCredentialRef: "cred_translation",
    selectedGlossaryId: "glossary-selected",
    constants,
  });

  assert.equal(payload.credential_ref, "cred_translation");
  assert.equal("api_key" in payload, false);
  assert.equal(payload.glossary_id, "glossary-selected");
  assert.equal(payload.model, "deepseek-chat");
  assert.equal(payload.base_url, "https://api.deepseek.com");
  assert.equal(payload.skip_title_translation, false);
});

// glossary_id 的空串是**用户的选择**：下拉里「不使用术语表」这个选项的 value
// 就是空串（TranslationOptionsPanel.tsx）。这里曾写成
// `selectedGlossaryId || developerConfig.glossaryId`，把「选了不使用」和「没设置」
// 混成一个，于是旧版开发者对话框遗留在 localStorage 的 glossaryId 会把用户刚选的
// 「不使用」顶掉。四种状态一次钉死，别再靠 `||` 兜。
test("glossary_id 直传下拉当前值：空串=用户选了「不使用术语表」，不得回退遗留值", () => {
  const cases = [
    ["选了具体术语表", "glossary-selected", "glossary-selected"],
    ["选了「不使用术语表」（下拉 value 就是空串）", "", ""],
    ["没动过下拉（调用方连字段都没给）", undefined, ""],
    ["纯空白按空串归一", "   ", ""],
  ];

  for (const [label, selectedGlossaryId, expected] of cases) {
    const payload = buildTranslationPayload({
      // 遗留值在场也不许回退——回退归 glossary-options.ts 的下拉预选逻辑管
      developerConfig: developerConfig({ glossaryId: "glossary-legacy" }),
      translationCredentialRef: "cred_translation",
      selectedGlossaryId,
      constants,
    });
    assert.equal(payload.glossary_id, expected, label);
  }
});

test("buildTranslationPayload 仍照常转发 skip_title_translation", () => {
  const payload = buildTranslationPayload({
    developerConfig: developerConfig({ translateTitles: false }),
    translationCredentialRef: "cred_translation",
    selectedGlossaryId: "",
    constants,
  });

  assert.equal(payload.skip_title_translation, true);
});

// 老用户那种状态的完整链路：localStorage 里有遗留 developerConfig.glossaryId，
// 首页启动 applyWorkflowMode() → loadGlossaryOptions() 会用它**预选下拉**，
// 于是「没动过下拉」照样发遗留值——但这次是用户在界面上看得见的那一个。
test("遗留术语表偏好经下拉预选生效；用户改选「不使用」立即盖掉它", async () => {
  const view = createWorkflowViewFeature({});
  const loader = createGlossaryOptionsLoader({
    fetchGlossaries: async () => ({ items: [{ glossary_id: "glossary-legacy", name: "旧术语表" }] }),
    apiPrefix: "/api",
    setDeveloperGlossaryOptions: view.viewPort.setDeveloperGlossaryOptions,
    setText: () => {},
    getDefaultSelectedId: () => "glossary-legacy",
  });

  const glossaryIdFor = (selectedGlossaryId) => buildTranslationPayload({
    developerConfig: developerConfig({ glossaryId: "glossary-legacy" }),
    translationCredentialRef: "cred_translation",
    selectedGlossaryId,
    constants,
  }).glossary_id;

  await loader.loadGlossaryOptions({ force: true, selectedId: "" });
  assert.equal(view.selectedGlossaryId(), "glossary-legacy", "遗留偏好应可见地预选在下拉里");
  assert.equal(glossaryIdFor(view.selectedGlossaryId()), "glossary-legacy", "没动过下拉 → 仍发遗留值");

  view.setSelectedGlossaryId("");
  assert.equal(glossaryIdFor(view.selectedGlossaryId()), "", "选了「不使用」→ 必须发空串");
});

// 同一条链路的反面：遗留 id 指向的术语表已被删除。glossary-options.ts 明确不回退
// 死 id，但 payload 层的 `||` 曾把它复活。
test("遗留术语表已被删除：下拉不预选，载荷也不复活那个死 id", async () => {
  const view = createWorkflowViewFeature({});
  const loader = createGlossaryOptionsLoader({
    fetchGlossaries: async () => ({ items: [{ glossary_id: "glossary-other", name: "别的表" }] }),
    apiPrefix: "/api",
    setDeveloperGlossaryOptions: view.viewPort.setDeveloperGlossaryOptions,
    setText: () => {},
    getDefaultSelectedId: () => "glossary-legacy",
  });

  await loader.loadGlossaryOptions({ force: true, selectedId: "" });

  assert.equal(view.selectedGlossaryId(), "", "已删除的 id 不该被预选");
  assert.equal(
    buildTranslationPayload({
      developerConfig: developerConfig({ glossaryId: "glossary-legacy" }),
      translationCredentialRef: "cred_translation",
      selectedGlossaryId: view.selectedGlossaryId(),
      constants,
    }).glossary_id,
    "",
    "载荷不得绕过 glossary-options 的已删除守卫",
  );
});

test("buildOcrPayload maps provider token field and paddle api url", () => {
  const payload = buildOcrPayload({
    pageRanges: "1-3",
    ocrProvider: "paddle",
    ocrToken: "ocr-token",
    defaultPaddleApiUrl: () => "https://paddle.example/v1",
    constants,
  });

  assert.equal(payload.provider, "paddle");
  assert.equal(payload.paddle_token, "ocr-token");
  assert.equal(payload.paddle_api_url, "https://paddle.example/v1");
  assert.equal(payload.page_ranges, "1-3");
});

test("buildOcrPayload prefers the locally edited token over a legacy credential ref", () => {
  const payload = buildOcrPayload({
    pageRanges: "1-3",
    ocrProvider: "paddle",
    ocrCredentialRef: "cred_ocr",
    ocrToken: "local-token",
    defaultPaddleApiUrl: () => "https://paddle.example/v1",
    constants,
  });

  assert.equal(payload.credential_ref, "");
  assert.equal(payload.paddle_token, "local-token");
});

test("buildOcrPayload retains legacy reference-only configuration", () => {
  const payload = buildOcrPayload({ ocrProvider: "paddle", ocrCredentialRef: "cred_ocr", defaultPaddleApiUrl: () => "", constants });
  assert.equal(payload.credential_ref, "cred_ocr");
  assert.equal("paddle_token" in payload, false);
});

test("buildSourcePayload and buildRenderPayload preserve render-only inputs", () => {
  const source = buildSourcePayload({
    workflow: "render",
    developerConfig: developerConfig({ renderSourceJobId: "job-source" }),
    uploadId: "upload-id",
    workflowNeedsUpload: (workflow) => workflow !== constants.WORKFLOW_RENDER,
  });
  const render = buildRenderPayload({
    developerConfig: developerConfig({ compileWorkers: 6 }),
    constants,
  });

  assert.deepEqual(source, { artifact_job_id: "job-source" });
  assert.equal(render.compile_workers, 6);
  assert.equal(render.font_unify_mode, "role_min");
});

test("workflow config port owns mock mode and scenario", () => {
  assert.equal(resolveMockScenario({ search: "?mock=render" }), "render");
  assert.equal(resolveMockScenario({ search: "" }), "running");

  const port = createWorkflowConfigPort({
    isMock: () => true,
    search: () => "?mock=queued",
  });
  assert.equal(port.isMock(), true);
  assert.equal(port.mockScenario(), "queued");
});

function mountWorkflowHarness({
  developerConfig: savedDeveloperConfig,
  uploadState = { uploadId: "upload-1", uploadedPageCount: 12 },
  pageRanges = "2-4",
  viewPort,
  submitValues = {
    ocrProvider: "paddle",
    ocrCredentialRef: "cred_ocr",
    ocrToken: "ocr-token",
    translationCredentialRef: "cred_translation",
    selectedGlossaryId: "glossary-selected",
  },
} = {}) {
  const options = {
    configPort: createWorkflowConfigPort({
      isMock: () => false,
      search: () => "",
    }),
    saveDeveloperStoredConfig: async () => {},
    getDeepSeekBalanceState: () => ({ balanceCny: 100, balanceChecked: true }),
    getDeveloperConfig: () => savedDeveloperConfig,
    getUploadState: () => uploadState,
    isDesktopMode: () => false,
    resetDeveloperConfig: () => {},
    setDeveloperConfig: () => {},
    defaultModelName: () => "deepseek-chat",
    defaultModelBaseUrl: () => "https://api.deepseek.com",
    defaultPaddleApiUrl: () => "https://paddle.example/v1",
    defaultPaddleToken: () => "paddle-default",
    defaultOcrProvider: () => "paddle",
    defaultModelApiKey: () => "model-default",
    defaultFileLabel: "选择 PDF",
    normalizeWorkflow: (value) => value || "book",
    normalizeMathMode: (value) => value || "direct_typst",
    constants,
    currentPageRanges: () => pageRanges,
    renderPageRangeSummary: () => {},
    hasBrowserCredentials: () => true,
    updateCredentialGate: () => {},
    fetchGlossaries: async () => ({ items: [] }),
    apiPrefix: "/api",
    setText: () => {},
  };
  // controller.js 不再自带默认 viewPort(旧 DOM 直写实现已随 cutover 删除),
  // 未显式传 viewPort 的用例用最小 no-op stub 桥接(只关心 collectRunPayload
  // 等纯逻辑返回值,不断言这些 UI 副作用调用)。
  options.viewPort = viewPort || {
    applyMockUpload: () => {},
    applyWorkflowUpload: () => {},
    closeDeveloperDialog: () => {},
    readDeveloperDialog: () => ({}),
    readDeveloperWorkflow: () => "book",
    readSubmitValues: () => submitValues || {},
    renderBudgetNote: () => {},
    setDeveloperDialog: () => {},
    setDeveloperGlossaryOptions: () => {},
    setDeveloperWorkflowFormState: () => {},
    setSubmitControls: () => {},
  };
  if (submitValues !== null) {
    options.readSubmitValues = () => submitValues;
  }
  return mountWorkflowFeature(options);
}

test("collectRunPayload builds book submit payload from resolved workflow inputs", () => {
  const feature = mountWorkflowHarness({
    developerConfig: developerConfig({
      workflow: "book",
      timeoutSeconds: 1800,
      compileWorkers: 5,
    }),
  });

  const payload = feature.collectRunPayload();

  assert.equal(payload.workflow, "book");
  assert.deepEqual(payload.source, { upload_id: "upload-1" });
  assert.equal(payload.runtime.timeout_seconds, 1800);
  assert.equal(payload.ocr.provider, "paddle");
  assert.equal(payload.ocr.credential_ref, "");
  assert.equal(payload.ocr.paddle_token, "ocr-token");
  assert.equal(payload.ocr.page_ranges, "2-4");
  assert.equal(payload.translation.credential_ref, "cred_translation");
  assert.equal("api_key" in payload.translation, false);
  assert.equal(payload.translation.glossary_id, "glossary-selected");
  assert.equal(payload.render.compile_workers, 5);
});

test("collectRunPayload builds render-only payload from artifact source", () => {
  const feature = mountWorkflowHarness({
    developerConfig: developerConfig({
      workflow: "render",
      renderSourceJobId: "job-source",
      compileWorkers: 7,
    }),
    uploadState: { uploadId: "", uploadedPageCount: 0 },
  });

  const payload = feature.collectRunPayload();

  assert.equal(payload.workflow, "render");
  assert.deepEqual(payload.source, { artifact_job_id: "job-source" });
  assert.equal(payload.runtime.timeout_seconds, 3600);
  assert.equal(payload.ocr, undefined);
  assert.equal(payload.translation, undefined);
  assert.equal(payload.render.compile_workers, 7);
});

test("workflow controller routes UI side effects through view port", async () => {
  const calls = [];
  const viewPort = {
    applyMockUpload: () => calls.push(["mock-upload"]),
    applyWorkflowUpload: (payload) => calls.push(["workflow-upload", payload.headline, payload.defaultFileLabel]),
    closeDeveloperDialog: () => calls.push(["close-dialog"]),
    readDeveloperDialog: () => developerConfig({
      workflow: "book",
      glossaryId: "glossary-dialog",
    }),
    readDeveloperWorkflow: () => "book",
    readSubmitValues: () => ({
      ocrProvider: "paddle",
      ocrToken: "ocr-token",
      translationCredentialRef: "cred_translation",
      selectedGlossaryId: "glossary-selected",
    }),
    renderBudgetNote: (budget) => calls.push(["budget", budget.visible]),
    setDeveloperDialog: (config) => calls.push(["developer-dialog", config.workflow]),
    setDeveloperGlossaryOptions: (items, selectedId) => calls.push(["glossaries", items.length, selectedId]),
    setDeveloperWorkflowFormState: (payload) => calls.push(["workflow-form", payload.workflow]),
    setSubmitControls: (payload) => calls.push(["submit", payload.label]),
  };
  let savedConfig = developerConfig({ workflow: "book" });
  const feature = mountWorkflowHarness({
    developerConfig: savedConfig,
    submitValues: null,
  });
  const injected = mountWorkflowFeature({
    configPort: createWorkflowConfigPort({
      isMock: () => false,
      search: () => "",
    }),
    saveDeveloperStoredConfig: async () => {},
    getDeepSeekBalanceState: () => ({ balanceCny: 100, balanceChecked: true }),
    getDeveloperConfig: () => savedConfig,
    getUploadState: () => ({ uploadId: "upload-1", uploadedPageCount: 12 }),
    isDesktopMode: () => false,
    resetDeveloperConfig: () => {},
    setDeveloperConfig: (next) => {
      savedConfig = next;
    },
    defaultModelName: () => "deepseek-chat",
    defaultModelBaseUrl: () => "https://api.deepseek.com",
    defaultPaddleApiUrl: () => "https://paddle.example/v1",
    defaultPaddleToken: () => "paddle-default",
    defaultOcrProvider: () => "paddle",
    defaultModelApiKey: () => "model-default",
    defaultFileLabel: "自定义上传标签",
    normalizeWorkflow: (value) => value || "book",
    normalizeMathMode: (value) => value || "direct_typst",
    constants,
    currentPageRanges: () => "1-3",
    renderPageRangeSummary: () => calls.push(["page-range"]),
    hasBrowserCredentials: () => true,
    updateCredentialGate: () => calls.push(["credential-gate"]),
    fetchGlossaries: async () => ({ items: [{ glossary_id: "glossary-1", name: "Terms" }] }),
    apiPrefix: "/api",
    setText: () => {},
    viewPort,
  });

  injected.syncDeveloperDialogFromState();
  injected.applyWorkflowMode();
  injected.refreshSubmitControls();
  injected.saveDeveloperDialog();
  await injected.loadGlossaryOptions({ force: true, selectedId: "glossary-1" });

  assert.equal(feature.currentWorkflow(), "book");
  assert.equal(calls.some(([kind]) => kind === "workflow-upload"), true);
  assert.equal(calls.some(([kind, , label]) => kind === "workflow-upload" && label === "自定义上传标签"), true);
  assert.equal(calls.some(([kind]) => kind === "submit"), true);
  assert.equal(calls.some(([kind]) => kind === "budget"), true);
  assert.equal(calls.some(([kind]) => kind === "developer-dialog"), true);
  assert.equal(calls.some(([kind]) => kind === "close-dialog"), true);
  assert.equal(calls.some(([kind, count]) => kind === "glossaries" && count === 1), true);
});
