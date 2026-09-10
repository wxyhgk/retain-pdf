import { resolvePdfjsVendorUrl } from "@/platform/runtime/vendor-url.js";

// 惰性解析：resolvePdfjsVendorUrl 依赖 document.baseURI，模块级求值会在无 DOM
// 的环境（node 测试直接 import 本模块的传递依赖时）抛 ERR_INVALID_URL。
// 首次真正用到时再解析，模块加载本身不触碰环境。
const pdfjsUrl = (path: string) => resolvePdfjsVendorUrl(path);

let pdfjsPromise = null;

async function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import(pdfjsUrl("build/pdf.mjs"))
      .then((module) => {
        module.GlobalWorkerOptions.workerSrc = pdfjsUrl("build/pdf.worker.mjs");
        return module;
      })
      .catch((error) => {
        pdfjsPromise = null;
        throw error;
      });
  }
  return pdfjsPromise;
}

export async function countPdfPages(file) {
  if (!file) {
    return 0;
  }
  const pdfjsLib = await loadPdfjs();
  const doc = await pdfjsLib.getDocument({
    data: await file.arrayBuffer(),
    cMapUrl: pdfjsUrl("cmaps/"),
    cMapPacked: true,
    standardFontDataUrl: pdfjsUrl("standard_fonts/"),
    disableFontFace: true,
    disableRange: true,
    disableStream: true,
  }).promise;
  try {
    return Number(doc?.numPages || 0);
  } finally {
    if (doc?.destroy) {
      await doc.destroy().catch(() => {});
    }
  }
}
