// Host cho toast tiến độ tải xuống (Giai đoạn B: cải tạo shadcn, loại bỏ 3 bản
// DownloadToastHost.jsx copy-paste giống hệt nhau — 3 file cũ ở home/reader/detail đã bị xóa,
// tất cả chuyển sang dùng bản triển khai chia sẻ này).
//
// Contract giao diện không đổi: chi tiết triển khai private của src/js/utils/download-feedback.js là
// `document.querySelector("download-toast").setState(state)/.hide()` —
// bản thân file đó không nằm trong phạm vi cải tạo lần này, và cũng không có bên gọi nào khác phụ thuộc trực tiếp vào cấu trúc DOM, chỉ thông qua
// showDownloadToast/showDownloadPreparing/updateDownloadProgress/
// completeDownloadToast/failDownloadToast các hàm export này tiêu thụ gián tiếp, nên ở đây
// tiếp tục render một element placeholder `<download-toast>` và gán phương thức setState/hide (dùng ref tương tự 3
// file cũ), bên tiêu thụ không cần thay đổi.
//
// Render nội bộ chuyển sang dùng Sonner (Toaster trong src/components/ui/sonner.jsx):
// setState/hide không còn manually querySelector để sửa text DOM, mà gọi
// toast.custom(..., { id: TOAST_ID, duration: Infinity }) / toast.dismiss(...)。
// Cấu trúc nội bộ card/id(#download-toast-title v.v.)/class(download-toast-card v.v.)
// được giữ nguyên (tests/artifact-downloads-react.test.mjs assert text tiêu đề toast theo id,
// về mặt thị giác cũng tái sử dụng CSS cũ, không chấp nhận skin mặc định của Sonner) — chỉ có định vị fixed/layer/
// animation vào trường giao cho <Toaster/> của Sonner quản lý (quy tắc định vị fixed của vỏ download-toast trong src/styles/components.utilities.css
// đã bị loại bỏ, lý do xem chú thích trong file đó).
// Sonner mặc định không áp dụng skin card của chính nó cho nội dung render bởi toast.custom()
// (data-styled được quyết định bởi sự tồn tại của toast.jsx, xem source node_modules/sonner),
// nên hai hệ thống thị giác sẽ không xung đột.

import { useCallback } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner.jsx";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "download-toast": any;
    }
  }
}

const TOAST_ID = "download-toast";

function DownloadToastCard({
  title = "Đang tải xuống",
  status = "Đang chuẩn bị...",
  meta = "Đang đợi phản hồi...",
  percent = NaN,
  tone = "progress",
}) {
  const width = Number.isFinite(percent)
    ? Math.max(4, Math.min(100, Number(percent) || 0))
    : 18;
  return (
    <div className="download-toast-card" data-tone={tone} aria-live="polite">
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
      title = "Đang tải xuống",
      status = "Đang chuẩn bị...",
      meta = "Đang đợi phản hồi...",
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
      {/* Placeholder truy vấn của download-feedback.js, không tham gia render
          (Sonner phụ trách UI thực tế). */}
      <download-toast style={{ display: "none" }} aria-hidden="true" ref={attach} />
    </>
  );
}
