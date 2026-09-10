// 下载进度 toast 宿主（自包含版，从 frontend/web/src/shared/react/DownloadToastHost.tsx 复制）
// 已去 @/ 别名：Toaster 改为 sonner 直引，避免包内无 alias 解析

import { useCallback } from "react";
import { toast } from "sonner";
import { Toaster } from "sonner";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "download-toast": any;
    }
  }
}

const TOAST_ID = "download-toast";

function DownloadToastCard({
  title = "下载中",
  status = "正在准备...",
  meta = "等待响应...",
  percent = NaN,
  tone = "progress",
}) {
  const width = Number.isFinite(percent)
    ? Math.max(4, Math.min(100, Number(percent) || 0))
    : 18;
  return (
    <div className="download-toast-card reader-floating-surface" data-tone={tone} aria-live="polite">
      <div className="download-toast-head">
        <div id="download-toast-title" className="download-toast-title">{title}</div>
        <div id="download-toast-status" className="download-toast-status">{status}</div>
      </div>
      <div className="download-toast-track">
        <span id="download-toast-bar" className="download-toast-bar" style={{ width: `${width}%` }} />
      </div>
      <div id="download-toast-meta" className="download-toast-meta">{meta}</div>
    </div>
  );
}

function applyToastState(state: any = {}) {
  const {
    visible = false,
    title = "下载中",
    status = "正在准备...",
    meta = "等待响应...",
    percent = NaN,
    tone = "progress",
  } = state;
  if (!visible) {
    toast.dismiss(TOAST_ID);
    return;
  }
  toast.custom(
    () => <DownloadToastCard title={title} status={status} meta={meta} percent={percent} tone={tone} />,
    { id: TOAST_ID, duration: Infinity },
  );
}

export function DownloadToastHost() {
  const attach = useCallback((host: any) => {
    if (!host) {
      return;
    }
    host.setState = applyToastState;
    host.hide = () => toast.dismiss(TOAST_ID);
  }, []);

  return (
    <>
      <Toaster position="bottom-right" />
      <download-toast style={{ display: "none" }} aria-hidden="true" ref={attach} />
    </>
  );
}
