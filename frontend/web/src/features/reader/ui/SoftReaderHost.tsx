// 主页内全屏阅读层：iframe 载入 reader.html，主页不卸载。
// 关闭：子页 postMessage → history.back → popstate 卸层。

import { useEffect, useState } from "react";
import {
  SOFT_READER_CLOSE_MESSAGE,
  SOFT_READER_FORCE_CLOSE_EVENT,
  SOFT_READER_OPEN_EVENT,
  closeSoftReaderOnHost,
  isSoftReaderHistoryState,
} from "@/platform/navigation/soft-reader.js";

export function SoftReaderHost() {
  const [frame, setFrame] = useState<{ url: string; nonce: number } | null>(null);

  useEffect(() => {
    function openUrl(nextUrl: string, nonce = Date.now()) {
      const next = `${nextUrl || ""}`.trim();
      if (!next) return;
      // 强制换 key 重挂 iframe，避免同 URL 二次打开仍空白
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
      // 子页已经建立 closing 栅栏；父页同步结束 iframe 生命周期，避免
      // 等待 history popstate 期间仍显示任何迟到的 Reader 状态。
      setFrame(null);
      closeSoftReaderOnHost();
    }

    window.addEventListener(SOFT_READER_OPEN_EVENT, onOpen as EventListener);
    window.addEventListener(SOFT_READER_FORCE_CLOSE_EVENT, onForceClose);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("message", onMessage);

    // 前进/后退恢复
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
      aria-label="阅读器"
      data-soft-reader-url={frame.url}
    >
      <iframe
        id="soft-reader-frame"
        key={`${frame.nonce}:${frame.url}`}
        className="soft-reader-frame"
        title="阅读器"
        src={frame.url}
        // 允许同源脚本；阅读器在 iframe 内跑自己的 bundle
      />
    </div>
  );
}
