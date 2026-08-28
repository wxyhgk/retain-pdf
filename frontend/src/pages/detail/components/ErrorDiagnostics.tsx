// Thẻ context debug lỗi. #detail-failure-debug-context là "đảo imperative":
// nội dung được module cũ src/js/job-detail/failure.js (qua overview-renderer.js)
// ghi bằng innerHTML sau khi dữ liệu tải xong. Phía React dùng memo để cố định leaf container,
// không render node con động, nên re-render không chạm vào nội dung imperative.

import { memo } from "react";

export const ErrorDiagnostics = memo(function ErrorDiagnostics() {
  return (
    <article className="detail-card detail-card-wide">
      <h2>Context debug lỗi</h2>
      <div id="detail-failure-debug-context" className="detail-debug-context">
        <div className="detail-empty">Chưa có context lỗi có cấu trúc</div>
      </div>
    </article>
  );
});
