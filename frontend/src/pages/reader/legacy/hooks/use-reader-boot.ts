// Điều phối khởi động trình đọc (Phase 2b toàn bộ): chuyển toàn bộ từ src/js/reader/index.js cũ.
// Chạy sau lần commit đầu tiên của React (các mô-đun mệnh lệnh tìm container theo id, DOM phải sẵn sàng trước).
//
// Tái sử dụng mệnh lệnh (không React hóa): toàn bộ họ pdf, interaction-flow, region-*,
// selection-favorites, favorites/*, markdown-preview, progress-presenter,
// bộ điều khiển chrome/mode, column-resizer/panel-collapse (giữ nguyên giải pháp biến CSS cho lớp ngoài ba cột,
// rrp chỉ quản lý nhóm PDF đôi bên trong —— ba cột cũ không phải flex đồng cấp, ngăn kéo là lớp phủ fixed +
// cascade cấp body :has(), thay đổi lớp ngoài rrp đòi hỏi viết lại toàn bộ reader-page.css, rủi ro pixel lớn hơn nhiều so với lợi ích).
//
// Phía React (tiêm qua runtime state): context menu tải xuống, cổng panel chú thích, cổng AI chat.
//
// Hợp đồng thời gian (cấp pixel): chrome.bindEvents() phải chạy trước drawerStore.open("ai") ——
// bộ đếm thời gian mờ dần được xếp khi "chưa có ngăn kéo nào mở", sau 1.6s body chuyển sang reader-chrome-muted,
// khớp với hình dạng của trang cũ tại thời điểm chụp ảnh baseline.

import { useEffect, useState } from "react";
import {
  bindResizeRefresh,
  scheduleScaleRefresh,
} from "../../../../js/reader/pdf-controller.js";
import {
  setReaderBootLoading,
  setReaderModeHud,
  showBothReaderEmpty,
  showReaderPaneEmpty,
} from "../../../../js/reader/view.js";
import {
  defaultReaderPageConfigPort,
  resolveReaderAnchor,
  resolveReaderDocumentId,
} from "../../../../js/reader/config-port.js";
import { defaultReaderDataPort } from "../../../../js/reader/data-port.js";
import { resolveResourceUrl } from "../../../../js/job/artifacts.js";
import { isMockMode } from "../../../../js/config/runtime.js";
import { MOCK_DOCUMENT_SOURCE_PDF_URL } from "../../../../js/mock/documents.js";
import {
  READER_PROGRESS_COPY,
  createReaderPageState,
  resetReaderProgressState,
} from "../../../../js/reader/page-state.js";
import {
  defaultReaderProgressPresenter,
} from "../../../../js/reader/progress-presenter.js";
import { bindReaderInteractions } from "../../../../js/reader/interaction-flow.js";
import {
  jumpToReaderAnchor,
  resolveSelectionQuote,
} from "../../../../js/reader/region-interactions.js";
import { createReaderAiContext } from "../../../../js/reader/ai-context.js";
import { createReaderAskAnswerer } from "../../../../js/reader/ai/ask-answerer.js";
import { createReaderChromeController } from "../../../../js/reader/chrome-controller.js";
import { createReaderColumnResizer } from "../../../../js/reader/column-resizer.js";
import { createReaderMarkdownPreview } from "../../../../js/reader/markdown-preview.js";
import { createReaderModeController } from "../../../../js/reader/mode-controller.js";
import { createReaderPanelCollapse } from "../../../../js/reader/panel-collapse.js";
import { createReaderSelectionFavorites } from "../../../../js/reader/selection-favorites.js";
import { createReaderServerFavoritesPort } from "../../../../js/reader/server-favorites-port.js";
import {
  resolveReaderJobId,
  resolveReaderSourcePdf,
  resolveReaderTranslatedPdfUrl,
} from "../../../../js/reader/resource-resolver.js";
import { mountReaderPdfPair } from "../../../../js/reader/viewer-mount-flow.js";
import type { ReaderMetadata, RegionsPayload } from "../../../../js/reader/types.js";

