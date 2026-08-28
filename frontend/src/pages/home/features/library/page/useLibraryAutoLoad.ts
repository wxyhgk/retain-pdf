// Tải tự động khi cuộn lưới thư viện (bản thiết kế §2 features/library/).
//
// Phán đoán hình học viết lại từ shouldAutoLoadRecentJobs của host-actions.js (ngưỡng 260px / 0.35,
// không import — file cũ thuộc danh sách "chết (cutover xóa)", viết lại tại chỗ ~10 dòng theo
// mô tả bản thiết kế thay vì tái sử dụng). Có hai cổng kích hoạt, đều quy về cùng check():
// 1. Lắng nghe passive scroll của vùng cuộn (người dùng cuộn tay đến đáy);
// 2. refresh-scheduler.js gọi scheduleAutoLoadIfNeeded sau mỗi lần phân trang →
//    viewPort.scheduleAutoLoadCheck({isSuspended}) — nối qua
//    react-view-port.js's registerAutoLoadChecker (sau khi nội dung đổi mà chưa đầy
//    một màn hình, cần tự động tải trang tiếp theo).
//
// Lệnh loadMore thống nhất đi qua viewPort.handlersRef.current.onLoadMore (bindings.js
// gắn là () => runtime.loadRecentJobs({reset:false})), không gọi thẳng runtime — giữ
// chung đường với nút "Thêm", tránh hai đường tải song song.

import { useCallback, useEffect } from "react";

const THRESHOLD_PX = 260;
const THRESHOLD_RATIO = 0.35;

export function useLibraryAutoLoad({ scrollBodyRef, hasMore, loadMoreLoading, viewPort }: any) {
  const check = useCallback(({ isSuspended }: any = {}) => {
    if (isSuspended?.() ?? viewPort.handlersRef.current.isSuspended?.()) {
      return;
    }
    if (!hasMore || loadMoreLoading) {
      return;
    }
    const scrollBody = scrollBodyRef.current;
    if (!scrollBody) {
      return;
    }
    const remaining = scrollBody.scrollHeight - scrollBody.scrollTop - scrollBody.clientHeight;
    const threshold = Math.max(THRESHOLD_PX, scrollBody.clientHeight * THRESHOLD_RATIO);
    if (remaining < threshold) {
      viewPort.handlersRef.current.onLoadMore?.();
    }
  }, [hasMore, loadMoreLoading, scrollBodyRef, viewPort]);

  // Nối chuỗi refresh-scheduler.js → viewPort.scheduleAutoLoadCheck
  useEffect(() => viewPort.registerAutoLoadChecker(check), [viewPort, check]);

  // Lắng nghe passive của chính vùng cuộn
  useEffect(() => {
    const scrollBody = scrollBodyRef.current;
    if (!scrollBody) {
      return undefined;
    }
    const onScroll = () => {
      if (viewPort.handlersRef.current.isSuspended?.()) {
        return;
      }
      requestAnimationFrame(() => check());
    };
    scrollBody.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollBody.removeEventListener("scroll", onScroll);
  }, [scrollBodyRef, viewPort, check]);
}
