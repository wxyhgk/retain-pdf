// 用量的共用展示：主要数字一排，下面按需显示按阶段 / 按模型 / 按月的条形列表和说明。
// 书籍详情的「用量」卡和设置里的「总用量」都用它。
import type { UsageGroup, UsageRow, UsageViewModel } from "../domain/usage-view-model.js";

function Bars({ rows, label }: { rows: UsageRow[]; label: string }) {
  if (!rows.length) return null;
  return (
    <ol className="usage-bars" aria-label={label}>
      {rows.map((row) => (
        <li key={row.key} className="usage-bar-row">
          <span className="usage-bar-label">
            {row.label}
            {row.hint ? <small>{row.hint}</small> : null}
          </span>
          <span className="usage-bar-track" aria-hidden="true">
            <span className="usage-bar-fill" style={{ width: `${Math.max(2, Math.round(row.share * 100))}%` }} />
          </span>
          <span className="usage-bar-value" title={`${row.exact} token`}>{row.value}</span>
        </li>
      ))}
    </ol>
  );
}

function StageGroups({ groups }: { groups: UsageGroup[] }) {
  if (!groups.length) return null;
  return (
    <div className="usage-section" data-usage-section="stages">
      <h4>按环节</h4>
      {groups.map((group) => (
        <div key={group.key} className="usage-group" data-usage-group={group.key}>
          <div className="usage-group-head">
            <strong>{group.label}</strong>
            <span title={`${group.exact} token`}>{group.value}</span>
          </div>
          {group.rows.length > 1 ? <Bars rows={group.rows} label={`${group.label}各环节`} /> : null}
        </div>
      ))}
    </div>
  );
}

export function UsageSummary({
  model,
  show = ["stages"],
}: {
  model: UsageViewModel;
  show?: ReadonlyArray<"stages" | "models" | "months">;
}) {
  return (
    <div className="usage-summary" data-usage-summary="true">
      <dl className="usage-metrics">
        {model.metrics.map((metric) => (
          <div key={metric.key} className={`usage-metric${metric.emphasis ? " is-emphasis" : ""}`} data-usage-metric={metric.key}>
            <dt>{metric.label}</dt>
            <dd title={metric.exact ? `${metric.exact} token` : undefined}>{metric.value}</dd>
            {metric.note ? <span className="usage-metric-note">{metric.note}</span> : null}
          </div>
        ))}
      </dl>
      {show.includes("months") && model.months.length ? (
        <div className="usage-section" data-usage-section="months">
          <h4>按月</h4>
          <Bars rows={model.months} label="按月用量" />
        </div>
      ) : null}
      {show.includes("models") && model.models.length ? (
        <div className="usage-section" data-usage-section="models">
          <h4>按模型</h4>
          <Bars rows={model.models} label="按模型用量" />
        </div>
      ) : null}
      {show.includes("stages") ? <StageGroups groups={model.stageGroups} /> : null}
      {model.notes.length ? (
        <ul className="usage-notes">
          {model.notes.map((note) => <li key={note}>{note}</li>)}
        </ul>
      ) : null}
    </div>
  );
}
