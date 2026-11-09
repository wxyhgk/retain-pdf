import { pdfjs } from "react-pdf";
import type { RangedPdfSource } from "./useProtectedPdfFile.js";
/** pdf.js 一次取多大（字节）。本机取段很快，块大一点请求少：323MB 的书大约 160 次就能取完。 */
export declare const READER_PDF_RANGE_CHUNK: number;
export declare function createPdfRangeTransport(source: RangedPdfSource): InstanceType<typeof pdfjs.PDFDataRangeTransport>;
//# sourceMappingURL=pdf-range-transport.d.ts.map