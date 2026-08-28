// Lớp trình đọc toàn màn hình trong trang chính: iframe nạp reader.html, trang chính không
// gỡ. Đóng: trang con postMessage → history.back → popstate gỡ lớp.

import { useEffect, useState } from "react";
import {
  SOFT_READER_CLOSE_MESSAGE,
  SOFT_READER_FORCE_CLOSE_EVENT,
  SOFT_READER_OPEN_EVENT,
  closeSoftReaderOnHost,
  isSoftReaderHistoryState,
} from "../../../../shared/navigation/soft-reader.js";

export function SoftReaderHost() {
  const [frame, setFrame] = useState<{ url: string; nonce: number } | null>(null);

  useEffect(() => {
    function openUrl(nextUrl: string, nonce = Date.now()) {
      const next = `${nextUrl || ""}`.trim();
      if (!next) return;
      // Buộc đổi key để remount iframe, tránh mở lại cùng URL vẫn trắng
      setFrame({ url: next, nonce });
    }

    function onOpen(event: Event) {
      const detail = (event as CustomEvent)?.detail || {};
      const next = `${detail.url || ""}`.trim();
      const nonce = Number(detail.nonce) || Date.now();
      openUrl(next, nonce);
    }

    function onForceClose() {
      setFrame(null);
    }

    function onPopState() {
      if (isSoftReaderHistoryState(window.history.state) && window.history.state.readerUrl) {
        openUrl(window.history.state.readerUrl);
        return;
      }
      setFrame(null);
    }

    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== SOFT_READER_CLOSE_MESSAGE) return;
      closeSoftReaderOnHost();
    }

    window.addEventListener(SOFT_READER_OPEN_EVENT, onOpen as EventListener);
    window.addEventListener(SOFT_READER_FORCE_CLOSE_EVENT, onForceClose);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("message", onMessage);

    // Phục hồi khi tiến/lùi
    onPopState();

    return () => {
      window.removeEventListener(SOFT_READER_OPEN_EVENT, onOpen as EventListener);
      window.removeEventListener(SOFT_READER_FORCE_CLOSE_EVENT, onForceClose);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("message", onMessage);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("is-soft-reader-open", Boolean(frame));
    return () => {
      document.body.classList.remove("is-soft-reader-open");
    };
  }, [frame]);

  if (!frame) return null;

  return (
    <div
      id="soft-reader-host"
      className="soft-reader-host"
      role="dialog"
      aria-modal="true"
      aria-label="Trình đọc"
      data-soft-reader-url={frame.url}
    >
      <iframe
        id="soft-reader-frame"
        key={`${frame.nonce}:${frame.url}`}
        className="soft-reader-frame"
        title="Trình đọc"
        src={frame.url}
        // Cho phép script cùng nguồn; trình đọc chạy bundle của chính nó trong iframe
      />
    </div>
  );
}
