// 阅读器「返回主页」
//
// 1) 软打开（主页 SoftReaderHost iframe）→ postMessage 父页 history.back，主页不刷新
// 2) 独立 reader.html 且从主页 assign 进来 → history.back
// 3) 深链直达 → location.assign(index.html)

import { X } from "lucide-react";
import { SOFT_READER_CLOSE_MESSAGE } from "../../shared/navigation/soft-reader.js";

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

export function canReturnToReaderReferrer(
  referrer: string,
  currentHref: string,
  historyLength: number,
): boolean {
  if (historyLength <= 1 || !referrer) return false;
  try {
    const current = new URL(currentHref);
    const previous = new URL(referrer, current);
    return previous.origin === current.origin
      && !/reader\.html$/i.test(previous.pathname)
      && !/detail\.html$/i.test(previous.pathname);
  } catch {
    return false;
  }
}

/** 从阅读页回主页 */
export function navigateReaderToHome() {
  if (typeof window === "undefined") return;

  // 软阅读层：让父页卸层，绝不在 iframe 里 assign 主页
  if (requestSoftHostClose()) {
    return;
  }

  // history.length alone is not proof that the previous entry is RetainPDF.
  // A stale home-return session record could previously send a deep-linked
  // Reader tab to an unrelated or blank page. Only use back when the browser's
  // actual referrer is a same-origin home route.
  if (canReturnToReaderReferrer(
    document.referrer,
    window.location.href,
    window.history.length,
  )) {
    window.history.back();
    return;
  }

  window.location.assign(homeIndexUrl());
}

export function ReaderCloseHome({ onBeforeClose }: { onBeforeClose?: () => void } = {}) {
  const close = () => {
    onBeforeClose?.();
    navigateReaderToHome();
  };

  return (
    <button
      id="reader-close-home-btn"
      type="button"
      className="reader-close-home-btn"
      aria-label="返回主页"
      title="返回主页"
      onClick={close}
    >
      <X className="reader-close-home-icon" size={18} strokeWidth={2.25} aria-hidden />
      <span className="reader-close-home-label">关闭</span>
    </button>
  );
}
