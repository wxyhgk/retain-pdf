import {
  stringifyPretty,
} from "../domain/dialog/formatters.js";

// 翻译调试详情/重放面板共用的两个小展示块——JSX 重写
// features/status-detail/formatters.js 的 renderField/renderTextBlock(两者
// 都是 markup 拼接,蓝图 §1.1 判死;stringifyPretty 是纯格式化函数,保留
// 直接 import)。

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
