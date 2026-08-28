// Store đăng ký văn bản (id → văn bản) của trang home.
//
// setText(id, value) của ui/text.js thế giới cũ là đầu vào ghi DOM toàn cục; thế giới
// React đổi thành ghi vào store này, do component đăng ký id tương ứng tự render.
// Giai đoạn 3a chỉ có error-box (inline-error-box) tiêu thụ; id của các miền
// status-detail/job-runtime v.v. ở 3b rơi vào store trước chờ component giữ chỗ
// tiếp quản — vì vậy giao diện callback setText giữ ổn định với 3b.
//
// Quy ước đặc biệt (ánh theo ui/text.js): value của "error-box" cho phép là đối tượng
// error-diagnostic, tầng trình bày dùng messageForErrorBox trích tóm tắt; ở đây lưu
// nguyên bản, do component diễn giải.

import { createStore, type Store } from "../../../js/app-framework/store.js";

/** Hình dạng trả về của error-diagnostics.buildErrorDiagnostic */
export type ErrorDiagnosticText = {
  kind: "error-diagnostic";
  summary?: string;
  diagnostic?: string;
  [key: string]: unknown;
};

/**
 * Giá trị vị trí văn bản: chuỗi thường, đối tượng chẩn đoán error-box, hoặc tải trọng
 * trình bày khác. Dùng unknown để thu hẹp, tránh any; ErrorDiagnosticText để tầng trình
 * bày thu hẹp.
 */
export type HomeTextValue = unknown;

export type HomeTextState = {
  texts: Record<string, HomeTextValue>;
};

export type HomeTextActions = {
  set(
    currentState: HomeTextState,
    payload?: { id?: string; value?: HomeTextValue },
  ): HomeTextState;
};

export type HomeTextStore = Store<HomeTextState, HomeTextActions>;

export function createHomeTextStore() {
  const store = createStore<HomeTextState, HomeTextActions>({
    name: "homeTextRegistry",
    initialState: { texts: {} },
    actions: {
      set(currentState, { id, value } = {}) {
        if (!id) {
          return currentState;
        }
        return {
          ...currentState,
          texts: {
            ...currentState.texts,
            [id]: value,
          },
        };
      },
    },
  });

  function setText(id: string, value: HomeTextValue = undefined) {
    if (!id) {
      return;
    }
    store.actions.set({ id, value });
  }

  // Hàm trợ giúp selector: dùng với useStoreSnapshot(store, selector)
  function textOf(
    snapshot: HomeTextState | null | undefined,
    id: string,
    fallback: HomeTextValue = "",
  ): HomeTextValue {
    const value = snapshot?.texts?.[id];
    return value === undefined ? fallback : value;
  }

  return {
    setText,
    store,
    textOf,
  };
}
