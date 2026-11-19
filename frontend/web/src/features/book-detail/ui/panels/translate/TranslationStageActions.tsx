import { useEffect, useState, type ReactNode } from "react";
import { Coins, Languages, LoaderCircle, RefreshCw } from "lucide-react";
import { Button, ConfirmDialog, Select } from "@retainpdf/ui";
import type {
  JobRetryStage,
  JobStageRetryActionView,
} from "@/platform/api/index.js";
import { stageDisabledReasonText } from "../../../domain/stage-disabled-reason.js";
import {
  RETRANSLATE_AGENT_NOTE,
  RETRANSLATE_QUALITY_OPTIONS,
  type RetranslateQuality,
} from "../../../domain/retranslate-quality.js";
import { KEEP_MODEL, retranslateModelOptions } from "../../../domain/retranslate-model.js";
import { savedTranslationConnections, type TranslationConnection } from "@/platform/config/translation-connections.js";
import { CREDENTIALS_CHANGED_EVENT } from "@/platform/contracts/credentials-contract.js";
import { RetranslateModelSelect } from "./RetranslateModelSelect.jsx";
import { RetranslateModelList } from "./RetranslateModelList.jsx";
import { useRetranslateEstimates } from "../../use-retranslate-estimates.js";
import type { UsageEstimateView } from "@/platform/api/index.js";

function labelOf(action: JobStageRetryActionView) {
  if (action.stage === "translation") return "重新翻译";
  if (action.stage === "render") return "重新渲染";
  return action.label;
}

// 清单形态（sheet）里每一项的说明：做什么、花不花钱。画面上只摆一个费用小标签，整句在悬停里。顺序按代价从小到大。
const SHEET_HINTS: Record<string, string> = {
  render: "用现有译文重新排版，不调用模型、不产生费用。",
  translation: "复用已有 OCR 重新翻译整本，再排版；翻译方式可以沿用原来的，也可以换成普通、统一术语或精翻（翻译 agent）；模型可以换成设置里存的其他连接。会产生翻译费用。",
};
const SHEET_ORDER: Record<string, number> = { render: 0, translation: 1 };

/** 清单一行的费用小标签：不产生费用 / 产生费用。流水线 OCR 站、文档准备站的行也用它。 */
export function ReprocessCost({ free, label }: { free: boolean; label?: string }) {
  return (
    <span className="book-detail-reprocess-cost" data-cost={free ? "free" : "paid"}>
      <Coins aria-hidden="true" />
      {label || (free ? "不产生费用" : "产生费用")}
    </span>
  );
}

// 需要先确认再执行的动作：重新翻译（后端标 danger）。
function needsConfirm(action: JobStageRetryActionView) {
  return Boolean(action.danger);
}

const CONFIRM_COPY = {
  title: "确认重新翻译",
  description: "复用现有 OCR，重新翻译整本再排版，会重新调用翻译接口并产生费用。只想接着上次没做完的部分，请用失败卡片上的「从断点继续」。",
  confirmLabel: "接受风险并重新翻译",
};

type RetryOptions = {
  acceptDuplicateRisk?: boolean;
  renderEngine?: string;
  translationQuality?: string;
  /** 重新翻译换成设置里存的这条连接（整套：地址、模型、key……）。 */
  translationConnection?: TranslationConnection | null;
};

