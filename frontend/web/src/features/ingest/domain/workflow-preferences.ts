// 「添加 PDF」弹窗里用户的长期偏好：一张定义表，每个选项一行（本机存储的键 + 取值校验）。
//
// 加一个选项只动三处：这张表加一行、TranslationOptionsPanel 加一个下拉、
// workflow/payload.ts 把它映射成后端字段。store、提交流程、应用层都是按整张表搬运的，
// 不用跟着改。（以前加一个「排版引擎」下拉要改 9 个文件。）
//
// 选了「统一术语」的人通常每本都要，所以记在本机；读写 localStorage 失败（隐私模式等）
// 就退回默认值，不影响提交，本次会话里照样生效（值同时在 store 里）。

/**
 * 翻译质量档位（背后映射到 translation.preparation 等字段，见 workflow/payload.ts 的
 * translationQualityFields）：
 * - standard：直接翻译，和以前完全一样；
 * - terms：先通读全书生成术语表和风格指南，再带着它们翻译（preparation=terms+style）；
 * - refined：编辑部——术语表经术语专员审定；翻译完由审校挑错、主编分派局部改或整块重写，
 *   最多两轮，改不好的保留原译并列出来（preparation=editorial、refine=editorial）。
 */
export type TranslationQuality = "standard" | "terms" | "refined";

export function normalizeTranslationQuality(value: unknown): TranslationQuality {
  return value === "terms" || value === "refined" ? value : "standard";
}

/**
 * 排版引擎（render.engine）。auto 一个字段都不发，由后端按当前默认挑；
 * rpr_fit = 自研引擎、字号由引擎量着定；typst = 原来的 Typst 路线。
 * 后端还有一档 rpr（引擎排版、字号沿用旧规则），只用于对比，界面不放。
 */
export type RenderEngine = "auto" | "rpr_fit" | "typst";

export function normalizeRenderEngine(value: unknown): RenderEngine {
  return value === "rpr_fit" || value === "typst" ? value : "auto";
}

const WORKFLOW_PREFERENCE_SPECS = {
  translationQuality: { storageKey: "retainpdf.translationQuality", normalize: normalizeTranslationQuality },
  renderEngine: { storageKey: "retainpdf.renderEngine", normalize: normalizeRenderEngine },
} as const satisfies Record<string, { storageKey: string; normalize: (value: unknown) => string }>;

type Specs = typeof WORKFLOW_PREFERENCE_SPECS;
export type WorkflowPreferenceKey = keyof Specs;
export type WorkflowPreferences = { [K in WorkflowPreferenceKey]: ReturnType<Specs[K]["normalize"]> };

const PREFERENCE_KEYS = Object.keys(WORKFLOW_PREFERENCE_SPECS) as WorkflowPreferenceKey[];

export function isWorkflowPreferenceKey(key: unknown): key is WorkflowPreferenceKey {
  return typeof key === "string" && Object.hasOwn(WORKFLOW_PREFERENCE_SPECS, key);
}

export function normalizeWorkflowPreference<K extends WorkflowPreferenceKey>(key: K, value: unknown): WorkflowPreferences[K] {
  return WORKFLOW_PREFERENCE_SPECS[key].normalize(value) as WorkflowPreferences[K];
}

function readStored(key: WorkflowPreferenceKey): unknown {
  try {
    if (typeof localStorage !== "undefined") return localStorage.getItem(WORKFLOW_PREFERENCE_SPECS[key].storageKey);
  } catch {}
  return null;
}

export function loadWorkflowPreferences(): WorkflowPreferences {
  return Object.fromEntries(
    PREFERENCE_KEYS.map((key) => [key, normalizeWorkflowPreference(key, readStored(key))]),
  ) as WorkflowPreferences;
}

export function saveWorkflowPreference(key: WorkflowPreferenceKey, value: string) {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(WORKFLOW_PREFERENCE_SPECS[key].storageKey, value);
  } catch {}
}
