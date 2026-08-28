// Sau khi quay lại trang chính từ trình đọc: khôi phục vị trí cuộn của tab.
// - bfcache (pageshow.persisted): DOM nguyên vẹn, chỉ cần xóa pending là đủ
// - reload thường: đợi danh sách có dữ liệu rồi mới apply scroll (tránh ghi scrollTop
//   vô hiệu khi chiều cao bằng 0)

import { useEffect, useRef } from "react";
import {
  applyHomeReturnScroll,
  clearHomeReturnState,
  consumeHomeReturnState,
  peekHomeReturnState,
  type HomeReturnState,
} from "../../../../../shared/navigation/home-return-state.js";

export function readInitialLibraryTabFromReturn(): string {
  const state = peekHomeReturnState();
  const tab = `${state?.activeTab || ""}`;
  if (
    tab === "categories"
    || tab === "favorites"
    || tab === "library"
    || tab === "ask"
  ) {
    return tab;
  }
  return "library";
}

/**
 * @param ready Khôi phục cuộn khi danh sách thư viện đã có nội dung (hoặc view bộ sưu tập/
 *              yêu thích đã mount)
 */
export function useHomeReturnRestore(ready: boolean) {
  const restoredRef = useRef(false);

  // bfcache: trang đánh thức nguyên xi từ bộ đệm, cuộn vốn còn nguyên, bỏ pending tránh
  // nhảy lần hai
  useEffect(() => {
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        clearHomeReturnState();
        restoredRef.current = true;
      }
    }
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, []);

  useEffect(() => {
    if (!ready || restoredRef.current) return;

    let state: HomeReturnState | null = peekHomeReturnState();
    if (!state) {
      restoredRef.current = true;
      return;
    }
    // Không có cuộn hợp lệ cũng xóa, tránh dữ liệu bẩn
    if (
      state.libraryScrollTop <= 0
      && state.panelScrollTop <= 0
      && state.windowScrollY <= 0
    ) {
      clearHomeReturnState();
      restoredRef.current = true;
      return;
    }

    restoredRef.current = true;
    state = consumeHomeReturnState();
    if (!state) return;

    // Hai rAF: chờ bố cục / giữ chỗ ảnh ổn định rồi đặt scrollTop
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        applyHomeReturnScroll(state!);
        // Danh sách tăng chiều cao bất đồng bộ thì bù thêm lần nữa
        window.setTimeout(() => applyHomeReturnScroll(state!), 80);
        window.setTimeout(() => applyHomeReturnScroll(state!), 320);
      });
    });
  }, [ready]);
}
