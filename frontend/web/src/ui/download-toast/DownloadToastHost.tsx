// 下载进度 toast 宿主(阶段 B:shadcn 改造,消灭 3 份逐字节相同的
// DownloadToastHost.jsx 复制粘贴——home/reader/detail 三份旧文件已删除,
// 全部改用这一份共享实现)。
//
// 接口契约不变:src/js/utils/download-feedback.js 的私有实现细节是
// `document.querySelector("download-toast").setState(state)/.hide()`——
// 该文件本身不在本次改造范围内,也没有任何其他调用方直接依赖 DOM 结构,只经由
// showDownloadToast/showDownloadPreparing/updateDownloadProgress/
// completeDownloadToast/failDownloadToast 这几个导出函数间接消费,因此这里
// 继续渲染一个 `<download-toast>` 占位元素并挂 setState/hide 方法(与旧 3
// 份文件同样的 ref 手法),消费方零改动。
//
// 内部渲染改用 Sonner(src/components/ui/sonner.jsx 的 <Toaster/>):
// setState/hide 不再手动 querySelector 改 DOM 文本,而是调用
// toast.custom(..., { id: TOAST_ID, duration: Infinity }) / toast.dismiss(...)。
// 卡片内部结构/id(#download-toast-title 等)/class(download-toast-card 等)
// 原样保留(tests/artifact-downloads-react.test.mjs 按 id 断言 toast 标题文本,
// 视觉上也复用原有 CSS,不接受 Sonner 默认皮肤)——只是外层的固定定位/层级/
// 入场动画交给 Sonner 的 <Toaster/> 负责(src/styles/components.utilities.css
// 里 download-toast 外壳的 fixed 定位规则已随之退役,理由见该文件注释)。
// Sonner 对 toast.custom() 渲染的内容默认不套用它自己的卡片皮肤
// (data-styled 由 toast.jsx 存在与否决定,见 node_modules/sonner 源码),
// 所以两套视觉不会打架。

import { useCallback } from "react";
import { toast } from "sonner";
import { Toaster } from "@retainpdf/ui";

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
    <div className="download-toast-card app-floating-surface" data-tone={tone} aria-live="polite">
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
  const attach = useCallback((host) => {
    if (!host) {
      return;
    }
    host.setState = applyToastState;
    host.hide = () => toast.dismiss(TOAST_ID);
  }, []);

  return (
    <>
      <Toaster position="bottom-right" />
      {/* download-feedback.js 的查询占位,不参与渲染(Sonner 负责实际可见 UI)。 */}
      <download-toast style={{ display: "none" }} aria-hidden="true" ref={attach} />
    </>
  );
}
