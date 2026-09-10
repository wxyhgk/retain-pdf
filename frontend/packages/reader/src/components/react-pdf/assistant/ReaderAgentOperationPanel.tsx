import { useEffect, useRef, useState } from "react";
import {
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  Circle,
  ExternalLink,
  FileText,
  Loader2,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";
import type {
  AgentConfirmationMode,
} from "@retainpdf/api/agent-runtime-settings";
import type {
  AgentOperationEventView,
  AgentOperationStatus,
  AgentOperationView,
} from "@retainpdf/api/document-operations";
import type {
  ReaderAgentOperationEntry,
  ReaderAgentOperationPerformOptions,
} from "./use-reader-agent-operations.js";

type OperationAction = "run" | "cancel" | "commit" | "retry";
const DISMISSED_OPERATIONS_STORAGE_KEY = "retainpdf.reader-agent-operation.dismissed.v1";
const DISMISSIBLE_STATUSES = new Set<AgentOperationStatus>(["failed", "cancelled"]);

export function readerAgentOperationDismissalKey(operation: AgentOperationView): string {
  return [
    `${operation.operation_id || ""}`.trim(),
    Number(operation.current_attempt) || 0,
    `${operation.status || ""}`,
  ].join(":");
}

function readDismissedOperationKeys(): Set<string> {
  try {
    const value = JSON.parse(globalThis.localStorage?.getItem(DISMISSED_OPERATIONS_STORAGE_KEY) || "[]");
    return new Set(Array.isArray(value) ? value.filter((item) => typeof item === "string") : []);
  } catch {
    return new Set();
  }
}

function writeDismissedOperationKeys(keys: Set<string>) {
  try {
    globalThis.localStorage?.setItem(
      DISMISSED_OPERATIONS_STORAGE_KEY,
      JSON.stringify(Array.from(keys).slice(-100)),
    );
  } catch {
    // Persistence is a convenience; hiding still works for the current mount.
  }
}

function statusLabel(status: AgentOperationStatus, mode: AgentConfirmationMode): string {
  switch (status) {
    case "draft":
    case "awaiting_confirmation": return mode === "green_light" ? "等待自动执行" : "等待确认";
    case "queued": return "等待执行";
    case "running": return "正在执行";
    case "validating": return "正在验证";
    case "result_ready": return mode === "green_light" ? "等待自动应用" : "候选已就绪";
    case "committed": return mode === "green_light" ? "AI 已直接应用" : "已应用";
    case "failed": return "执行失败";
    case "cancelled": return "已取消";
    case "ambiguous": return "结果不确定";
    default: return `${status}`;
  }
}

function actionItems(status: AgentOperationStatus) {
  switch (status) {
    case "draft":
    case "awaiting_confirmation":
      return [
        { action: "cancel" as const, label: "拒绝" },
        { action: "run" as const, label: "确认执行", primary: true },
      ];
    case "queued":
    case "running":
    case "validating":
      return [{ action: "cancel" as const, label: "取消 PDF 操作", danger: true }];
    case "result_ready":
      return [
        { action: "cancel" as const, label: "拒绝候选" },
        { action: "commit" as const, label: "接受并应用", primary: true },
      ];
    case "failed":
      return [{ action: "retry" as const, label: "重试", primary: true }];
    case "ambiguous":
      return [{ action: "retry" as const, label: "确认风险并重试", danger: true, risk: true }];
    default:
      return [];
  }
}

function eventIcon(status: AgentOperationStatus) {
  if (status === "failed" || status === "ambiguous") return TriangleAlert;
  if (status === "cancelled") return X;
  if (status === "committed" || status === "result_ready") return Check;
  if (["queued", "running", "validating"].includes(status)) return Loader2;
  return Circle;
}

function OperationTimeline({ events, mode }: {
  events: AgentOperationEventView[];
  mode: AgentConfirmationMode;
}) {
  return (
    <ol className="reader-agent-operation-timeline" aria-label="PDF 操作步骤">
      {events.map((event) => {
        const Icon = eventIcon(event.status);
        const spinning = ["queued", "running", "validating"].includes(event.status);
        return (
          <li key={`${event.attempt}:${event.seq}`}>
            <Icon className={spinning ? "is-spinning" : ""} size={12} aria-hidden />
            <span>{event.summary || event.event || statusLabel(event.status, mode)}</span>
            <time>{event.ts ? new Date(event.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</time>
          </li>
        );
      })}
    </ol>
  );
}

function CandidatePreview({
  operation,
  loadCandidate,
}: {
  operation: AgentOperationView;
  loadCandidate: (operation: AgentOperationView) => Promise<Blob>;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [objectUrl, setObjectUrl] = useState("");
  const [error, setError] = useState("");
  const objectUrlRef = useRef("");

  useEffect(() => {
    let cancelled = false;
    setError("");
    void loadCandidate(operation)
      .then((blob) => {
        if (cancelled) return;
        const nextUrl = URL.createObjectURL(blob);
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = nextUrl;
        setObjectUrl(nextUrl);
      })
      .catch(() => {
        if (!cancelled) setError("候选 PDF 加载失败，请重试。");
      });
    return () => {
      cancelled = true;
    };
  }, [loadCandidate, operation.operation_id, operation.current_attempt]);

  useEffect(() => () => {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
  }, []);

  return (
    <>
      <div className="reader-agent-operation-candidate">
        <div>
          <FileText size={13} aria-hidden />
          <span>候选 PDF</span>
        </div>
        <button type="button" disabled={!objectUrl} onClick={() => setPreviewOpen((value) => !value)}>
          {!objectUrl ? "加载中…" : previewOpen ? "收起" : "预览"}
        </button>
        <button
          type="button"
          disabled={!objectUrl}
          aria-label="新窗口打开候选 PDF"
          onClick={() => window.open(objectUrl, "_blank", "noopener,noreferrer")}
        >
          <ExternalLink size={12} aria-hidden />
        </button>
      </div>
      {previewOpen ? (
        <iframe className="reader-agent-operation-preview" src={objectUrl} title="候选 PDF 预览" />
      ) : null}
      {error ? <p className="reader-agent-operation-error" role="alert">{error}</p> : null}
    </>
  );
}

function OperationCard({
  entry,
  mode,
  loadCandidate,
  onAction,
  onDismiss,
}: {
  entry: ReaderAgentOperationEntry;
  mode: AgentConfirmationMode;
  loadCandidate: (operation: AgentOperationView) => Promise<Blob>;
  onAction: (
    action: OperationAction,
    operation: AgentOperationView,
    options?: ReaderAgentOperationPerformOptions,
  ) => void | Promise<void>;
  onDismiss: (operation: AgentOperationView) => void;
}) {
  const { operation, pendingAction, error } = entry;
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [riskOpen, setRiskOpen] = useState(false);
  const events = operation.events || [];
  const actions = actionItems(operation.status);
  const candidateVisible = Boolean(
    (operation.status === "result_ready" || operation.status === "committed")
    && operation.candidate_available,
  );
  const dismissible = DISMISSIBLE_STATUSES.has(operation.status);

  return (
    <article className={`reader-agent-operation-card is-${operation.status}`} data-operation-id={operation.operation_id}>
      <header>
        <span className="reader-agent-operation-icon" aria-hidden><Bot size={15} /></span>
        <div className="reader-agent-operation-title">
          <span>PDF 操作</span>
          <strong>{operation.intent_summary || "处理当前 PDF"}</strong>
        </div>
        <div className="reader-agent-operation-head-actions">
          <span className="reader-agent-operation-status">{statusLabel(operation.status, mode)}</span>
          {dismissible ? (
            <button
              type="button"
              className="reader-agent-operation-dismiss"
              aria-label={operation.status === "failed" ? "隐藏这条失败提示" : "隐藏这条已取消提示"}
              title="隐藏"
              onClick={() => onDismiss(operation)}
            >
              <X size={13} aria-hidden />
            </button>
          ) : null}
        </div>
      </header>

      {operation.affected_pages?.length ? (
        <p className="reader-agent-operation-scope">影响页码：{operation.affected_pages.join("、")}</p>
      ) : null}

      {events.length ? (
        <div className="reader-agent-operation-details">
          <button type="button" onClick={() => setDetailsOpen((value) => !value)}>
            {detailsOpen ? <ChevronUp size={12} aria-hidden /> : <ChevronDown size={12} aria-hidden />}
            {detailsOpen ? "收起步骤" : `执行步骤 ${events.length}`}
          </button>
          {detailsOpen ? <OperationTimeline events={events} mode={mode} /> : null}
        </div>
      ) : null}

      {candidateVisible ? <CandidatePreview operation={operation} loadCandidate={loadCandidate} /> : null}

      {error ? <p className="reader-agent-operation-error" role="alert">{error}</p> : null}

      {riskOpen ? (
        <div className="reader-agent-operation-risk" role="alertdialog" aria-label="确认重复执行风险">
          <TriangleAlert size={14} aria-hidden />
          <p>上一次执行结果不确定，重试可能重复操作。确认接受风险后再继续。</p>
          <div>
            <button type="button" onClick={() => setRiskOpen(false)} disabled={Boolean(pendingAction)}>返回</button>
            <button
              type="button"
              className="is-danger"
              disabled={Boolean(pendingAction)}
              onClick={async () => {
                await onAction("retry", operation, { acceptDuplicateRisk: true });
                setRiskOpen(false);
              }}
            >
              {pendingAction === "retry" ? "处理中…" : "接受风险并重试"}
            </button>
          </div>
        </div>
      ) : actions.length ? (
        <div className="reader-agent-operation-actions">
          {actions.map((item) => (
            <button
              key={item.action}
              type="button"
              className={item.primary ? "is-primary" : item.danger ? "is-danger" : ""}
              disabled={Boolean(pendingAction)}
              onClick={() => {
                if (item.risk) setRiskOpen(true);
                else void onAction(item.action, operation);
              }}
            >
              {pendingAction === item.action ? "处理中…" : item.label}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}

export function ReaderAgentOperationPanel({
  entries,
  confirmationMode,
  runtimeRestarting,
  loadCandidate,
  onAction,
}: {
  entries: ReaderAgentOperationEntry[];
  confirmationMode: AgentConfirmationMode;
  runtimeRestarting: boolean;
  loadCandidate: (operation: AgentOperationView) => Promise<Blob>;
  onAction: (
    action: OperationAction,
    operation: AgentOperationView,
    options?: ReaderAgentOperationPerformOptions,
  ) => void | Promise<void>;
}) {
  const [dismissedKeys, setDismissedKeys] = useState(readDismissedOperationKeys);
  const visibleEntries = entries.filter((entry) => (
    !dismissedKeys.has(readerAgentOperationDismissalKey(entry.operation))
  ));

  function dismissOperation(operation: AgentOperationView) {
    const key = readerAgentOperationDismissalKey(operation);
    setDismissedKeys((current) => {
      const next = new Set(current);
      next.add(key);
      writeDismissedOperationKeys(next);
      return next;
    });
  }

  return (
    <section className={`reader-agent-operations${visibleEntries.length ? " has-operations" : ""}`} aria-label="AI PDF 操作">
      <div className={`reader-agent-mode${confirmationMode === "green_light" ? " is-green" : ""}`}>
        <ShieldCheck size={13} aria-hidden />
        <span>{confirmationMode === "green_light" ? "绿灯模式 · 自动执行并应用" : "需要确认 · 操作前等待授权"}</span>
      </div>
      {runtimeRestarting ? (
        <div className="reader-agent-restarting" role="status">
          <Loader2 className="is-spinning" size={13} aria-hidden />
          正在重启 Agent，新请求暂不可用
        </div>
      ) : null}
      {visibleEntries.map((entry) => (
        <OperationCard
          key={entry.operation.operation_id}
          entry={entry}
          mode={confirmationMode}
          loadCandidate={loadCandidate}
          onAction={onAction}
          onDismiss={dismissOperation}
        />
      ))}
    </section>
  );
}
