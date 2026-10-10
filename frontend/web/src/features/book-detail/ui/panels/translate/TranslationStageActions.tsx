import { useState, type ReactNode } from "react";
import { Languages, LoaderCircle, RefreshCw, Sparkles } from "lucide-react";
import { ConfirmDialog } from "@/ui/components/confirm-dialog.js";
import type {
  JobRetryStage,
  JobStageRetryActionView,
} from "@/platform/api/index.js";
import { btn } from "../ui.jsx";
import { stageDisabledReasonText } from "../../../domain/stage-disabled-reason.js";
import { describeLastRefine, refineContinuePage, refineEscalations } from "../../../domain/last-refine.js";

function labelOf(action: JobStageRetryActionView) {
  if (action.stage === "translation") return "重新翻译";
  if (action.stage === "render") return "重新渲染";
  if (action.stage === "refine") return "精修译文";
  return action.label;
}

// 清单形态（sheet）里每一项下面的一句话：做什么、花不花钱。顺序按代价从小到大。
const SHEET_HINTS: Record<string, string> = {
  render: "用现有译文重新排版，不调用模型、不产生费用。",
  refine: "模型挑错后分派局部修改或整段重写，最多两轮，改不好的保留原译并列出来给你确认；改完自动重新排版。会产生费用。",
  translation: "复用已有 OCR 重新翻译整本，再排版。会产生翻译费用。",
};
const SHEET_ORDER: Record<string, number> = { render: 0, refine: 1, translation: 2 };

// 需要先确认再执行的动作：重新翻译（后端标 danger）和精修（会调模型、产生费用）。
function needsConfirm(action: JobStageRetryActionView) {
  return Boolean(action.danger) || action.stage === "refine";
}

const CONFIRM_COPY: Record<string, { title: string; description: string; confirmLabel: string }> = {
  translation: {
    title: "确认重新翻译",
    description: "复用现有 OCR，重新翻译整本再排版，会重新调用翻译接口并产生费用。只想接着上次没做完的部分，请用失败卡片上的「从断点继续」。",
    confirmLabel: "接受风险并重新翻译",
  },
  refineContinue: {
    title: "接着精修",
    description: "从上次没审到的那一页接着挑错和修改，前面已经精修过的部分不再重复。改完自动重新渲染一次；会调用模型、产生少量费用。",
    confirmLabel: "接着精修",
  },
  refine: {
    title: "精修译文",
    description: "在现有译文上走编辑部流程：模型先挑错（漏译、错译、数字和术语），再按问题分派局部修改或整段重写，最多两轮；改不好的保留原译，列进「留给你确认」。改完自动重新渲染一次，不会重新翻译整本；每处修改都会留下记录，之后也能退回。会调用模型、产生费用，耗时视页数而定。",
    confirmLabel: "开始精修",
  },
};

function StageIcon({ stage }: { stage: JobRetryStage }) {
  if (stage === "translation") return <Languages className="size-4" aria-hidden="true" />;
  if (stage === "refine") return <Sparkles className="size-4" aria-hidden="true" />;
  return <RefreshCw className="size-4" aria-hidden="true" />;
}

const LOADING_ACTIONS: JobStageRetryActionView[] = [
  {
    stage: "translation",
    label: "重新翻译",
    can_retry: false,
    disabled_reason: "正在确认可用性",
  },
  {
    stage: "render",
    label: "重新渲染",
    can_retry: false,
    disabled_reason: "正在确认可用性",
  },
];

