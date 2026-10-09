import type {
  JobSourceInput,
  RenderInput,
  TranslationInput,
} from "@retainpdf/contracts/create-job";
import type { WorkflowPreferences } from "../workflow-preferences.js";

import { getOcrProviderDefinition, normalizeOcrProvider } from "@/platform/config/providers.js";
import { RENDER_FONT_STORAGE_KEY } from "@/platform/config/storage-keys.js";

/** Developer/workflow config fields consumed by payload builders. */
export interface WorkflowDeveloperConfig {
  workflow?: string;
  renderSourceJobId?: string;
  // 值域由后端 TRANSLATION_MATH_MODES 封闭（填错会被 400 拒），上游 normalizeMathMode()
  // 已经归一到这两个值，这里跟着契约类型走，免得在 payload 构造处再 as 一次。
  mathMode?: TranslationInput["math_mode"];
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
  /** 用户偏好（workflow-preferences.ts）。这里用 translationQuality；缺省按 standard。 */
  preferences?: Partial<WorkflowPreferences>;
  constants: WorkflowPayloadConstants;
}

export interface BuildRenderPayloadOptions {
  developerConfig: Pick<WorkflowDeveloperConfig, "compileWorkers"> | WorkflowDeveloperConfig;
  /** 用户偏好（workflow-preferences.ts）。这里用 renderEngine；缺省 / auto 不发 engine。 */
  preferences?: Partial<WorkflowPreferences>;
  constants: WorkflowPayloadConstants;
}

export function buildSourcePayload({
  workflow,
  developerConfig,
  uploadId,
  workflowNeedsUpload,
}: BuildSourcePayloadOptions): JobSourceInput {
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

// 返回值标注成契约生成的 TranslationInput（create-job.v1.schema.json →
// contracts/src/create-job.ts）。后端是 #[serde(deny_unknown_fields)]：写错一个
// 字段名以前要等真提一次任务才被 400 挡下，现在 tsc 直接报错。
export function buildTranslationPayload({
  developerConfig,
  translationCredentialRef,
  modelApiKey,
  selectedGlossaryId,
  preferences,
  constants,
}: BuildTranslationPayloadOptions): TranslationInput {
  return {
    ...translationQualityFields(preferences?.translationQuality),
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

/**
 * 下拉档位 → 后端字段。standard 一个字段都不加：后端缺省就是 preparation=off，
 * 这样「普通」档发出去的请求和以前逐字相同。
 */
export function translationQualityFields(quality: unknown): Pick<TranslationInput, "preparation" | "refine"> {
  if (quality === "terms") return { preparation: "terms+style" };
  if (quality === "refined") return { preparation: "terms+style", refine: "review_and_fix" };
  return {};
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

/** 下拉 → render.engine。auto 不发字段，跟着后端默认走。 */
export function renderEngineFields(engine: unknown): Pick<RenderInput, "engine"> {
  return engine === "rpr_fit" || engine === "typst" ? { engine } : {};
}

export function buildRenderPayload({
  developerConfig,
  preferences,
  constants,
}: BuildRenderPayloadOptions): RenderInput {
  const cfg = developerConfig as WorkflowDeveloperConfig;
  const cfgFont = `${(cfg.typstFontFamily as string) || (cfg.typst_font_family as string) || ""}`.trim();
  const storedFont = resolveStoredFontFamily(constants.DEFAULT_TYPST_FONT_FAMILY);
  const typstFont = cfgFont || storedFont || `${constants.DEFAULT_TYPST_FONT_FAMILY || ""}`.trim() || "Source Han Serif SC";
  return {
    ...renderEngineFields(preferences?.renderEngine),
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
