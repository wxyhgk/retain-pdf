// Reader "quay về trang chủ".
//
// 1) Mở mềm (iframe SoftReaderHost ở trang chủ) -> postMessage để parent history.back, trang chủ không refresh.
// 2) reader.html độc lập được assign từ trang chủ -> history.back.
// 3) Deep link trực tiếp -> location.assign(index.html).

import { X } from "lucide-react";
import { peekHomeReturnState } from "../../../../shared/navigation/home-return-state.js";
import { SOFT_READER_CLOSE_MESSAGE } from "../../../../shared/navigation/soft-reader.js";

function homeIndexUrl() {
  return new URL("./index.html", window.location.href).href;
}

function requestSoftHostClose(): boolean {
  if (typeof window === "undefined") return false;
  if (window.self === window.top) return false;
  try {
    window.parent.postMessage(
      { type: SOFT_READER_CLOSE_MESSAGE },
      window.location.origin,
    );
    return true;
  } catch {
    return false;
  }
}

/** Quay từ trang reader về trang chủ. */
export function navigateReaderToHome() {
  if (typeof window === "undefined") return;

  // Lớp đọc mềm: để parent tháo layer, tuyệt đối không assign trang chủ trong iframe.
  if (requestSoftHostClose()) {
    return;
  }

  const saved = peekHomeReturnState();
  if (saved?.allowBack && window.history.length > 1) {
    window.history.back();
    return;
  }

  try {
    const ref = document.referrer ? new URL(document.referrer) : null;
    if (
      ref
      && ref.origin === window.location.origin
      && !/reader\.html/i.test(ref.pathname)
      && window.history.length > 1
    ) {
      window.history.back();
      return;
    }
  } catch {
    /* ignore */
  }

  window.location.assign(homeIndexUrl());
}

export function ReaderCloseHome() {
  return (
    <button
      id="reader-close-home-btn"
      type="button"
      className="reader-close-home-btn"
      aria-label="Quay về trang chủ"
      title="Quay về trang chủ"
      onClick={navigateReaderToHome}
    >
      <X className="reader-close-home-icon" size={18} strokeWidth={2.25} aria-hidden />
      <span className="reader-close-home-label">Đóng</span>
    </button>
  );
}
