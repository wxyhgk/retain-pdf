// 书籍详情「进度」页细节区的「用量」：一排带图标的数字（输入、输出、缓存命中、思考、合计），
// 下面按环节一行一条条形。数字的名字和精确值在悬停里，画面上只留图标和数。
// 以前这是右栏单独一个「用量」页签，五个数字各占一张小卡，标题都写成字。
import { ArrowDownToLine, ArrowUpFromLine, Brain, Info, Sigma, Zap } from "lucide-react";
import type { ComponentType } from "react";
import { Button } from "@retainpdf/ui";

import type { UsageMetric, UsageViewModel } from "../domain/usage-view-model.js";

const METRIC_ICON: Record<string, ComponentType<{ "aria-hidden"?: boolean | "true" }>> = {
  input: ArrowDownToLine,
  output: ArrowUpFromLine,
  cache: Zap,
  reasoning: Brain,
  cache_write: Zap,
  total: Sigma,
};

function metricTitle(metric: UsageMetric): string {
  return [metric.label, metric.exact ? `${metric.exact} token` : metric.value, metric.note].filter(Boolean).join(" · ");
}

export function UsageCompact({
  model,
  loading = false,
  error = "",
  onRetry,
}: {
  model: UsageViewModel;
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
}) {
  if (error) {
    return (
      <p className="usage-compact-empty" role="alert">
        {error}
        {onRetry ? <Button variant="ghost" size="sm" onClick={onRetry}>重试</Button> : null}
      </p>
    );
  }
  if (model.empty) return <p className="usage-compact-empty">{loading ? "正在读取用量…" : "还没有用量记录"}</p>;
  // 「思考」为 0 时是「—」，什么也没说，不摆。
  const metrics = model.metrics.filter((metric) => !(metric.key === "reasoning" && !metric.exact));
  return (
    <div className="usage-compact" data-usage-summary="true">
      <ul className="usage-compact-metrics" aria-label="用量">
        {metrics.map((metric) => {
          const Icon = METRIC_ICON[metric.key] || Sigma;
          return (
            <li
              key={metric.key}
              className={`usage-compact-metric${metric.emphasis ? " is-emphasis" : ""}`}
              data-usage-metric={metric.key}
              title={metricTitle(metric)}
            >
              <Icon aria-hidden="true" />
              <span className="sr-only">{metric.label}</span>
              {metric.value}
            </li>
          );
        })}
      </ul>
      {model.stageGroups.length ? (
        <ol className="usage-compact-bars" aria-label="按环节" data-usage-section="stages">
          {model.stageGroups.map((group) => (
            <li key={group.key} className="usage-compact-bar" data-usage-group={group.key} title={`${group.label} ${group.exact} token`}>
              <span className="usage-compact-bar-label">{group.label}</span>
              <span className="usage-compact-bar-track" aria-hidden="true">
                <span className="usage-compact-bar-fill" style={{ width: `${Math.max(2, Math.round(group.share * 100))}%` }} />
              </span>
              <span className="usage-compact-bar-value">{group.value}</span>
            </li>
          ))}
        </ol>
      ) : null}
      {model.notes.length ? (
        <p className="usage-compact-note"><Info aria-hidden="true" />{model.notes.join(" ")}</p>
      ) : null}
    </div>
  );
}