let bootStarted = false;

  // Nhấp vào trích dẫn sẽ nhảy đến anchor văn bản gốc (sử dụng chung cơ chế định vị với chuyển hướng từ mục yêu thích), ngăn kéo vẫn mở;
  // Khi trích dẫn thuộc về tài liệu khác, điều hướng đến trình đọc của tài liệu đó và mang theo tham số anchor.
function jumpToCitationFactory(jobId) {
  return (citation) => {
    const citationJobId = `${citation?.job_id || ""}`.trim();
    if (citationJobId && citationJobId !== jobId) {
      const params = new URLSearchParams({ job_id: citationJobId });
      if (Number.isFinite(Number(citation?.page_idx))) {
        params.set("page_idx", `${citation.page_idx}`);
      }
      if (citation?.block_id) {
        params.set("block_id", `${citation.block_id}`);
      }
      window.location.href = `reader.html?${params.toString()}`;
      return true;
    }
    return jumpToReaderAnchor({
      pageIdx: citation?.page_idx,
      blockId: citation?.block_id,
    });
  };
}

// Khi URL có anchor (?page_idx=&block_id=) thì nhảy đến đó. Trang/regions được mount bất đồng bộ, và luồng khởi động
// sẽ reset vị trí cuộn về đầu sau khi mount — nhảy thành công một lần chưa đủ, phải xác định theo "trang đích có thực sự
// nằm trong viewport hay không", nếu chưa vào vị trí thì retry với backoff (hội tụ khi layout ổn định).
function scheduleAnchorJump(anchor) {
  const anchorPageNumber = Number.isFinite(Number(anchor.pageIdx))
    ? Number(anchor.pageIdx) + 1
    : 0;
  const anchorSettled = () => {
    if (!anchorPageNumber) {
      return true;
    }
    const pageElement = document.querySelector(
      `#reader-pdf-viewer .page[data-page-number="${anchorPageNumber}"]`,
    );
    if (!pageElement) {
      return false;
    }
    const rect = pageElement.getBoundingClientRect();
    return rect.top < globalThis.innerHeight && rect.bottom > 0;
  };
  // Quá trình render và layout PDF có thể kéo dài hơn 20 giây, trong thời gian đó scrollIntoView sẽ bị
  // layout reset nuốt mất; tiếp tục retry cho đến khi vào vị trí, người dùng vừa cuộn thủ công thì nhường ngay.
  let anchorCanceled = false;
  const cancelAnchor = () => {
    anchorCanceled = true;
  };
  for (const eventName of ["wheel", "touchmove", "keydown"]) {
    globalThis.addEventListener?.(eventName, cancelAnchor, { once: true, passive: true });
  }
  const tryJump = (attempt = 0) => {
    if (anchorCanceled) {
      return;
    }
    jumpToReaderAnchor(anchor);
    if (attempt >= 40) {
      return;
    }
    globalThis.setTimeout(() => {
      if (!anchorCanceled && !anchorSettled()) {
        tryJump(attempt + 1);
      }
    }, 600);
  };
  // Không dùng requestAnimationFrame: ở tab nền rAF bị treo, callback
  // không bao giờ được gọi, định vị anchor sẽ thất bại im lặng (đã gặp thực tế).
  globalThis.setTimeout(tryJump, 0);
}

  // Khi tệp nguồn không khả dụng, điền một thông báo rõ ràng vào cột nguồn (tài liệu mồ côi: có hàng document nhưng không có PDF nguồn trong kho).
  // #reader-pdf-empty mặc định là khối placeholder nét đứt không có văn bản, ghi trực tiếp textContent để nó có nội dung hiển thị.
function showReaderSourceUnavailable() {
  showReaderPaneEmpty("reader-pdf", "reader-pdf-empty");
  const empty = document.getElementById("reader-pdf-empty");
  if (empty) {
    empty.textContent = "Tệp nguồn không khả dụng: tài liệu này không có PDF nguồn đọc được (có thể chỉ có bản ghi, chưa nhập tệp).";
  }
}

  // "Đọc văn bản gốc" tài liệu thư viện (F4): không có job, chỉ gắn cột nguồn, chuyển sang chế độ một cột source,
  // bỏ qua tất cả các chức năng phụ phụ thuộc jobId (yêu thích/AI/chú thích/markdown/interaction). URL tài liệu nguồn đi qua
  // /documents/:id/source.pdf (chế độ mock đi qua kênh mock://).