export function TranslationStageActions({
  actions = [],
  loading = false,
  pendingStage = "",
  error = "",
  variant = "inline",
  extraRows = null,
  onRetry,
}: {
  actions?: JobStageRetryActionView[];
  /** inline：一排按钮（失败态和翻译按钮同排）；sheet：「重新处理」展开后的清单，每项一行。 */
  variant?: "inline" | "sheet";
  /** sheet 末尾追加的行（「重新 OCR」，它不属于翻译任务的阶段动作）。 */
  extraRows?: ReactNode;
  loading?: boolean;
  pendingStage?: JobRetryStage | "";
  error?: string;
  onRetry: (
    stage: JobRetryStage,
    options?: { acceptDuplicateRisk?: boolean; renderEngine?: string; refineStartPage?: number },
  ) => Promise<unknown>;
}) {
  const [confirmAction, setConfirmAction] = useState<JobStageRetryActionView | null>(null);
  // 「接着精修」：从这一页开始（null = 整本精修）。
  const [continuePage, setContinuePage] = useState<number | null>(null);
  // 重新渲染用哪个排版引擎；空串 = 沿用任务原来的。
  const [renderEngine, setRenderEngine] = useState("");
  // 父级 hook 已把错误写入 error prop；本地兜底覆盖 onRetry 直接抛错
  // 但父级未落 error 的场景（如 mock/装配差异），保证错误仍落到 UI。
  const [localError, setLocalError] = useState("");
  const checking = loading && !actions.length;
  const visibleActions = checking ? LOADING_ACTIONS : actions;
  const shownError = error || localError;
  const confirmCopy = confirmAction?.stage === "refine"
    ? CONFIRM_COPY[continuePage ? "refineContinue" : "refine"]
    : CONFIRM_COPY.translation;
  if (!visibleActions.length && !shownError) return null;

  function describeRetryError(cause: unknown): string {
    const message = `${(cause as Error)?.message || cause || ""}`.trim();
    return message || "重新处理失败，请稍后重试。";
  }

  async function runRetry(
    stage: JobRetryStage,
    options?: { acceptDuplicateRisk?: boolean; renderEngine?: string },
  ) {
    setLocalError("");
    try {
      await onRetry(stage, options);
    } catch (cause) {
      // 错误落到 UI 文案，按钮保持可操作（disabled 仅由 checking/pending/can_retry 决定）。
      setLocalError(describeRetryError(cause));
    }
  }

  // 清单里的按钮只做显式的阶段重跑；断点续跑在失败卡片上。确认重新翻译即接受重复计费风险。
  async function confirmRisk() {
    if (!confirmAction) return;
    try {
      // 精修的确认只是「知道要花钱」，不是接受重复请求风险。
      await onRetry(
        confirmAction.stage,
        confirmAction.stage === "refine"
          ? (continuePage ? { refineStartPage: continuePage } : undefined)
          : { acceptDuplicateRisk: true },
      );
      setLocalError("");
      setConfirmAction(null);
      setContinuePage(null);
    } catch (cause) {
      // 失败给文案且不吞错：确认框保持打开，允许用户取消或重试。
      setLocalError(describeRetryError(cause));
    }
  }

  function actionButton(action: JobStageRetryActionView, sheet = false) {
    const pending = pendingStage === action.stage;
    const disabled = checking || Boolean(pendingStage) || !action.can_retry;
    const rawReason = `${action.disabled_reason || action.reason || ""}`.trim();
    const reason = stageDisabledReasonText(rawReason);
    return (
      <button
        key={action.stage}
        id={`book-detail-retry-${action.stage}-btn`}
        type="button"
        className={btn("outline")}
        disabled={disabled}
        title={!action.can_retry && rawReason ? (reason === rawReason ? reason : `${reason}（${rawReason}）`) : undefined}
        onClick={() => {
          setContinuePage(null);
          if (needsConfirm(action)) setConfirmAction(action);
          else if (action.stage === "render" && renderEngine) void runRetry("render", { renderEngine });
          else void runRetry(action.stage);
        }}
      >
        {checking
          ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          : <StageIcon stage={action.stage} />}
        <span className="ml-1.5">{pending ? "提交中…" : sheet ? "开始" : labelOf(action)}</span>
      </button>
    );
  }

  const engineSelect = (
    <select
      id="book-detail-render-engine"
      aria-label="重新渲染用的排版引擎"
      title="重新渲染用的排版引擎"
      className="book-detail-render-engine h-9 w-auto rounded-md border border-input bg-background px-2 py-0 text-sm"
      value={renderEngine}
      disabled={Boolean(pendingStage)}
      onChange={(event) => setRenderEngine(event.target.value)}
    >
      <option value="">引擎：沿用原来的</option>
      <option value="rpr_fit">引擎：新引擎</option>
      <option value="typst">引擎：Typst（旧）</option>
    </select>
  );

  const sheet = variant === "sheet";
  const sheetActions = [...visibleActions].sort(
    (a, b) => (SHEET_ORDER[a.stage] ?? 9) - (SHEET_ORDER[b.stage] ?? 9),
  );

  return (
    <div
      className={sheet ? "book-detail-reprocess-sheet" : "book-detail-stage-actions"}
      data-translation-stage-actions="true"
      aria-busy={checking || undefined}
    >
      {sheet ? (
        <ul className="book-detail-reprocess-list">
          {sheetActions.map((action) => {
            const reason = stageDisabledReasonText(action.disabled_reason || action.reason);
            const lastRefine = action.stage === "refine" ? describeLastRefine(action.last_refine) : "";
            const resumeAt = action.stage === "refine" ? refineContinuePage(action.last_refine) : null;
            const escalated = action.stage === "refine" ? refineEscalations(action.last_refine) : [];
            const escalatedCount = Number(action.last_refine?.escalated_count) || escalated.length;
            return (
              <li key={action.stage} className="book-detail-reprocess-row" data-reprocess-stage={action.stage}>
                <div className="book-detail-reprocess-copy">
                  <strong>{labelOf(action)}</strong>
                  <span>{!action.can_retry && reason && !checking ? reason : SHEET_HINTS[action.stage] || ""}</span>
                  {lastRefine ? <span data-last-refine="true">{lastRefine}</span> : null}
                  {escalated.length ? (
                    <details className="book-detail-refine-escalated" data-refine-escalated={escalatedCount}>
                      <summary>{`查看留给你确认的 ${escalatedCount} 处`}</summary>
                      <ol>
                        {escalated.map((row) => (
                          <li key={row.item_id} data-escalated-item={row.item_id}>
                            <span className="book-detail-refine-escalated-page">{`第 ${row.page_number} 页`}</span>
                            <span>{row.reason}</span>
                          </li>
                        ))}
                      </ol>
                      {escalatedCount > escalated.length ? (
                        <p>{`只列出前 ${escalated.length} 处；全部见精修报告。`}</p>
                      ) : null}
                    </details>
                  ) : null}
                </div>
                <div className="book-detail-reprocess-controls">
                  {action.stage === "render" && !checking ? engineSelect : null}
                  {resumeAt && action.can_retry ? (
                    <button
                      type="button"
                      className={btn("outline")}
                      disabled={checking || Boolean(pendingStage)}
                      data-refine-continue={resumeAt}
                      onClick={() => {
                        setContinuePage(resumeAt);
                        setConfirmAction(action);
                      }}
                    >
                      {`从第 ${resumeAt} 页继续`}
                    </button>
                  ) : null}
                  {actionButton(action, true)}
                </div>
              </li>
            );
          })}
          {extraRows}
        </ul>
      ) : (
        <div className="book-detail-stage-actions-buttons">
          {visibleActions.map((action) => actionButton(action))}
          {!checking && visibleActions.some((action) => action.stage === "render") ? engineSelect : null}
        </div>
      )}
      {shownError ? <p className="book-detail-stage-actions-error rounded-md border border-foreground/20 bg-muted/40 px-3 py-2 text-xs text-foreground" role="alert">{shownError}</p> : null}
      <ConfirmDialog
        id="book-detail-translation-risk-confirm"
        open={Boolean(confirmAction)}
        onOpenChange={(next) => {
          if (!next) {
            setConfirmAction(null);
            setContinuePage(null);
          }
        }}
        title={confirmCopy.title}
        description={confirmCopy.description}
        confirmLabel={confirmCopy.confirmLabel}
        tone="default"
        pending={Boolean(confirmAction) && pendingStage === confirmAction?.stage}
        onConfirm={confirmRisk}
      />
    </div>
  );
}
