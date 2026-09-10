// react-pdf / pdfjs worker 一次性配置。
// worker 走现有 vendor 拷贝，与自研 pdf-document 同源，避免 esbuild 再拆 worker。

import { pdfjs } from "react-pdf";
import { resolvePdfjsVendorUrl } from "../external.js";

let configured = false;

// resolvePdfjsVendorUrl 由宿主 adapters 注入，未注入时返回空串。空串写进
// workerSrc 会让 pdfjs 报 'No "GlobalWorkerOptions.workerSrc" specified' 且
// 整个 PDF 面板空白，故解析不到时不得锁存 configured —— 留待下次调用重试。
export function setupReactPdf() {
  if (configured) {
    return;
  }
  const workerSrc = resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  if (!workerSrc) {
    return;
  }
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  configured = true;
}
