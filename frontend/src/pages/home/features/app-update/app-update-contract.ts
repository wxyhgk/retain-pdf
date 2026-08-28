// ID và hợp đồng trạng thái của AppUpdateBanner (kế hoạch xây dựng §5 + §0.1).
//
// Sao chép từ src/js/components/layout/app-update-dom-contract.js (lớp custom elements cũ,
// architecture-boundaries cấm src/pages/** import trực tiếp từ js/components/)
// - cùng cách tiếp cận đã dùng trong Giai đoạn 3a tại
// src/pages/home/features/app-shell/app-update-contract.js (khi đó chỉ cần IDS,
// dialog thông báo tạm treo bộ khung trong AppShellHeader.jsx). Tài liệu này hoàn thiện
// STATES/CLASSES, là nguồn duy nhất cho vùng app-update 3b (nút + dialog thông báo hợp nhất vào
// AppUpdateBanner.jsx); bản sao một phần 3a được dọn dẹp cùng với việc xóa template trong AppShellHeader,
// không để lại hai hợp đồng trùng lặp.

export const APP_UPDATE_IDS = Object.freeze({
  button: "app-update-btn",
  dialog: "app-update-dialog",
  status: "app-update-status",
  checkButton: "app-update-check-btn",
});

export const APP_UPDATE_STATES = Object.freeze({
  checking: "checking",
  idle: "idle",
  available: "available",
  latest: "latest",
  error: "error",
});

export const APP_UPDATE_CLASSES = Object.freeze({
  hidden: "hidden",
  hasUpdate: "has-update",
});
