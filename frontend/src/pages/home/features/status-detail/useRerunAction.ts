// Ràng buộc nút "khôi phục từ điểm dừng / chạy lại" của tab thất bại (bản thiết kế
// §1.2). resume-actions.js (giữ lại) đã tính enabled/status rồi ghi vào
// overview.rerun, ở đây chỉ tổ hợp disabled = !enabled || rerunPending và phát
// sự kiện bấm, không tính lại.

export function useRerunAction({ overview, rerunPending, controller }) {
  const rerun = overview.rerun || { enabled: false, status: "" };
  return {
    enabled: Boolean(rerun.enabled),
    status: rerun.status || "",
    disabled: !rerun.enabled || Boolean(rerunPending),
    run: () => controller.rerunCurrentJob(),
  };
}
