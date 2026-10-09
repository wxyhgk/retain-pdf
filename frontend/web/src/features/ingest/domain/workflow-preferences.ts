// 上传弹窗里用户的长期偏好（翻译质量、排版引擎）：取值规范化 + 本机存取。
// 读写 localStorage 失败（隐私模式等）一律退回默认，不影响提交。

/**
 * 翻译质量档位（用户可见的一个下拉，背后映射到 translation.preparation 等字段，见
 * workflow/payload.ts 的 translationQualityFields）：
 * - standard：直接翻译，和以前完全一样；
 * - terms：先通读全书生成术语表和风格指南，再带着它们翻译（preparation=terms+style）；
 * - refined：在 terms 基础上，翻译完再让模型挑错、只改有问题的片段（refine=review_and_fix）。
 */
export type TranslationQuality = "standard" | "terms" | "refined";
export const TRANSLATION_QUALITY_STORAGE_KEY = "retainpdf.translationQuality";

export function normalizeTranslationQuality(value: unknown): TranslationQuality {
  return value === "terms" || value === "refined" ? value : "standard";
}

// 档位是用户的长期偏好（选了「统一术语」的人通常每本都要），所以记在本机；
// 读写失败（隐私模式等）就退回 standard，不影响提交。
export function loadTranslationQuality(): TranslationQuality {
  try {
    if (typeof localStorage !== "undefined") {
      return normalizeTranslationQuality(localStorage.getItem(TRANSLATION_QUALITY_STORAGE_KEY));
    }
  } catch {}
  return "standard";
}

export function saveTranslationQuality(value: TranslationQuality) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(TRANSLATION_QUALITY_STORAGE_KEY, value);
    }
  } catch {}
}

/**
 * 排版引擎（render.engine）。auto 一个字段都不发，由后端按当前默认挑；
 * rpr_fit = 自研引擎、字号由引擎量着定；typst = 原来的 Typst 路线。
 * 后端还有一档 rpr（引擎排版、字号沿用旧规则），只用于对比，界面不放。
 */
export type RenderEngine = "auto" | "rpr_fit" | "typst";
export const RENDER_ENGINE_STORAGE_KEY = "retainpdf.renderEngine";

export function normalizeRenderEngine(value: unknown): RenderEngine {
  return value === "rpr_fit" || value === "typst" ? value : "auto";
}

export function loadRenderEngine(): RenderEngine {
  try {
    if (typeof localStorage !== "undefined") {
      return normalizeRenderEngine(localStorage.getItem(RENDER_ENGINE_STORAGE_KEY));
    }
  } catch {}
  return "auto";
}

export function saveRenderEngine(value: RenderEngine) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(RENDER_ENGINE_STORAGE_KEY, value);
    }
  } catch {}
}
