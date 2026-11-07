// 按段取的大 PDF（useProtectedPdfFile 的 { ranged }）交给 pdf.js：PDFDataRangeTransport 要哪段就用带鉴权的 fetch
// 取哪段。transport 只能给一个 Document 用，每次挂载新建一个。

import { pdfjs } from "react-pdf";
import type { RangedPdfSource } from "./useProtectedPdfFile.js";

/** pdf.js 一次取多大（字节）。本机取段很快，块大一点请求少：323MB 的书大约 160 次就能取完。 */
export const READER_PDF_RANGE_CHUNK = 2 * 1024 * 1024;

export function createPdfRangeTransport(source: RangedPdfSource): InstanceType<typeof pdfjs.PDFDataRangeTransport> {
  const transport = new pdfjs.PDFDataRangeTransport(source.length, null);
  transport.requestDataRange = (begin: number, end: number) => {
    source.fetchRange(begin, end).then(
      (chunk) => transport.onDataRange(begin, chunk),
      () => {
        // 取段失败：pdf.js 会一直等这段。中止整个 transport，Document 报错，面板显示「读取失败」可以重试。
        transport.abort();
      },
    );
  };
  return transport;
}
