// 元信息卡片:「运行信息」「失败诊断」共用的 label/value 行式卡片,
// 以及「提示 / 错误」纯文本卡片。类名与旧 detail.html 完全一致。

import type { ReactNode } from "react";

/** 详情页文案读取器（DetailApp 的 t）：按节点 id 取文案，取不到用 fallback */
export type DetailText = (id: string, fallback?: string) => ReactNode;

export function MetaRow({
  label,
  id,
  mono = false,
  value,
}: {
  label: string;
  id: string;
  mono?: boolean;
  value: ReactNode;
}) {
  return (
    <div className="detail-meta-row">
      <span className="label">{label}</span>
      <span id={id} className={mono ? "value mono" : "value"}>{value}</span>
    </div>
  );
}

export function JobSummaryCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <article className="detail-card">
      <h2>{title}</h2>
      <div className="detail-meta-list">
        {children}
      </div>
    </article>
  );
}

export function ErrorNoticeCard({ t }: { t: DetailText }) {
  return (
    <article className="detail-card">
      <h2>提示 / 错误</h2>
      <pre id="detail-error-box" className="detail-log">{t("detail-error-box")}</pre>
    </article>
  );
}
