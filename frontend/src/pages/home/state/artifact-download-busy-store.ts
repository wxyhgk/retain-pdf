// Store trạng thái busy của artifact-downloads (bản thiết kế dialogs §7.5 phương án hai).
//
// Bối cảnh (bản thiết kế §0.5): artifact-downloads là ủy quyền nhấp ở cấp document + hàm mệnh lệnh
// setLinkBusy (thế giới cũ sửa trực tiếp văn bản/class của DOM). Nơi chứa nút nằm rải rác ở
// ResultActions.jsx của recent-jobs và StatusDetailDialog.jsx của miền này — tổ tiên của cả hai (StatusCard/
// bản thân StatusDetailDialog) đều gắn trên luồng polling/store update tần suất cao, nếu giữa chừng component cha
// re-render do thay đổi trường không liên quan, virtual DOM diff sẽ ghi đè và làm mất đoạn văn bản "Đang tải.../37%"
// ghi theo kiểu mệnh lệnh, đưa nút về label gốc. Phương án hai: setLinkBusy không sửa trực tiếp DOM nữa mà chỉ ghi vào store này;
// các component nút tự subscribe vào slice actionId của riêng mình (use-artifact-download-busy.js),
// label hoàn toàn đến từ React state, re-render không bị ghi đè (vì bản thân state đã là giá trị mới nhất).
//
// Mối quan hệ với src/js/features/artifact-downloads/download-view-port.js của thế giới cũ:
// Tệp cũ giữ nguyên (vẫn phục vụ cho dist/app.bundle.js chưa cutover, bản DOM mặc định
// setLinkBusy sửa trực tiếp text của thẻ <a> thật) — composition.js gắn thêm một instance
// viewPort riêng cho thế giới React, triển khai trực tiếp 3 phương thức bằng literal (không import view-port.js/view.js cũ:
// tên của hai tệp này khớp regex chống hồi quy của architecture-boundaries.test.mjs,
// cấm import vào src/pages/**), setLinkBusy ghi vào store này.
//
// Hình dạng state: { [actionId]: { busy: true, label } }; không chứa actionId nào nghĩa là hiện tại
// không busy. getState() chỉ thay đổi tham chiếu cấp cao nhất khi thực sự có biến đổi (cùng loại
// pub-sub tối giản như src/pages/home/state/dialog-store.js), có thể truyền trực tiếp vào
// useSyncExternalStore mà không kích hoạt re-render vô tận (không dính bẫy clone mỗi lần của getSnapshot trong app-framework/store.js).

export type ArtifactBusySlice = {
  busy: boolean;
  label: string;
};

export type ArtifactDownloadBusyState = Record<string, ArtifactBusySlice>;

export type ArtifactDownloadBusyStore = {
  subscribe: (listener: (state: ArtifactDownloadBusyState) => void) => () => void;
  getState: () => ArtifactDownloadBusyState;
  getActionState: (actionId: string) => ArtifactBusySlice;
  setBusy: (actionId: string, busy: boolean, label?: string) => void;
  isBusy: (actionId: string) => boolean;
};

const IDLE: ArtifactBusySlice = Object.freeze({ busy: false, label: "" });

export function createArtifactDownloadBusyStore(): ArtifactDownloadBusyStore {
  let state: ArtifactDownloadBusyState = {};
  const listeners = new Set<(state: ArtifactDownloadBusyState) => void>();

  function notify() {
    listeners.forEach((listener) => listener(state));
  }

  return {
    // Tương thích useSyncExternalStore: subscribe trả về hàm unsubscribe
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getState: () => state,
    // Lấy một slice theo actionId; khi khớp cùng một actionId và chưa thay đổi thì trả về cùng một tham chiếu
    // đối tượng (setBusy với các actionId không liên quan là phép spread nông thuần túy, không chạm vào
    // tham chiếu giá trị của các key khác) — kết hợp với use-artifact-download-busy.js để re-render chính xác cấp nút.
    getActionState(actionId) {
      return state[`${actionId || ""}`.trim()] || IDLE;
    },
    setBusy(actionId, busy, label = "") {
      const id = `${actionId || ""}`.trim();
      if (!id) {
        return;
      }
      if (!busy) {
        if (!(id in state)) {
          return;
        }
        const next = { ...state };
        delete next[id];
        state = next;
        notify();
        return;
      }
      state = { ...state, [id]: { busy: true, label: `${label || ""}` } };
      notify();
    },
    isBusy(actionId) {
      return Boolean(state[`${actionId || ""}`.trim()]?.busy);
    },
  };
}

export const ARTIFACT_DOWNLOAD_BUSY_IDLE = IDLE;
