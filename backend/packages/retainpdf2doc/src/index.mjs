/**
 * retainpdf2doc —— RetainPDF 排版规格 → 保留排版的 Word 文档。
 *
 * 缝在哪:排版规格由 Python 侧的 `retainpdf_pipeline` 算（`build_render_page_specs`
 * 那套逻辑搬不动也不该搬），这个包只负责把规格变成 .docx。规格的形状见 `spec.mjs`。
 *
 * 为什么要有这个包（而不是继续用 Python 的 python-docx 版）:公式。旧版手写的
 * LaTeX→OMML 转换器有一张 47 条的符号表，实测全仓 32.3% 的公式会把命令名当字母印出来
 * （`\mathbf{2a}` → `mathbf2a`）。这边走 MathJax → MathML → OMML，没有这个问题。
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createDocxTheme } from "../vendor/visualtex/office/docx/config/index.ts";
import { prepareEmbeddedFont } from "../vendor/visualtex/office/docx/fonts/fontEmbedding.ts";
import { deterministicEmbeddedFontKey } from "../vendor/visualtex/office/nodeFontKey.ts";
import { buildDocxPackage } from "../vendor/visualtex/office/docx/package/packageParts.ts";
import { validateDocxPackage } from "../vendor/visualtex/office/docx/package/validatePackage.ts";
import { buildBody } from "./body.mjs";
import { FORMULA_FONT_NAME } from "./formula.mjs";
import { parseSpec } from "./spec.mjs";

const IMAGE_CONTENT_TYPES = new Map([
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
]);

const TWIPS_PER_POINT = 20;

// 字体随包一起走（GUST 协议允许再分发，见 assets/fonts/）。esbuild 打包之后
// import.meta.url 指向 dist/，所以要从包根往回找。
const PACKAGE_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FORMULA_FONT_PATH = path.join(PACKAGE_ROOT, "assets", "fonts", "latinmodern-math.otf");

/**
 * 数学字体嵌进文档，而不是只写个名字。
 *
 * 只写名字的话，目标机器没装这个字体时 Word 会拿别的字体替换，而普通字体没有数学
 * 字形——积分号、求和号、可伸缩括号会变成豆腐块。嵌入之后跟装没装无关。
 *
 * 读不到字体就退回「只声明名字」:少一份保障，但不该因此导不出文档。
 */
async function loadFormulaFont() {
  try {
    const bytes = new Uint8Array(await readFile(FORMULA_FONT_PATH));
    return prepareEmbeddedFont({
      fontName: FORMULA_FONT_NAME,
      fontBytes: bytes,
      fontKey: deterministicEmbeddedFontKey(bytes),
    });
  } catch {
    return undefined;
  }
}

async function loadBackgrounds(spec, baseDir) {
  const media = [];
  const byPageIndex = new Map();
  for (const page of spec.pages) {
    if (!page.background) continue;
    const absolute = path.resolve(baseDir, page.background.path);
    const extension = path.extname(absolute).toLowerCase();
    const contentType = IMAGE_CONTENT_TYPES.get(extension);
    if (!contentType) {
      throw new Error(`第 ${page.pageIndex + 1} 页的背景图格式不支持：${extension || "(无扩展名)"}（只收 png/jpg）`);
    }
    let bytes;
    try {
      bytes = new Uint8Array(await readFile(absolute));
    } catch (cause) {
      throw new Error(`第 ${page.pageIndex + 1} 页的背景图读不到：${absolute}`, { cause });
    }
    const entry = {
      relationshipId: `rIdBg${page.pageIndex}`,
      fileName: `page-${String(page.pageIndex + 1).padStart(4, "0")}${extension === ".jpeg" ? ".jpg" : extension}`,
      contentType,
      bytes,
    };
    media.push(entry);
    byPageIndex.set(page.pageIndex, entry);
  }
  return { media, byPageIndex };
}

/** 水印图（整份文档一张，每页引用同一个关系）。规格里没有水印就是 null。 */
async function loadWatermark(spec, baseDir) {
  if (!spec.watermark) return null;
  const absolute = path.resolve(baseDir, spec.watermark.path);
  const extension = path.extname(absolute).toLowerCase();
  const contentType = IMAGE_CONTENT_TYPES.get(extension);
  if (!contentType) throw new Error(`水印图格式不支持：${extension || "(无扩展名)"}（只收 png/jpg）`);
  let bytes;
  try {
    bytes = new Uint8Array(await readFile(absolute));
  } catch (cause) {
    throw new Error(`水印图读不到：${absolute}`, { cause });
  }
  return { relationshipId: "rIdWatermark", fileName: `watermark${extension === ".jpeg" ? ".jpg" : extension}`, contentType, bytes };
}

/**
 * @param {object} rawSpec 规格对象（见 spec.mjs）
 * @param {object} options
 * @param {string} options.baseDir 背景图相对路径的基准目录
 */
export async function buildLayoutDocx(rawSpec, { baseDir = process.cwd() } = {}) {
  const spec = parseSpec(rawSpec);
  const { media, byPageIndex } = await loadBackgrounds(spec, baseDir);
  const watermark = await loadWatermark(spec, baseDir);
  if (watermark) media.push(watermark);
  const { body, errors, textboxCount, formulaCount } = buildBody(spec, byPageIndex, watermark);

  // 主题只用来定最后一页的 sectPr 和基础样式。页面尺寸取最后一页——前面每一页的
  // 尺寸由 body 里各自的分节符给出（源 PDF 各页尺寸可以不同）。
  const lastPage = spec.pages[spec.pages.length - 1];
  const theme = createDocxTheme({
    page: {
      widthTwips: Math.round(lastPage.widthPt * TWIPS_PER_POINT),
      heightTwips: Math.round(lastPage.heightPt * TWIPS_PER_POINT),
      marginTopTwips: 0,
      marginRightTwips: 0,
      marginBottomTwips: 0,
      marginLeftTwips: 0,
      headerTwips: 0,
      footerTwips: 0,
    },
  });

  const embeddedFont = await loadFormulaFont();
  const bytes = buildDocxPackage(
    body,
    FORMULA_FONT_NAME,
    {
      title: spec.job.title || "RetainPDF 保留排版译文",
      creator: "RetainPDF",
      description: "RetainPDF layout-preserving translation with native Office Math.",
    },
    theme,
    embeddedFont,
    // 保留排版的导出不要页眉页脚:它们会把绝对定位的内容整体挤走。
    { media, includeHeaderFooter: false },
  );

  return {
    bytes,
    pageCount: spec.pages.length,
    embeddedFormulaFont: Boolean(embeddedFont),
    textboxCount,
    formulaCount,
    formulaErrors: errors,
  };
}

export { parseSpec, validateDocxPackage };
