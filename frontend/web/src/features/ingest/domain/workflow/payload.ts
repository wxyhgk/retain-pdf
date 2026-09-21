import { getOcrProviderDefinition, normalizeOcrProvider } from "@/platform/config/providers.js";
import { RENDER_FONT_STORAGE_KEY } from "@/platform/config/storage-keys.js";

/** Developer/workflow config fields consumed by payload builders. */
export interface WorkflowDeveloperConfig {
  workflow?: string;
  renderSourceJobId?: string;
  mathMode?: string;
  model?: string;
  baseUrl?: string;
  glossaryId?: string;
  workers?: number;
  batchSize?: number;
  classifyBatchSize?: number;
  compileWorkers?: number;
  timeoutSeconds?: number;
  translateTitles?: boolean;
  typstFontFamily?: string;
  typst_font_family?: string;
  [key: string]: unknown;
}

/** Constant bag used when assembling OCR / translation / render payloads. */
export interface WorkflowPayloadConstants {
  DEFAULT_MODEL_VERSION?: string;
  DEFAULT_LANGUAGE?: string;
  DEFAULT_MODE?: string;
  DEFAULT_RULE_PROFILE?: string;
  DEFAULT_RENDER_MODE?: string;
  DEFAULT_TYPST_FONT_FAMILY?: string;
  DEFAULT_PDF_COMPRESS_DPI?: number;
  DEFAULT_TRANSLATED_PDF_NAME?: string;
  DEFAULT_BODY_FONT_SIZE_FACTOR?: number;
  DEFAULT_BODY_LEADING_FACTOR?: number;
  DEFAULT_INNER_BBOX_SHRINK_X?: number;
  DEFAULT_INNER_BBOX_SHRINK_Y?: number;
  DEFAULT_INNER_BBOX_DENSE_SHRINK_X?: number;
  DEFAULT_INNER_BBOX_DENSE_SHRINK_Y?: number;
  DEFAULT_FONT_UNIFY_MODE?: string;
  [key: string]: unknown;
}

export interface BuildSourcePayloadOptions {
  workflow: string;
  developerConfig: Pick<WorkflowDeveloperConfig, "renderSourceJobId"> | WorkflowDeveloperConfig;
  uploadId?: string;
  workflowNeedsUpload: (workflow?: string) => boolean;
}

export interface BuildOcrPayloadOptions {
  pageRanges?: string;
  ocrProvider?: string;
  ocrCredentialRef?: string;
  ocrToken?: string;
  defaultPaddleApiUrl: () => string;
  constants: WorkflowPayloadConstants;
}

export interface BuildTranslationPayloadOptions {
  developerConfig: WorkflowDeveloperConfig;
  modelApiKey?: string;
  translationCredentialRef?: string;
  selectedGlossaryId?: string;
  constants: WorkflowPayloadConstants;
}

export interface BuildRenderPayloadOptions {
  developerConfig: Pick<WorkflowDeveloperConfig, "compileWorkers"> | WorkflowDeveloperConfig;
  constants: WorkflowPayloadConstants;
}

export function buildSourcePayload({
  workflow,
  developerConfig,
  uploadId,
  workflowNeedsUpload,
}: BuildSourcePayloadOptions) {
  return workflowNeedsUpload(workflow)
    ? { upload_id: uploadId }
    : { artifact_job_id: developerConfig.renderSourceJobId };
}

export function buildOcrPayload({
  pageRanges,
  ocrProvider,
  ocrCredentialRef,
  ocrToken,
  defaultPaddleApiUrl,
  constants,
}: BuildOcrPayloadOptions) {
  const provider = normalizeOcrProvider(ocrProvider);
  const definition = getOcrProviderDefinition(provider);
  const payload: Record<string, unknown> = {
    provider,
    credential_ref: ocrToken ? "" : `${ocrCredentialRef || ""}`.trim(),
    model_version: constants.DEFAULT_MODEL_VERSION,
    language: constants.DEFAULT_LANGUAGE,
    page_ranges: pageRanges,
  };
  if (!payload.credential_ref) {
    payload[definition.tokenField] = ocrToken || "";
  }
  if (definition.id === "paddle") {
    payload.paddle_api_url = defaultPaddleApiUrl() || "https://paddleocr.aistudio-app.com";
  }
  return payload;
}

