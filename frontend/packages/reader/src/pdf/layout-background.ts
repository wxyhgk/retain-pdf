// HTML 页的底图（去掉原字的原文页，清单 background.url）用书页同一份 pdf.js 打开（react-pdf 的 pdfjs，worker 和 cMap、标准字体的地址也一样）：
// 先带授权取回来（useProtectedPdfFile 的 loadProtectedPdfFile，大文件按段取），再交给 pdfjs.getDocument。
// 不用 shared/data/pdf-document.ts 的 loadPdfDocument：它另外按模块路径加载 pdf.js，在阅读页里解析不到（2026-11-28 实测
// 「Failed to resolve module specifier 'build/pdf.mjs'」，底图画不出来）。
import { pdfjs } from "react-pdf";

import { readerPdfPort, resolveResourceUrl } from "../external.js";
import { createPdfRangeTransport, READER_PDF_RANGE_CHUNK } from "./pdf-range-transport.js";
import type { RegionPdfDocument } from "./RegionCanvas.js";
import { setupReactPdf } from "./setup-react-pdf.js";
import { loadProtectedPdfFile } from "./useProtectedPdfFile.js";

export async function loadLayoutBackground(url: string, signal?: AbortSignal): Promise<RegionPdfDocument | null> {
  setupReactPdf();
  const file = await loadProtectedPdfFile(resolveResourceUrl(url), undefined, { signal });
  if (!file || signal?.aborted) return null;
  const port = readerPdfPort();
  const common = {
    cMapUrl: port.resolvePdfjsVendorUrl("cmaps/"),
    cMapPacked: true,
    standardFontDataUrl: port.resolvePdfjsVendorUrl("standard_fonts/"),
    rangeChunkSize: READER_PDF_RANGE_CHUNK,
    disableAutoFetch: true,
  };
  const task = "ranged" in file
    ? pdfjs.getDocument({ ...common, range: createPdfRangeTransport(file.ranged) })
    : pdfjs.getDocument({ ...common, data: file.data });
  return (await task.promise) as unknown as RegionPdfDocument;
}
