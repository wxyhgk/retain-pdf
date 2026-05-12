import { $ } from "./dom.js";
import { apiBase, isDesktopMode } from "./config.js";

const PDFJS_CMAP_URL = new URL("../../vendor/pdfjs-dist/cmaps/", import.meta.url).toString();
const PDFJS_STANDARD_FONT_DATA_URL = new URL("../../vendor/pdfjs-dist/standard_fonts/", import.meta.url).toString();
const PDFJS_WORKER_URL = new URL("../../vendor/pdfjs-dist/build/pdf.worker.mjs", import.meta.url).toString();

let readerDialogComponentPromise = null;
let readerDialogFeature = null;
let readerDialogFeaturePromise = null;
let pdfjsPromise = null;

export function normalizeWorkflow(value, { book = "book", translate = "translate", render = "render" } = {}) {
  const workflow = `${value || ""}`.trim();
  if (workflow === translate || workflow === render) {
    return workflow;
  }
  return book;
}

export function normalizeMathMode(value) {
  return `${value || ""}`.trim() === "placeholder" ? "placeholder" : "direct_typst";
}

export function getRequestedReaderJobIdFromLocation() {
  const url = new URL(window.location.href);
  const view = `${url.searchParams.get("view") || ""}`.trim();
  const jobId = `${url.searchParams.get("job_id") || ""}`.trim();
  return view === "reader" && jobId ? jobId : "";
}

export function setText(id, value) {
  const el = $(id);
  if (el) {
    el.textContent = value;
  }
  if (id === "error-box") {
    const inlineError = $("error-box-inline");
    if (inlineError) {
      const text = `${value ?? ""}`.trim();
      inlineError.textContent = value;
      inlineError.classList.toggle("hidden", !text || text === "-");
    }
  }
}

export function collectUploadFormData(file) {
  const form = new FormData();
  form.append("file", file);
  return form;
}

async function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("../../vendor/pdfjs-dist/build/pdf.mjs")
      .then((module) => {
        module.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
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
    cMapUrl: PDFJS_CMAP_URL,
    cMapPacked: true,
    standardFontDataUrl: PDFJS_STANDARD_FONT_DATA_URL,
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

export async function ensureReaderDialogFeature({ state, fetchProtected, setTextFn = setText }) {
  if (readerDialogFeature) {
    return readerDialogFeature;
  }
  if (!readerDialogFeaturePromise) {
    if (!readerDialogComponentPromise) {
      readerDialogComponentPromise = import("./components/dialogs/reader-dialog.js")
        .catch((error) => {
          readerDialogComponentPromise = null;
          throw error;
        });
    }
    readerDialogFeaturePromise = readerDialogComponentPromise
      .then(() => import("./features/reader-dialog/controller.js"))
      .then(({ mountReaderDialogFeature }) => {
        const feature = mountReaderDialogFeature({
          state,
          fetchProtected,
          setText: setTextFn,
        });
        feature.bindEvents();
        readerDialogFeature = feature;
        return feature;
      })
      .catch((error) => {
        readerDialogFeaturePromise = null;
        throw error;
      });
  }
  return readerDialogFeaturePromise;
}

export async function openReaderFromButton({ button, state, fetchProtected, setTextFn = setText }) {
  const url = `${button?.dataset?.url || ""}`.trim();
  const disabled = button?.classList?.contains("disabled")
    || button?.getAttribute?.("aria-disabled") === "true";
  let jobId = "";
  if (url) {
    try {
      jobId = new URL(url, window.location.href).searchParams.get("job_id")?.trim() || "";
    } catch (_err) {
      jobId = "";
    }
  }
  if (!jobId) {
    jobId = `${state.currentJobId || ""}`.trim();
  }
  const feature = await ensureReaderDialogFeature({ state, fetchProtected, setTextFn });
  feature.open({
    url,
    jobId,
    disabled,
  });
}

export function bindDynamicPrimaryActions({ state, fetchProtected, setTextFn = setText, statusDetailFeature }) {
  document.addEventListener("click", (event) => {
    const detailButton = event.target?.closest?.("#status-detail-btn");
    if (detailButton) {
      event.preventDefault();
      statusDetailFeature?.openStatusDetailDialog("overview");
      return;
    }

    const readerButton = event.target?.closest?.("#reader-btn");
    if (readerButton) {
      event.preventDefault();
      void openReaderFromButton({
        button: readerButton,
        state,
        fetchProtected,
        setTextFn,
      }).catch((error) => {
        setTextFn("error-box", error.message || String(error));
      });
    }
  });
}
