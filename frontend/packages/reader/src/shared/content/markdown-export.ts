// 下载用的 Markdown（原文 / 译文 / 双语三份 + 图片）：和 Markdown 面板的按块视图同一组块（buildReaderMdBlocks），
// 同一个口径——按阅读顺序，跨页接续的段合成一块，没译文的块（公式、参考文献、保留原文的）译文就是原文。
//
// 只拼文字和图片清单，不取图片、不打包（宿主去取、去打 zip）。图片在三份 md 里都写成相对路径 images/...，
// 解压后 Typora、Obsidian 直接能看。老任务的 regions 没有阅读顺序时返回 null，宿主退回整篇 ocr.zip。

import { normalizeReaderRegions } from "../data/reader-regions.js";
import { buildReaderMdBlocks, readerMdBlockMarkdown, type ReaderMdBlock, type ReaderMdLanguage } from "./reader-blocks.js";

export type ReaderMarkdownExportAsset = { url: string; path: string };

export type ReaderMarkdownExport = {
  source: string;
  translated: string;
  bilingual: string;
  /** 有没有任何一块有译文：没有时宿主只放原文那一份。 */
  hasTranslation: boolean;
  /** 要放进 zip 的图片：原地址 → zip 里的路径（images/...），去重过。 */
  assets: ReaderMarkdownExportAsset[];
};

/** 公式编号（"(3)"）写进公式里：$$…$$ 结尾的放 \tag{3}，否则跟在后面。 */
function withFormulaLabel(markdown: string, label: string): string {
  const tag = label.replace(/^\s*\(\s*|\s*\)\s*$/g, "").trim();
  if (!tag) return markdown;
  const trimmed = markdown.trimEnd();
  if (trimmed.endsWith("$$") && trimmed.length > 4) return `${trimmed.slice(0, -2).trimEnd()} \\tag{${tag}}$$`;
  return `${trimmed} ${label.trim()}`;
}

/** 图片在 zip 里的路径：地址里有 /images/ 就留它后面那截（images/page-3/fig.png），否则用文件名；重名加序号。 */
function assetPathMaker() {
  const byUrl = new Map<string, string>();
  const used = new Set<string>();
  return (url: string): string => {
    const known = byUrl.get(url);
    if (known) return known;
    let pathname = url;
    try {
      pathname = new URL(url, "http://local.invalid/").pathname;
    } catch {
      // 不是地址就按原样当文件名。
    }
    const decoded = (() => { try { return decodeURIComponent(pathname); } catch { return pathname; } })();
    const afterImages = decoded.includes("/images/") ? decoded.slice(decoded.lastIndexOf("/images/") + "/images/".length) : "";
    const raw = (afterImages || decoded.split("/").filter(Boolean).pop() || "image").replace(/^\/+/, "");
    const safe = raw.split("/").map((part) => part.replace(/[^\w.\-一-鿿]+/g, "_") || "_").join("/");
    let candidate = `images/${safe}`;
    for (let n = 2; used.has(candidate); n += 1) candidate = `images/${safe.replace(/(\.[^./]+)?$/, `-${n}$1`)}`;
    used.add(candidate);
    byUrl.set(url, candidate);
    return candidate;
  };
}

/** 文字里直接引用的图（表格 HTML 的 <img src>、Markdown 的 ![](…)）：是这一块的图就换成 zip 里的路径。 */
function rewriteInlineAssets(text: string, assetUrls: readonly string[], pathOf: (url: string) => string): string {
  let out = text;
  for (const url of assetUrls) {
    if (url && out.includes(url)) out = out.split(url).join(pathOf(url));
  }
  return out;
}

function blockMarkdown(block: ReaderMdBlock, language: ReaderMdLanguage, pathOf: (url: string) => string): string {
  if (block.kind === "figure") {
    return block.assetUrls.map((url) => `![](${pathOf(url)})`).join("\n\n");
  }
  let markdown = rewriteInlineAssets(readerMdBlockMarkdown(block, language), block.assetUrls, pathOf);
  if (block.kind === "formula" && block.label) markdown = withFormulaLabel(markdown, block.label);
  return markdown;
}

export function buildReaderMarkdownExport(regionsPayload: unknown): ReaderMarkdownExport | null {
  const blocks = buildReaderMdBlocks(normalizeReaderRegions(regionsPayload));
  if (!blocks || blocks.length === 0) return null;
  const pathOf = assetPathMaker();
  const source: string[] = [];
  const translated: string[] = [];
  const bilingual: string[] = [];
  for (const block of blocks) {
    const original = blockMarkdown(block, "source", pathOf);
    const chinese = block.hasTranslation ? blockMarkdown(block, "translated", pathOf) : original;
    if (original) source.push(original);
    if (chinese) translated.push(chinese);
    // 双语：有译文的块原文下面紧跟译文；公式、图、没译文的只出一次。
    if (original) bilingual.push(block.hasTranslation && chinese && chinese !== original ? `${original}\n\n${chinese}` : original);
  }
  const join = (parts: string[]) => `${parts.join("\n\n").trim()}\n`;
  const assets: ReaderMarkdownExportAsset[] = [];
  const seen = new Set<string>();
  for (const block of blocks) {
    for (const url of block.assetUrls) {
      if (!url || seen.has(url)) continue;
      seen.add(url);
      assets.push({ url, path: pathOf(url) });
    }
  }
  return {
    source: join(source),
    translated: join(translated),
    bilingual: join(bilingual),
    hasTranslation: blocks.some((block) => block.hasTranslation),
    assets,
  };
}
