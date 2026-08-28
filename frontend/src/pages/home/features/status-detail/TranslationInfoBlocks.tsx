import { stringifyPretty } from "../../composition/external.js";

// Hai khối trình bày nhỏ dùng chung cho panel chi tiết/phát lại gỡ lỗi dịch — viết lại
// JSX cho renderField/renderTextBlock của features/status-detail/formatters.js
// (cả hai đều nối markup, bản thiết kế §1.1 đã chấm; stringifyPretty là hàm định dạng
// thuần, giữ import trực tiếp).

export function InfoRow({ label, value }) {
  return (
    <div className="info-row translation-detail-row">
      <span className="label">{label}</span>
      <span className="info-value">{value}</span>
    </div>
  );
}

export function TextBlock({ label, value }) {
  return (
    <section className="translation-text-block">
      <div className="translation-debug-subhead">
        <h4>{label}</h4>
      </div>
      <pre>{stringifyPretty(value)}</pre>
    </section>
  );
}