export function buildTranslationPayload({
  developerConfig,
  translationCredentialRef,
  modelApiKey,
  selectedGlossaryId,
  constants,
}: BuildTranslationPayloadOptions) {
  return {
    mode: constants.DEFAULT_MODE,
    math_mode: developerConfig.mathMode,
    model: developerConfig.model,
    base_url: developerConfig.baseUrl,
    ...(modelApiKey?.trim()
      ? { api_key: modelApiKey.trim() }
      : { credential_ref: `${translationCredentialRef || ""}`.trim() }),
    workers: developerConfig.workers,
    batch_size: developerConfig.batchSize,
    classify_batch_size: developerConfig.classifyBatchSize,
    rule_profile_name: constants.DEFAULT_RULE_PROFILE,
    custom_rules_text: "",
    // 下拉里「不使用术语表」这个选项的 value 就是空串，所以空串是**用户的选择**，
    // 不是「没设置过」。这里原本写 `selectedGlossaryId || developerConfig.glossaryId`，
    // 把两种含义混成一个，造成两个真实缺陷：
    //   1. 用户选了「不使用」，却被旧版开发者对话框遗留在 localStorage 的
    //      developerConfig.glossaryId 顶掉，界面上还看不出来；
    //   2. 那个遗留 id 指向的术语表哪怕已被删除，也照样发出去——直接绕过
    //      glossary-options.ts 里「已删除术语表的残留 id 不再回退」的守卫。
    // 「沿用老用户遗留偏好」不归这一层管：glossary-options.ts 拉到术语表列表时
    // 已经用 developerConfig.glossaryId 预选下拉（且只在该 id 仍存在时才预选），
    // 首页 applyWorkflowMode() 启动即跑。这里只忠实转发下拉当前值——下拉显示
    // 什么就发什么。
    glossary_id: `${selectedGlossaryId || ""}`.trim(),
    glossary_entries: [],
    skip_title_translation: !developerConfig.translateTitles,
  };
}

function resolveStoredFontFamily(fallback: unknown): string {
  const fb = `${fallback || ""}`.trim();
  const fromConfig = "";
  void fromConfig;
  try {
    if (typeof localStorage !== "undefined") {
      const stored = `${localStorage.getItem(RENDER_FONT_STORAGE_KEY) || ""}`.trim();
      if (stored) return stored;
    }
  } catch {}
  return fb;
}

export function buildRenderPayload({ developerConfig, constants }: BuildRenderPayloadOptions) {
  const cfg = developerConfig as WorkflowDeveloperConfig;
  const cfgFont = `${(cfg.typstFontFamily as string) || (cfg.typst_font_family as string) || ""}`.trim();
  const storedFont = resolveStoredFontFamily(constants.DEFAULT_TYPST_FONT_FAMILY);
  const typstFont = cfgFont || storedFont || `${constants.DEFAULT_TYPST_FONT_FAMILY || ""}`.trim() || "Source Han Serif SC";
  return {
    render_mode: constants.DEFAULT_RENDER_MODE,
    compile_workers: developerConfig.compileWorkers,
    typst_font_family: typstFont,
    pdf_compress_dpi: constants.DEFAULT_PDF_COMPRESS_DPI,
    translated_pdf_name: constants.DEFAULT_TRANSLATED_PDF_NAME,
    body_font_size_factor: constants.DEFAULT_BODY_FONT_SIZE_FACTOR,
    body_leading_factor: constants.DEFAULT_BODY_LEADING_FACTOR,
    inner_bbox_shrink_x: constants.DEFAULT_INNER_BBOX_SHRINK_X,
    inner_bbox_shrink_y: constants.DEFAULT_INNER_BBOX_SHRINK_Y,
    inner_bbox_dense_shrink_x: constants.DEFAULT_INNER_BBOX_DENSE_SHRINK_X,
    inner_bbox_dense_shrink_y: constants.DEFAULT_INNER_BBOX_DENSE_SHRINK_Y,
    font_unify_mode: constants.DEFAULT_FONT_UNIFY_MODE,
  };
}
