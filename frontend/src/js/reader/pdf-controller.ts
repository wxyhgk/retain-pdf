import { $ } from "../dom/query.js";
import {
  loadPdfDocument,
  resolveReaderArtifactUrl,
} from "./pdf-document.js";
import {
  bindReaderRegionHover,
  scheduleRegionOverlayRender,
} from "./region-interactions.js";
import { bindPrimaryViewer } from "./primary-viewer.js";
import {
  mountManualPages,
  scheduleVisibleManualPages,
} from "./pdf-renderer.js";
import {
  applyViewerScale,
  schedulePageRowSync as scheduleReaderPageRowSync,
  scheduleScaleRefresh as scheduleReaderScaleRefresh,
} from "./pdf-layout.js";
import {
  showReaderPaneEmpty,
  showReaderPaneReady,
} from "./view.js";

const viewerControllers = new Map();

export { resolveReaderArtifactUrl };

function getViewerController(key) {
  return viewerControllers.get(key) || null;
}

function renderCallbacks() {
  return {
    onPageRendered: () => {
      schedulePageRowSync();
      scheduleRegionOverlayRender();
    },
    onScaleChanged: () => schedulePageRowSync(),
    onScaleRefresh: () => schedulePageRowSync(),
  };
}

function schedulePageRowSync() {
  scheduleReaderPageRowSync(viewerControllers);
}

export function scheduleScaleRefresh() {
  scheduleReaderScaleRefresh(viewerControllers, renderCallbacks());
}

export { bindPrimaryViewer };

function createViewerController(key) {
  const scrollShell = $("reader-scroll-shell");
  const viewerHost = $(`${key}-viewer-host`);
  const viewerElement = $(`${key}-viewer`);
  if (!scrollShell || !viewerHost || !viewerElement) {
    return null;
  }

  const controller = {
    key,
    scrollShell,
    viewerHost,
    viewerElement,
    basePageWidth: 0,
    currentScale: 0,
    pdfDocument: null,
    pageViewports: new Map(),
    renderedPages: new Set(),
    renderTasks: new Map(),
    visiblePages: new Set(),
    pageObserver: null,
    primaryScrollHandler: null,
  };
  viewerControllers.set(key, controller);
  return controller;
}

export async function mountPdfViewer({
  key,
  itemOrUrl,
  label,
  emptyId,
  fetchProtected = null,
}) {
  const viewerWrap = $(`${key}-wrap`);
  const empty = $(emptyId);
  const controller = getViewerController(key) || createViewerController(key);
  if (!viewerWrap || !empty || !controller) {
    return null;
  }

  let pdfDocument = null;
  try {
    pdfDocument = await loadPdfDocument({ itemOrUrl, fetchProtected });
  } catch (error) {
    // loadPdfDocument không có xử lý dự phòng cho pdfjsLib.getDocument(...).promise -
    // 404/CORS/PDF hỏng sẽ reject tại đây, trước đây throw trực tiếp lên trên, cuối cùng bị
    // mountReaderPdfPair của Promise.allSettled nuốt, console không để lại dấu vết nào,
    // người dùng chỉ thấy "PDF này không hiển thị" nhưng không biết nguyên nhân nào. Thêm log tại đây,
    // không thay đổi hành vi hiển thị bên ngoài (vẫn rơi vào trạng thái trống bên dưới).
    console.error(`[reader] ${label || key} tải thất bại`, error);
    showReaderPaneEmpty(key, emptyId);
    return null;
  }
  if (!pdfDocument) {
    // loadPdfDocument trả về null im lặng khi "không có URL khả dụng" (không có URL để phân giải,
    // hoặc itemOrUrl bản thân là chuỗi rỗng) - cũng thêm một log, tiện phân biệt "không có URL"
    // và "có URL nhưng tải thất bại" ở trên.
    console.warn(`[reader] ${label || key} không có địa chỉ tài nguyên khả dụng, bỏ qua gắn kết`, { itemOrUrl });
    showReaderPaneEmpty(key, emptyId);
    return null;
  }

  const firstPage = await pdfDocument.getPage(1);
  const firstViewport = firstPage.getViewport({ scale: 1 });
  controller.basePageWidth = firstViewport.width;
  mountManualPages(controller, pdfDocument, firstViewport, renderCallbacks());
  applyViewerScale(controller, renderCallbacks());
  controller.visiblePages.add(1);
  if (pdfDocument.numPages > 1) {
    controller.visiblePages.add(2);
  }
  scheduleVisibleManualPages(controller, renderCallbacks());

  showReaderPaneReady(key, emptyId);

  return {
    key,
    pagesCount: pdfDocument.numPages,
    controller,
  };
}

export function bindResizeRefresh() {
  window.addEventListener("resize", scheduleScaleRefresh);
}

export { bindReaderRegionHover };