async function mountSourceOnlyReader({
  documentId,
  pageState,
  modeController,
  applyBootProgress,
  syncBootProgress,
}) {
  // Tài liệu chỉ đọc nguồn luôn là một cột —— **trước tiên** đưa vào cột source một cột, bất kể nguồn tải thành công hay thất bại
  // đều không nên quay lại trạng thái trống hai cột mặc định (nếu không sẽ có hai cột trống khi thiếu tệp nguồn = một khoảng trắng hoàn toàn).
  modeController.setMode("source");
  try {
    applyBootProgress(14, READER_PROGRESS_COPY.metadata, "metadata");
    pageState.progress.metadataReady = true;
    syncBootProgress();

    const sourcePdf = isMockMode()
      ? MOCK_DOCUMENT_SOURCE_PDF_URL
      : resolveResourceUrl(`/api/v1/documents/${encodeURIComponent(documentId)}/source.pdf`);

    const { sourceReady } = await mountReaderPdfPair({
      fetchProtected: defaultReaderDataPort.fetchProtected,
      sourcePdf,
      translatedPdfUrl: "",
      onSourceSettled: () => {
        pageState.progress.sourceDone = true;
        syncBootProgress();
      },
      onTranslatedSettled: () => {
        pageState.progress.translatedDone = true;
        syncBootProgress();
      },
    });

    if (!sourceReady) {
      // Không lấy được tệp nguồn (ví dụ dòng tài liệu mồ côi: có bản ghi document nhưng chưa nhập PDF nguồn,
      // /documents/:id/source.pdf trả về 404) — hiển thị thông báo rõ ràng trong khung đơn, không để trống.
      showReaderSourceUnavailable();
      applyBootProgress(100, READER_PROGRESS_COPY.failed, "failed");
      setReaderBootLoading(false);
      return;
    }

    applyBootProgress(100, READER_PROGRESS_COPY.ready, "ready");
    setReaderBootLoading(false);

    const anchor = resolveReaderAnchor();
    if (anchor) {
      scheduleAnchorJump(anchor);
    }
  } catch (_err) {
    showReaderSourceUnavailable();
    applyBootProgress(100, READER_PROGRESS_COPY.failed, "failed");
    setReaderBootLoading(false);
  }
}

