import {
  APP_EVENTS,
  TRANSLATION_WORKFLOW_DIALOG,
  TRANSLATION_WORKFLOW_MODES,
} from "../../composition/external.js";
import type { TranslationWorkflowDialogStatePort } from "../../composition/external.js";

// Runtime hộp thoại quy trình dịch (phiên bản thế giới React).
//
// Tái sử dụng logic thuần túy: dialogStatePort từ state.js (store điều khiển mở/đóng/chế độ, đồng bộ hóa viewMode của home),
// hằng số chế độ từ contract.js, hợp đồng status-area-port. Việc gắn kết DOM của controller.js cũ
// (dialogElement/closeButton addEventListener) được thay thế bằng onClick của component React,
// ở đây chỉ giữ lại cầu nối sự kiện cấp document.
//
// Hợp đồng sự kiện (rủi ro 5 trong bản thiết kế, không được phá vỡ):
// - Các điểm vào mở/đóng từ phía người dùng (nút thêm / nút đóng / nền / Escape) đều phải dispatch trước
//   APP_EVENTS.openTranslationWorkflow / closeTranslationWorkflow, sau đó trình lắng nghe document của runtime này
//   sẽ thống nhất cập nhật trạng thái —— việc tạm dừng/khôi phục làm mới thư viện 3b (bindings.js) và quy trình gửi app-actions
//   đều phụ thuộc vào việc hai sự kiện này hiển thị trên document.
// - translationWorkflowSync / statusAreaVisibilityChanged → đồng bộ hóa chế độ.

export interface TranslationWorkflowStatusAreaPort {
  isVisible?: () => boolean;
  hide?: () => void;
  returnHome?: () => void;
}

export interface TranslationWorkflowUploadSessionPort {
  resetUploadSession?: () => void;
}

export interface CreateTranslationWorkflowDialogRuntimeOptions {
  dialogStatePort?: TranslationWorkflowDialogStatePort;
  statusAreaPort?: TranslationWorkflowStatusAreaPort;
  uploadSessionPort?: TranslationWorkflowUploadSessionPort | null;
  documentRef?: Document;
}

export interface OpenTranslationWorkflowEventDetail {
  mode?: string;
}

export type OpenTranslationWorkflowEventLike = Event | {
  detail?: OpenTranslationWorkflowEventDetail;
};

