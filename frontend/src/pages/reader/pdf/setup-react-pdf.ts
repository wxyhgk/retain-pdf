// Cấu hình một lần cho react-pdf / pdfjs worker.
// worker dùng bản copy vendor hiện có, cùng nguồn với pdf-document tự phát triển, tránh việc esbuild chia tách worker một lần nữa.

import { pdfjs } from "react-pdf";
import { resolvePdfjsVendorUrl } from "../external.js";

let configured = false;

export function setupReactPdf() {
  if (configured) {
    return;
  }
  pdfjs.GlobalWorkerOptions.workerSrc = resolvePdfjsVendorUrl("build/pdf.worker.mjs");
  configured = true;
}