async function initializeReader({ drawerStore, publish }) {
  // Xác định luồng trước (chỉ parse URL, không side-effect): có job thì đi đọc đối chiếu đầy đủ; chỉ có document_id
  // là tài liệu thư viện "đọc bản gốc" (F4), cần bỏ qua mọi tính năng phụ và thanh công cụ phụ thuộc jobId.
  const jobId = resolveReaderJobId(defaultReaderPageConfigPort);
  const sourceOnlyDocumentId = jobId ? "" : resolveReaderDocumentId();
  const sourceOnly = Boolean(sourceOnlyDocumentId);
  if (sourceOnly) {
    // CSS dựa vào điều này để ẩn tab dịch/đối chiếu và nhóm công cụ Markdown/trích xuất/chú thích/AI/tải xuống (tất cả đều phụ thuộc jobId).
    document.documentElement.classList.add("reader-source-only");
  }

  const pageState = createReaderPageState();
  let readerInteractionController = null;
  let readerMarkdownPreview = null;

  const applyBootProgress = (percent, text, stage = "progress") => {
    defaultReaderProgressPresenter.apply({
      bootProgressBarState: pageState.bootProgressBar,
      percent,
      stage,
      text,
    });
  };
  const syncBootProgress = () => {
    defaultReaderProgressPresenter.sync(pageState);
  };

  const chromeController = createReaderChromeController();
  const modeController = createReaderModeController({
    onModeChanged: () => {
      readerInteractionController?.syncIndicatorForMode?.();
      chromeController.wake();
      scheduleScaleRefresh();
    },
    onModeHudChanged: setReaderModeHud,
  });
  // Bộ điều khiển thu gọn: quản lý thu gọn cột trái/phải; khi mở công cụ từ thanh trên cùng tự động mở rộng cột phải để hiện nội dung
  const panelCollapse = createReaderPanelCollapse({
    onChange: () => scheduleScaleRefresh(),
  });
  // Lệnh open("ai") lập trình lúc khởi động không được xóa trạng thái thu gọn cột phải do người dùng lưu; chỉ khi người dùng nhấn công cụ trên thanh trên cùng mới tự động mở rộng
  let allowAutoExpandRight = false;
  drawerStore.subscribe((active) => {
    scheduleScaleRefresh();
    if (active && allowAutoExpandRight) {
      panelCollapse.expandRight();
    }
    if (active === "markdown") {
      void readerMarkdownPreview?.ensureLoaded();
    }
  });

  bindResizeRefresh();
  chromeController.bindEvents();
  modeController.bindEvents();
  // Khung ba cột: cột trái/phải có thể kéo để điều chỉnh độ rộng (lưu bền vững), khi kéo làm mới tỷ lệ phóng PDF
  createReaderColumnResizer({ onResize: () => scheduleScaleRefresh() }).bindEvents();
  // Tay nắm thu gọn cột trái/phải (áp dụng trạng thái thu gọn bền vững trước)
  panelCollapse.bindEvents();
  // Mặc định mở rộng cột phải (AI hỏi đáp). Phải chạy sau chromeController.bindEvents(), xem hợp đồng thời gian ở đầu tệp;
  // nếu người dùng đã thu gọn cột phải lần trước thì CSS sẽ giữ nguyên trạng thái thu gọn.
  // Chế độ chỉ đọc tài liệu nguồn không có job → AI/chú thích/Markdown đều không khả dụng, không mở rộng cột phải
  // (nếu không sẽ treo một panel trống mãi "đang chuẩn bị…").
  if (!sourceOnly) {
    drawerStore.open("ai");
  }
  // Sau khi hoàn tất open lúc khởi động, chỉ cho phép tự động mở rộng cột phải khi người dùng nhấn công cụ trên thanh trên cùng
  allowAutoExpandRight = true;

  setReaderBootLoading(true);
  resetReaderProgressState(pageState);
  syncBootProgress();

  if (sourceOnly) {
    await mountSourceOnlyReader({
      documentId: sourceOnlyDocumentId,
      pageState,
      modeController,
      applyBootProgress,
      syncBootProgress,
    });
    return;
  }
  if (!jobId) {
    showBothReaderEmpty();
    applyBootProgress(100, READER_PROGRESS_COPY.failed, "failed");
    setReaderBootLoading(false);
    return;
  }

  try {
    applyBootProgress(14, READER_PROGRESS_COPY.metadata, "metadata");
    const {
      jobPayload,
      manifestPayload,
      readerMetadata,
      regionsPayload,
    } = await defaultReaderDataPort.loadReaderPayload(jobId);
    pageState.progress.metadataReady = true;
    syncBootProgress();

    const sourcePdf = resolveReaderSourcePdf(manifestPayload);
    const translatedPdfUrl = resolveReaderTranslatedPdfUrl(jobPayload, manifestPayload);

    const { sourceReady, translatedReady } = await mountReaderPdfPair({
      fetchProtected: defaultReaderDataPort.fetchProtected,
      sourcePdf,
      translatedPdfUrl,
      onSourceSettled: () => {
        pageState.progress.sourceDone = true;
        syncBootProgress();
      },
      onTranslatedSettled: () => {
        pageState.progress.translatedDone = true;
        syncBootProgress();
      },
    });

    if (!sourceReady) {
      showReaderPaneEmpty("reader-pdf", "reader-pdf-empty");
    }
    if (!translatedReady) {
      showReaderPaneEmpty("reader-translated-pdf", "reader-translation-empty");
    }
    if (!sourceReady && !translatedReady) {
      applyBootProgress(100, READER_PROGRESS_COPY.failed, "failed");
      setReaderBootLoading(false);
      return;
    }

    readerInteractionController = bindReaderInteractions({
      apiPrefix: defaultReaderDataPort.apiPrefix,
      fetchTranslationItem: defaultReaderDataPort.fetchRegionTranslationItem,
      jobId,
      pageState,
      readerMetadata: readerMetadata as ReaderMetadata | null,
      regionsPayload: regionsPayload as RegionsPayload | null,
      sourceReady,
      translatedReady,
    });

    // Nhấp đúp chọn vùng để trích xuất ảnh chụp màn hình (đảo mệnh lệnh, bao gồm render danh sách favorites trong ngăn kéo)
    const serverFavoritesPort = createReaderServerFavoritesPort({ jobId });
    createReaderSelectionFavorites({
      drawerController: drawerStore,
      jobId,
      setReaderMode: modeController.setMode,
      resolveQuote: resolveSelectionQuote,
      serverFavoritesPort,
    }).bindEvents();

    // Cổng bảng chú thích (subscription đóng/mở được cầu nối bởi component ngăn kéo tới drawer store)
    const jobFields = (jobPayload || {}) as { source_filename?: string; title?: string };
    const documentTitle = `${jobFields.source_filename || jobFields.title || jobId}`;
    const clipboard = globalThis.navigator?.clipboard || null;
    const annotationPorts = {
      loadAnnotations: () => serverFavoritesPort.loadServerFavorites() || Promise.resolve([]),
      deleteAnnotation: (favoriteId) => serverFavoritesPort.removeServerFavorite(favoriteId) || Promise.resolve(false),
      saveNote: (annotation, note) => serverFavoritesPort.recreateFavoriteNote(annotation, note) || Promise.resolve(null),
      jumpToAnchor: (anchor) => jumpToReaderAnchor(anchor),
      exportMarkdown: async (text) => {
        try {
          await clipboard?.writeText?.(text);
          return true;
        } catch (error) {
          console.error("Xuất chú thích sang clipboard thất bại", error);
          return false;
        }
      },
      documentTitle: () => documentTitle,
    };

    readerMarkdownPreview = createReaderMarkdownPreview({
      fetchProtected: defaultReaderDataPort.fetchProtected,
      jobId,
      loadMarkdownPayload: defaultReaderDataPort.loadMarkdownPayload,
    });

    const readerAiContext = createReaderAiContext({
      drawerController: drawerStore,
    });
    readerAiContext.bindEvents();

    // Phía React inject một lần: context menu tải xuống, cổng chú thích, cổng AI chat
    publish({
      annotations: annotationPorts,
      chat: {
        aiContext: readerAiContext,
        jobId,
        jumpToCitation: jumpToCitationFactory(jobId),
        loadMarkdownPayload: defaultReaderDataPort.loadMarkdownPayload,
        remoteAnswerer: createReaderAskAnswerer({
          jobId,
          resolveQuote: resolveSelectionQuote,
        }),
      },
      downloads: {
        fetchProtected: defaultReaderDataPort.fetchProtected,
        jobId,
        jobPayload,
        manifestPayload,
      },
    });

    applyBootProgress(100, READER_PROGRESS_COPY.ready, "ready");
    setReaderBootLoading(false);

    const anchor = resolveReaderAnchor();
    if (anchor) {
      scheduleAnchorJump(anchor);
    }
  } catch (_err) {
    showBothReaderEmpty();
    applyBootProgress(100, READER_PROGRESS_COPY.failed, "failed");
    setReaderBootLoading(false);
  }
}

export function useReaderBoot(drawerStore) {
  const [runtime, setRuntime] = useState({
    annotations: null,
    chat: null,
    downloads: null,
  });
  useEffect(() => {
    if (bootStarted) {
      return;
    }
    bootStarted = true;
    void initializeReader({
      drawerStore,
      publish: (parts) => setRuntime((prev) => ({ ...prev, ...parts })),
    });
  }, [drawerStore]);
  return runtime;
}
