// Thẻ danh sách artifact + thẻ xem trước Markdown.
//
// #detail-artifacts-summary / #detail-artifacts-list và
// #detail-markdown-image-grid / #detail-markdown-image-empty là "đảo imperative":
// nội dung được module cũ src/js/job-detail/artifacts.js (qua overview-renderer.js /
// markdown-flow.js) ghi bằng innerHTML / classList sau khi dữ liệu tải xong. Phía React chỉ render
// khung tĩnh ban đầu giống detail.html cũ, virtual DOM giữ cố định nên re-render không ghi đè
// phần imperative. Các text field còn lại của thẻ Markdown đi qua adapter setText (React state).

import { memo } from "react";
import { MetaRow } from "./JobSummaryCard.jsx";

export const ArtifactsSection = memo(function ArtifactsSection() {
  return (
    <article className="detail-card">
      <div className="detail-trigger-head">
        <h2>Danh sách artifact</h2>
        <span id="detail-artifacts-summary" className="detail-inline-note">Chưa tải</span>
      </div>
      <div id="detail-artifacts-list" className="detail-artifact-list">
        <div className="detail-empty">Chưa có danh sách artifact</div>
      </div>
    </article>
  );
});

const MarkdownImageIsland = memo(function MarkdownImageIsland() {
  return (
    <>
      <div id="detail-markdown-image-grid" className="detail-markdown-image-grid hidden"></div>
      <div id="detail-markdown-image-empty" className="detail-empty">Chưa có tham chiếu ảnh Markdown</div>
    </>
  );
});

export function MarkdownCard({ t }) {
  return (
    <article className="detail-card">
      <div className="detail-trigger-head">
        <h2>Xem trước Markdown</h2>
        <span id="detail-markdown-status" className="detail-inline-note">{t("detail-markdown-status", "Chưa yêu cầu")}</span>
      </div>
      <div className="detail-meta-list">
        <MetaRow label="Endpoint JSON" id="detail-markdown-json-url" mono value={t("detail-markdown-json-url")} />
        <MetaRow label="Endpoint raw" id="detail-markdown-raw-url" mono value={t("detail-markdown-raw-url")} />
        <MetaRow label="Images Base URL" id="detail-markdown-images-base-url" mono value={t("detail-markdown-images-base-url")} />
        <MetaRow label="Số tham chiếu ảnh" id="detail-markdown-image-count" value={t("detail-markdown-image-count")} />
      </div>
      <MarkdownImageIsland />
      <pre id="detail-markdown-preview" className="detail-log">{t("detail-markdown-preview")}</pre>
    </article>
  );
}
