// Trang chính → điều hướng trang đọc (có thể inject, thuận tiện cho kiểm thử)
//
// Mặc định "mở mềm": history.pushState + lớp SoftReaderHost toàn màn hình, trang chính
// không gỡ. replace / tài liệu không phải trang chính / khác nguồn: vẫn location.replace|assign.

import { captureHomeReturnState } from "../../../../shared/navigation/home-return-state.js";
import { trySoftOpenReader } from "../../../../shared/navigation/soft-reader.js";

export type ReaderNavigateOptions = {
  replace?: boolean;
};

export type ReaderNavigateFn = (url: string, options?: ReaderNavigateOptions) => void;

const defaultNavigate: ReaderNavigateFn = (url, { replace = false } = {}) => {
  const target = `${url || ""}`.trim();
  if (!target) return;
  // Ghi lại vị trí cuộn; khi mở mềm trang chính vốn không gỡ, vẫn làm dự phòng
  captureHomeReturnState({ allowBack: !replace });
  // Ưu tiên mở mềm (khi SPA trang chính còn, dù thanh địa chỉ đã là reader.html cũng mở lại được)
  if (!replace && trySoftOpenReader(target)) {
    return;
  }
  if (replace) {
    // Khởi động sâu: cố mở mềm; thất bại mới cứng vào
    if (trySoftOpenReader(target)) {
      return;
    }
    window.location.replace(target);
    return;
  }
  // Trang reader độc lập / khác trang: vào nguyên trang
  window.location.assign(target);
};

let navigateImpl: ReaderNavigateFn = defaultNavigate;

/** Chỉ dùng cho kiểm thử: inject điều hướng giả, sau khi test truyền null để đặt lại */
export function setReaderNavigateForTests(fn: ReaderNavigateFn | null) {
  navigateImpl = fn || defaultNavigate;
}

export function navigateToReader(url: string, options: ReaderNavigateOptions = {}) {
  navigateImpl(url, options);
}