export function createTranslationWorkflowDialogRuntime({
  dialogStatePort,
  statusAreaPort,
  uploadSessionPort = null,
  documentRef = globalThis.document,
}: CreateTranslationWorkflowDialogRuntimeOptions = {}) {
  // Sửa lỗi 3b (phát hiện trong thực tế, không phải thiết kế trước): refresh-environment.js của recent-jobs
  // mặc định isWorkflowOpen đọc thuộc tính data-open của #translation-workflow-dialog (DOM),
  // không phải từ bất kỳ store nào —— trong khi việc gửi DOM của React là bất đồng bộ so với việc ghi vào store.
  // Khi close() được kích hoạt, "ghi vào store → trình lắng nghe closeTranslationWorkflow của bindings.js
  // đọc DOM để xác định isSuspended()" đều xảy ra trong cùng một ngăn xếp gọi sự kiện đồng bộ, lúc này React
  // vẫn chưa kịp render lại và gửi data-open mới, DOM vẫn đọc được giá trị cũ trước khi mở —— trong thực tế
  // biểu hiện là "làm mới thư viện bị treo vĩnh viễn sau khi đóng hộp thoại quy trình dịch" (hình thái lỗi cụ thể của rủi ro 5 trong bản thiết kế).
  // mountRecentJobsFeature không mở cổng tiêm environment (xem giải thích trong composition.js),
  // không thể tiêm isWorkflowOpen đọc từ store từ phía upstream, chỉ có thể làm ngược lại: trong cùng một nhịp ghi vào store,
  // đồng thời ghi một bản sao thuộc tính này vào DOM, loại bỏ cửa sổ cạnh tranh cho bên đọc DOM.
  // React sau đó vẫn sẽ render lại cùng một giá trị theo nhịp độ của riêng nó (phép đẳng, không có tác dụng phụ).
  function syncOpenAttributeToDom(open: boolean) {
    const dialogEl = documentRef?.getElementById?.(TRANSLATION_WORKFLOW_DIALOG.ids.dialog);
    if (dialogEl?.dataset) {
      dialogEl.dataset.open = open
        ? TRANSLATION_WORKFLOW_DIALOG.datasetValues.open
        : TRANSLATION_WORKFLOW_DIALOG.datasetValues.closed;
    }
  }
  function resolveMode(mode?: string) {
    if (mode === TRANSLATION_WORKFLOW_MODES.STATUS || mode === TRANSLATION_WORKFLOW_MODES.UPLOAD) {
      return mode;
    }
    return statusAreaPort?.isVisible?.()
      ? TRANSLATION_WORKFLOW_MODES.STATUS
      : TRANSLATION_WORKFLOW_MODES.UPLOAD;
  }

  function isOpen() {
    return Boolean(dialogStatePort.getSnapshot().open);
  }

  // ---- Trạng thái thực thi (document lắng nghe và gọi; mirror openUpload/openFromEvent/close/sync của controller cũ) ----

  function openUpload() {
    statusAreaPort?.hide?.();
    uploadSessionPort?.resetUploadSession?.();
    dialogStatePort.open(TRANSLATION_WORKFLOW_MODES.UPLOAD);
    syncOpenAttributeToDom(true);
  }

  function openFromEvent(event: OpenTranslationWorkflowEventLike = {} as OpenTranslationWorkflowEventLike) {
    const detail = (event as { detail?: OpenTranslationWorkflowEventDetail })?.detail;
    const mode = detail?.mode;
    if (!mode || mode === TRANSLATION_WORKFLOW_MODES.UPLOAD) {
      openUpload();
      return;
    }
    dialogStatePort.open(resolveMode(mode));
    syncOpenAttributeToDom(true);
  }

  function close() {
    dialogStatePort.close();
    syncOpenAttributeToDom(false);
  }

  function sync() {
    dialogStatePort.setMode(resolveMode());
  }

  // ---- Điểm vào phía người dùng (React component gọi; chỉ phát sự kiện, không trực tiếp thay đổi trạng thái) ----

  function dispatch(eventName: string, detail?: unknown) {
    if (documentRef?.dispatchEvent && typeof globalThis.CustomEvent === "function") {
      documentRef.dispatchEvent(new globalThis.CustomEvent(eventName, { detail }));
    }
  }

  function requestOpenUpload() {
    dispatch(APP_EVENTS.openTranslationWorkflow, { mode: TRANSLATION_WORKFLOW_MODES.UPLOAD });
  }

  // Đóng = đóng hộp thoại trực tiếp, một cú nhấp là xong (bất kể đang ở trạng thái tải lên hay tiến độ nhiệm vụ).
  //
  // Cách đóng "hai giai đoạn" cũ (khi trạng thái hiển thị thì returnHome trước, hộp thoại không đóng, phải nhấp lần nữa mới thực sự đóng) bị
  // người dùng đánh giá là không đáp ứng kỳ vọng: nhấp vào × của tiến độ nhiệm vụ sẽ quay lại biểu mẫu tải lên trống "Dịch PDF",
  // đồng thời stopPolling âm thầm reset nhiệm vụ, giống như "nhấp đóng lại quay về bước trước". Bây giờ thống nhất thành "× = đóng".
  // Muốn hủy nhiệm vụ đang chạy có nút chuyên dụng "Hủy nhiệm vụ" trên StatusCard
  // (cancelCurrentJob), không cần dựa vào việc đóng hộp thoại để kiêm nhiệm.
  //
  // Đóng không ảnh hưởng đến nhiệm vụ nền: công cụ polling job-runtime độc lập với vòng đời gắn kết của hộp thoại,
  // khi nhiệm vụ đạt đến trạng thái cuối, controller.js sẽ tự động pollingPort.stop() (xem §renderJob trong tệp đó),
  // không vì đóng hộp thoại mà bỏ lỡ một polling thường trú; thẻ trong lưới thư viện vẫn sẽ hiển thị tiến độ thời gian thực của nhiệm vụ đó.
  function requestClose() {
    dispatch(APP_EVENTS.closeTranslationWorkflow);
  }

  function bindEvents() {
    if (!documentRef?.addEventListener) {
      return () => {};
    }
    const bindings: Array<[string, EventListener]> = [
      [APP_EVENTS.openTranslationWorkflow, openFromEvent as unknown as EventListener],
      [APP_EVENTS.closeTranslationWorkflow, close as EventListener],
      [APP_EVENTS.translationWorkflowSync, sync as EventListener],
      [APP_EVENTS.statusAreaVisibilityChanged, sync as EventListener],
    ];
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen()) {
        requestClose();
      }
    };
    bindings.forEach(([name, handler]) => documentRef.addEventListener(name, handler));
    documentRef.addEventListener("keydown", onKeydown);
    return () => {
      bindings.forEach(([name, handler]) => documentRef.removeEventListener(name, handler));
      documentRef.removeEventListener("keydown", onKeydown);
    };
  }

  return {
    bindEvents,
    close,
    isOpen,
    openFromEvent,
    openUpload,
    requestClose,
    requestOpenUpload,
    statePort: dialogStatePort,
    sync,
  };
}
