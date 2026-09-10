// 翻译调试:状态筛选 + 检索输入(受控草稿态,点击"刷新"或回车才提交
// applyTranslationFilter——镜像旧世界 readTranslationFilterQuery 只在提交时
// 读一次表单值的语义,不是每个按键都请求)。

import { useState } from "react";
import { STATUS_DETAIL_DIALOG_IDS } from "../domain/status-detail-dom-ids.js";

const FINAL_STATUS_OPTIONS = [
  { value: "", label: "全部" },
  { value: "translated", label: "已翻译" },
  { value: "partially_translated", label: "部分翻译" },
  { value: "kept_origin", label: "保留原文" },
  { value: "failed", label: "失败" },
];

export function TranslationFilterPanel({ query, onApply }) {
  const [finalStatus, setFinalStatus] = useState(query.finalStatus || "");
  const [q, setQ] = useState(query.q || "");
  const ids = STATUS_DETAIL_DIALOG_IDS.translation;

  function submit() {
    onApply({ finalStatus: finalStatus.trim(), q: q.trim() });
  }

  return (
    <section className="translation-filter-panel">
      <div className="translation-filter-row">
        <label className="translation-filter-field">
          <span className="label">状态</span>
          <select
            id={ids.filterFinalStatus}
            value={finalStatus}
            onChange={(event) => setFinalStatus(event.target.value)}
          >
            {FINAL_STATUS_OPTIONS.map((option) => (
              <option key={option.value || "all"} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="translation-filter-field translation-filter-search">
          <span className="label">检索</span>
          <input
            id={ids.filterQuery}
            type="search"
            placeholder="输入 item_id、路由、原文片段"
            value={q}
            onChange={(event) => setQ(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submit();
              }
            }}
          />
        </label>
        <button id={ids.filterApply} type="button" className="button-link secondary" onClick={submit}>刷新</button>
      </div>
    </section>
  );
}
