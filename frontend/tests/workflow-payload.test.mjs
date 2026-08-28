import test from "node:test";
import assert from "node:assert/strict";

import {
  buildOcrPayload,
  buildRenderPayload,
  buildSourcePayload,
  buildTranslationPayload,
} from "../src/js/features/workflow/payload.js";
import { mountWorkflowFeature } from "../src/js/features/workflow/controller.js";
import {
  createWorkflowConfigPort,
  resolveMockScenario,
} from "../src/js/features/workflow/config-port.js";

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

test("buildTranslationPayload uses injected glossary and model key without DOM", () => {
  const payload = buildTranslationPayload({
    developerConfig: developerConfig(),
    modelApiKey: "model-key",
    selectedGlossaryId: "glossary-selected",
    constants,
  });

  assert.equal(payload.api_key, "model-key");
  assert.equal(payload.glossary_id, "glossary-selected");
  assert.equal(payload.model, "deepseek-chat");
  assert.equal(payload.base_url, "https://api.deepseek.com");
  assert.equal(payload.skip_title_translation, false);
});

test("buildTranslationPayload falls back to developer glossary id", () => {
  const payload = buildTranslationPayload({
    developerConfig: developerConfig({ glossaryId: "glossary-fallback", translateTitles: false }),
    modelApiKey: "model-key",
    selectedGlossaryId: "",
    constants,
  });

  assert.equal(payload.glossary_id, "glossary-fallback");
  assert.equal(payload.skip_title_translation, true);
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
    ocrToken: "ocr-token",
    modelApiKey: "model-key",
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
  // controller.js không còn viewPort mặc định (triển khai ghi DOM cũ đã bị xóa trong cutover),
  // các trường hợp không truyền viewPort rõ ràng sẽ dùng stub no-op tối thiểu để kết nối (chỉ quan tâm
  // giá trị trả về logic thuần như collectRunPayload, không xác nhận các tác dụng phụ UI này).
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
  assert.equal(payload.ocr.paddle_token, "ocr-token");
  assert.equal(payload.ocr.page_ranges, "2-4");
  assert.equal(payload.translation.api_key, "model-key");
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
      modelApiKey: "model-key",
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
