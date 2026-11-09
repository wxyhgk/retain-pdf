// 「常用下载」的 Markdown：在浏览器里打一个 zip——原文、译文、双语三份 md 加 images/（三份共用，相对路径引用）。
// 2026-11-09 用户定：前端自己打包，后端不出新产物。拼法和阅读页 Markdown 面板同一套（buildReaderMarkdownExport）。
//
//   书名-markdown.zip
//   ├── 书名.en.md          原文
//   ├── 书名.zh.md          译文（没译文的块放原文；整本都没译文时不放）
//   ├── 书名.bilingual.md   双语（同上）
//   └── images/
//
// 老任务的 regions 没有阅读顺序拼不出块时返回 null，调用方退回原来的 ocr.zip（只有原文）。

import { zip, type Zippable } from "fflate";
import { fetchReaderRegions } from "@retainpdf/api/reader";
import { buildReaderMarkdownExport } from "@retainpdf/reader/runtime/content";
import { fetchProtected } from "@/platform/api/index.js";
import { API_PREFIX } from "@/platform/config/api-constants.js";
import { resolveResourceUrl } from "@retainpdf/domain/job";

/** 同时取几张图：本机够快，别一下子几百个请求。 */
const IMAGE_CONCURRENCY = 6;

/** 书名进文件名：去掉路径和系统不认的字符，太长截断。 */
export function markdownBundleBaseName(title: string, fallback: string): string {
  const cleaned = `${title || ""}`
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "");
  const base = cleaned || `${fallback || "document"}`;
  return [...base].slice(0, 80).join("").trim() || "document";
}

async function fetchImages(assets: ReadonlyArray<{ url: string; path: string }>): Promise<Map<string, Uint8Array>> {
  const out = new Map<string, Uint8Array>();
  let next = 0;
  const worker = async () => {
    while (next < assets.length) {
      const asset = assets[next];
      next += 1;
      try {
        // regions 里的图片地址是 /api/v1/... 相对路径：补上 API 的地址（开发栈里静态页和 API 不同端口）。
        const response = await fetchProtected(resolveResourceUrl(asset.url) || asset.url);
        if (!response.ok) continue;
        out.set(asset.path, new Uint8Array(await response.arrayBuffer()));
      } catch {
        // 一张图取不到不让整个下载失败：md 里那张图显示不出来而已。
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(IMAGE_CONCURRENCY, assets.length) }, worker));
  return out;
}

function zipAsync(files: Zippable): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    zip(files, (error, data) => (error ? reject(error) : resolve(data)));
  });
}

/** 打好的包：文件名和内容。拼不出块（老任务）时 null。 */
export async function buildMarkdownBundle({ jobId, title }: { jobId: string; title: string }): Promise<{ filename: string; blob: Blob } | null> {
  const regions = await fetchReaderRegions(jobId, API_PREFIX);
  const markdown = buildReaderMarkdownExport(regions);
  if (!markdown) return null;
  const base = markdownBundleBaseName(title, jobId);
  const encoder = new TextEncoder();
  const files: Zippable = { [`${base}.en.md`]: encoder.encode(markdown.source) };
  if (markdown.hasTranslation) {
    files[`${base}.zh.md`] = encoder.encode(markdown.translated);
    files[`${base}.bilingual.md`] = encoder.encode(markdown.bilingual);
  }
  const images = await fetchImages(markdown.assets);
  // 图片本来就压过，原样存（level 0）省时间；md 用默认压缩。
  for (const [path, bytes] of images) files[path] = [bytes, { level: 0 }];
  const data = await zipAsync(files);
  return { filename: `${base}-markdown.zip`, blob: new Blob([data as Uint8Array<ArrayBuffer>], { type: "application/zip" }) };
}
