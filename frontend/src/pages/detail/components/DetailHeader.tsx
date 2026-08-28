// Khu hero của trang detail: tiêu đề/ghi chú chia sẻ, bốn link hành động, nút khôi phục checkpoint, metadata tác vụ.
// Cấu trúc DOM và class name bê nguyên từ detail.html cũ để giữ parity pixel.
//
// Lưu ý: disabled của #detail-rerun-btn được logic thế giới cũ (overview-renderer.js /
// resume.js bindRerunButton) quản lý imperative sau khi mount; JSX luôn render disabled,
// các lần re-render sau của React không chạm vào nó (virtual DOM không diff), nên ghi imperative được giữ lại.

import { MetaRow } from "./JobSummaryCard.jsx";

function ActionLink({ id, link, onClick, children }: any) {
  const enabled = Boolean(link?.enabled);
  const href = enabled && link?.url ? link.url : "#";
  return (
    <a
      id={id}
      className={enabled ? "button-link secondary" : "button-link secondary disabled"}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-disabled={link ? !enabled : undefined}
      onClick={onClick}
    >
      {children}
    </a>
  );
}

export function DetailHeader({ t, links, onProtectedDownload }) {
  return (
    <section className="detail-hero">
      <div className="detail-hero-top">
        <div>
          <h1>Chi tiết tác vụ</h1>
          <p id="detail-head-note">{t("detail-head-note", "Dùng `detail.html?job_id=...` để chia sẻ trực tiếp chi tiết tác vụ hiện tại.")}</p>
        </div>
        <div className="detail-actions">
          <ActionLink id="detail-reader-btn" link={links["detail-reader-btn"]}>Đọc đối chiếu</ActionLink>
          <ActionLink
            id="detail-pdf-btn"
            link={links["detail-pdf-btn"]}
            onClick={onProtectedDownload((jobId) => `${jobId}.pdf`)}
          >
            Tải PDF
          </ActionLink>
          <ActionLink
            id="detail-markdown-raw-btn"
            link={links["detail-markdown-raw-btn"]}
            onClick={onProtectedDownload((jobId) => `${jobId}.md`)}
          >
            Markdown
          </ActionLink>
          <ActionLink
            id="detail-markdown-json-btn"
            link={links["detail-markdown-json-btn"]}
            onClick={onProtectedDownload((jobId) => `${jobId}-markdown.json`)}
          >
            Markdown JSON
          </ActionLink>
        </div>
      </div>
      <div className="detail-task-actions" aria-label="Thao tác tác vụ">
        <button id="detail-rerun-btn" type="button" className="detail-trigger-btn" disabled>Khôi phục checkpoint / chạy lại</button>
        <span id="detail-rerun-status" className="detail-inline-note">{t("detail-rerun-status", "Tác vụ hiện chưa thể khôi phục.")}</span>
      </div>
      <div className="detail-meta-list">
        <MetaRow label="Job ID" id="detail-job-id" mono value={t("detail-job-id")} />
        <MetaRow label="Tóm tắt trạng thái" id="detail-status-summary" value={t("detail-status-summary")} />
        <MetaRow label="Giai đoạn hiện tại" id="detail-stage-detail" value={t("detail-stage-detail")} />
        <MetaRow label="Thời gian hoàn tất" id="detail-finished-at" value={t("detail-finished-at")} />
      </div>
    </section>
  );
}
