// 译文栏用 HTML 画（2026-11-28 用户：「我们只需要加载一个 pdf 了」，方案 docs/ops/planning/reader-redesign/20261128-阅读页只加载原文PDF.md）：
// 打开书时先要排版引擎的版面清单（小 JSON，和原文 PDF 一起发），版面完整就不下载译文 PDF——译文栏用原文 PDF 加版面画，
// 和译文 PDF 一样（字是系统画的真文字，pdf/LayoutPageLayer.tsx）。
// 完整：清单 available、features 有 erase（要抹掉的原字写明了，不用底图）和 tables（表格也是译文），主字体每个字重都装上了。
// 不完整（Typst 路线、以前存的版面、后端还在补、字体没装上、清单 3 秒没回来）照旧下载译文 PDF。
// 阅读页地址带 ?translated=pdf 照旧用译文 PDF（对着看、出了问题退回去）。
import { installRenderLayoutFonts, readRenderLayoutPort, renderLayoutFontFamily } from "../use-render-layout.js";
import { loadRenderLayoutFromApi, type RenderLayoutSource } from "../../shared/data/render-layout.js";

export type TranslatedLayout = { source: RenderLayoutSource; fontFamily: string };

/** 清单加字体最多等这么久，过了照旧下载译文 PDF。 */
export const TRANSLATED_LAYOUT_WAIT_MS = 3000;
/** 版面要带这几项，译文栏才能不要译文 PDF。 */
export const TRANSLATED_LAYOUT_FEATURES = ["erase", "tables"] as const;

export function translatedPdfForced(search = globalThis.location?.search || ""): boolean {
  try {
    return new URLSearchParams(search).get("translated") === "pdf";
  } catch {
    return false;
  }
}

/** 版面完整（不用底图、表格也在）才能替掉译文 PDF。 */
export function layoutReplacesTranslatedPdf(source: RenderLayoutSource | null): source is RenderLayoutSource {
  return Boolean(source && source.fonts.length && TRANSLATED_LAYOUT_FEATURES.every((feature) => source.features.has(feature)));
}

/** 要清单、装字体；能替掉译文 PDF 就回版面，不然（或超时、出错）回 null。不抛错。 */
export async function probeTranslatedLayout(
  jobId: string,
  { signal, waitMs = TRANSLATED_LAYOUT_WAIT_MS }: { signal?: AbortSignal; waitMs?: number } = {},
): Promise<TranslatedLayout | null> {
  const port = readRenderLayoutPort();
  if (!jobId || !port || translatedPdfForced()) return null;
  const probe = (async () => {
    const manifest = await loadRenderLayoutFromApi(jobId, { apiPrefix: port.apiPrefix || "/api/v1", fetcher: port.fetchProtected });
    const source = manifest.source;
    if (!layoutReplacesTranslatedPdf(source) || signal?.aborted) return null;
    const ok = await installRenderLayoutFonts(source.fonts, (font) => source.loadFont(font));
    return ok ? { source, fontFamily: renderLayoutFontFamily(source.fonts) } : null;
  })().catch((error) => {
    console.warn("[translated-layout] 版面没要到，译文栏照旧用译文 PDF：", error);
    return null;
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), waitMs);
  });
  try {
    return await Promise.race([probe, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
