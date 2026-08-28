// Thẻ metadata: thẻ label/value dùng chung cho "Thông tin chạy" và "Chẩn đoán lỗi",
// cùng thẻ text thuần "Gợi ý / lỗi". Class name giữ khớp hoàn toàn với detail.html cũ.

export function MetaRow({ label, id, mono = false, value }) {
  return (
    <div className="detail-meta-row">
      <span className="label">{label}</span>
      <span id={id} className={mono ? "value mono" : "value"}>{value}</span>
    </div>
  );
}

export function JobSummaryCard({ title, children }) {
  return (
    <article className="detail-card">
      <h2>{title}</h2>
      <div className="detail-meta-list">
        {children}
      </div>
    </article>
  );
}

export function ErrorNoticeCard({ t }) {
  return (
    <article className="detail-card">
      <h2>Gợi ý / lỗi</h2>
      <pre id="detail-error-box" className="detail-log">{t("detail-error-box")}</pre>
    </article>
  );
}