function StageIcon({ stage }: { stage: JobRetryStage }) {
  if (stage === "translation") return <Languages className="size-4" aria-hidden="true" />;
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
  stages,
  onRetry,
  estimate,
  currentModel = "",
}: {
  actions?: JobStageRetryActionView[];
  /** inline：一排按钮（失败态和翻译按钮同排）；sheet：「重新处理」展开后的清单，每项一行。 */
  variant?: "inline" | "sheet";
  /** sheet 末尾追加的行（「重新 OCR」，它不属于翻译任务的阶段动作）。 */
  extraRows?: ReactNode;
  /** 只列这几个阶段的动作（流水线上点哪一站就列哪一站的）；不传列全部。 */
  stages?: JobRetryStage[];
  loading?: boolean;
  pendingStage?: JobRetryStage | "";
  error?: string;
  onRetry: (
    stage: JobRetryStage,
    options?: RetryOptions,
  ) => Promise<unknown>;
  /** 这本书现在用的模型；「沿用原来的」后面写出来，列表里那一行标「原来用的」。 */
  currentModel?: string;
  /** 换成某个模型重新翻译大概要花多少；不给就不显示估价。 */
  estimate?: (baseUrl: string, model: string) => Promise<UsageEstimateView | null>;
}) {
  const [confirmAction, setConfirmAction] = useState<JobStageRetryActionView | null>(null);
  // 重新渲染用哪个排版引擎；空串 = 沿用任务原来的。
  const [renderEngine, setRenderEngine] = useState("");
  // 重新翻译用哪种翻译方式；空串 = 沿用任务原来的。
  const [translationQuality, setTranslationQuality] = useState<RetranslateQuality>("");
  // 重新翻译用哪条连接（设置里存的）；空串 = 沿用任务原来的。
  // 设置里存好的连接；设置一保存（retainpdf:credentials-changed）就重读，不用关掉书详情。
  const [modelOptions, setModelOptions] = useState(() => retranslateModelOptions(savedTranslationConnections()));
  useEffect(() => {
    const reload = () => setModelOptions(retranslateModelOptions(savedTranslationConnections()));
    document.addEventListener(CREDENTIALS_CHANGED_EVENT, reload);
    return () => document.removeEventListener(CREDENTIALS_CHANGED_EVENT, reload);
  }, []);
  const [translationModel, setTranslationModel] = useState(KEEP_MODEL);
  const translationConnection = modelOptions.find((option) => option.value === translationModel)?.connection || null;
  // 清单里列着重新翻译、能用时才去问估价。
  const translationListed = actions.some((action) => action.stage === "translation" && action.can_retry)
    && (!stages || stages.includes("translation"));
  const priceOf = useRetranslateEstimates(modelOptions, estimate, translationListed && modelOptions.length > 1);
  const translationChoice = {
    ...(translationQuality ? { translationQuality } : {}),
    ...(translationConnection ? { translationConnection } : {}),
  };
  // 父级 hook 已把错误写入 error prop；本地兜底覆盖 onRetry 直接抛错
  // 但父级未落 error 的场景（如 mock/装配差异），保证错误仍落到 UI。
  const [localError, setLocalError] = useState("");
  const checking = loading && !actions.length;
  const visibleActions = (checking ? LOADING_ACTIONS : actions)
    .filter((action) => !stages || stages.includes(action.stage));
  const shownError = error || localError;
  if (!visibleActions.length && !extraRows && !shownError) return null;

  function describeRetryError(cause: unknown): string {
    const message = `${(cause as Error)?.message || cause || ""}`.trim();
    return message || "重新处理失败，请稍后重试。";
  }

  async function runRetry(stage: JobRetryStage, options?: RetryOptions) {
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
      await onRetry(confirmAction.stage, {
        acceptDuplicateRisk: true,
        ...(confirmAction.stage === "translation" ? translationChoice : {}),
      });
      setLocalError("");
      setConfirmAction(null);
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
      <Button
        key={action.stage}
        id={`book-detail-retry-${action.stage}-btn`}
        variant="secondary" size={sheet ? "md" : "sm"}
        disabled={disabled}
        title={!action.can_retry && rawReason ? (reason === rawReason ? reason : `${reason}（${rawReason}）`) : undefined}
        onClick={() => {
          if (needsConfirm(action)) setConfirmAction(action);
          else if (action.stage === "render" && renderEngine) void runRetry("render", { renderEngine });
          else if (action.stage === "translation" && (translationQuality || translationConnection)) void runRetry("translation", translationChoice);
          else void runRetry(action.stage);
        }}
      >
        {checking
          ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          : <StageIcon stage={action.stage} />}
        <span>{pending ? "提交中…" : sheet ? "开始" : labelOf(action)}</span>
      </Button>
    );
  }

  const engineSelect = (
    <Select
      id="book-detail-render-engine"
      size={variant === "sheet" ? "md" : "sm"}
      aria-label="重新渲染用的排版引擎"
      title="重新渲染用的排版引擎"
      className="book-detail-render-engine"
      value={renderEngine}
      disabled={Boolean(pendingStage)}
      onChange={(event) => setRenderEngine(event.target.value)}
    >
      <option value="">引擎：沿用原来的</option>
      <option value="rpr_fit">引擎：新引擎</option>
      <option value="typst">引擎：Typst（旧）</option>
    </Select>
  );

  const qualitySelect = (bare = false) => (
    <Select
      id="book-detail-translation-quality"
      size={variant === "sheet" ? "md" : "sm"}
      aria-label="重新翻译用的翻译方式"
      title="重新翻译用的翻译方式"
      className="book-detail-translation-quality"
      value={translationQuality}
      disabled={Boolean(pendingStage)}
      onChange={(event) => setTranslationQuality(event.target.value as RetranslateQuality)}
    >
      {RETRANSLATE_QUALITY_OPTIONS.map((option) => (
        // 上下排时前面已经有「翻译方式」几个字，选项里不再重复「翻译：」。
        <option key={option.value} value={option.value}>{bare ? option.label.replace(/^翻译：/, "") : option.label}</option>
      ))}
    </Select>
  );
  const modelSelect = (
    <RetranslateModelSelect
      options={modelOptions}
      value={translationModel}
      onChange={setTranslationModel}
      disabled={Boolean(pendingStage)}
      size={variant === "sheet" ? "md" : "sm"}
      priceOf={priceOf}
    />
  );
  const confirmDescription = [
    CONFIRM_COPY.description,
    translationQuality === "refined" ? RETRANSLATE_AGENT_NOTE : "",
    translationConnection
      ? `这次用 ${translationConnection.label} 的 ${translationConnection.model}${priceOf(translationModel) ? `，${priceOf(translationModel)}` : ""}。`
      : "",
  ].join("");

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
            // 重新翻译能挑模型时整行改成上下排：上面标题和费用，下面翻译方式、模型列表，「开始」在最后。
            if (action.stage === "translation" && !checking && modelOptions.length > 1) {
              return (
                <li key={action.stage} className="book-detail-reprocess-row is-stacked" data-reprocess-stage={action.stage}>
                  <div className="book-detail-reprocess-copy" title={SHEET_HINTS[action.stage] || undefined}>
                    <strong><StageIcon stage={action.stage} />{labelOf(action)}</strong>
                    {!action.can_retry && reason ? <span>{reason}</span> : <ReprocessCost free={false} />}
                  </div>
                  <div className="book-detail-reprocess-field">
                    <span className="book-detail-reprocess-field-label">翻译方式</span>
                    {qualitySelect(true)}
                  </div>
                  <div className="book-detail-reprocess-field">
                    <span className="book-detail-reprocess-field-label">模型</span>
                    <RetranslateModelList
                      options={modelOptions}
                      value={translationModel}
                      onChange={setTranslationModel}
                      disabled={Boolean(pendingStage)}
                      priceOf={priceOf}
                      currentModel={currentModel}
                    />
                  </div>
                  <div className="book-detail-reprocess-controls">{actionButton(action, true)}</div>
                </li>
              );
            }
            return (
              <li key={action.stage} className="book-detail-reprocess-row" data-reprocess-stage={action.stage}>
                <div className="book-detail-reprocess-copy" title={SHEET_HINTS[action.stage] || undefined}>
                  <strong><StageIcon stage={action.stage} />{labelOf(action)}</strong>
                  {!action.can_retry && reason && !checking
                    ? <span>{reason}</span>
                    : <ReprocessCost free={action.stage === "render"} />}
                </div>
                <div className="book-detail-reprocess-controls">
                  {action.stage === "render" && !checking ? engineSelect : null}
                  {action.stage === "translation" && !checking ? qualitySelect() : null}
                  {action.stage === "translation" && !checking ? modelSelect : null}
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
          {!checking && visibleActions.some((action) => action.stage === "translation") ? qualitySelect() : null}
          {!checking && visibleActions.some((action) => action.stage === "translation") ? modelSelect : null}
          {!checking && visibleActions.some((action) => action.stage === "render") ? engineSelect : null}
        </div>
      )}
      {shownError ? <p className="book-detail-stage-actions-error rounded-md border border-foreground/20 bg-muted/40 px-3 py-2 text-xs text-foreground" role="alert">{shownError}</p> : null}
      <ConfirmDialog
        id="book-detail-translation-risk-confirm"
        open={Boolean(confirmAction)}
        onOpenChange={(next) => {
          if (!next) setConfirmAction(null);
        }}
        title={CONFIRM_COPY.title}
        description={confirmDescription}
        confirmLabel={CONFIRM_COPY.confirmLabel}
        tone="default"
        pending={Boolean(confirmAction) && pendingStage === confirmAction?.stage}
        onConfirm={confirmRisk}
      />
    </div>
  );
}
