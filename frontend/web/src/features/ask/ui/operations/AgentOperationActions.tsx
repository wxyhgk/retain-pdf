import type {
  AgentConfirmationMode,
  AgentOperationAction,
  AgentOperationStatus,
} from "../../domain/operations/types.js";

export type AgentOperationActionItem = {
  action: AgentOperationAction;
  label: string;
  tone?: "primary" | "danger";
  needsRiskConfirmation?: boolean;
};

export function actionsForStatus(
  status: AgentOperationStatus,
  confirmationMode: AgentConfirmationMode = "explicit",
): AgentOperationActionItem[] {
  switch (status) {
    case "draft":
    case "awaiting_confirmation":
      return [
        { action: "cancel", label: "拒绝" },
        {
          action: "run",
          label: confirmationMode === "green_light" ? "立即执行" : "确认执行",
          tone: "primary",
        },
      ];
    case "queued":
    case "running":
    case "validating":
      return [{ action: "cancel", label: "取消操作", tone: "danger" }];
    case "result_ready":
      return [
        { action: "cancel", label: "拒绝候选" },
        {
          action: "commit",
          label: confirmationMode === "green_light" ? "立即应用" : "接受并应用",
          tone: "primary",
        },
      ];
    case "failed":
      return [{ action: "retry", label: "重试", tone: "primary" }];
    case "ambiguous":
      return [{ action: "retry", label: "确认风险并重试", tone: "danger", needsRiskConfirmation: true }];
    default:
      return [];
  }
}

export function AgentOperationActions({
  status,
  confirmationMode = "explicit",
  pending,
  onAction,
}: {
  status: AgentOperationStatus;
  confirmationMode?: AgentConfirmationMode;
  pending?: AgentOperationAction;
  onAction: (item: AgentOperationActionItem) => void;
}) {
  const actions = actionsForStatus(status, confirmationMode);
  if (!actions.length) return null;
  return (
    <div className="home-ask-operation-actions">
      {actions.map((item) => (
        <button
          key={item.action}
          type="button"
          className={item.tone ? `is-${item.tone}` : ""}
          disabled={Boolean(pending)}
          onClick={() => onAction(item)}
        >
          {pending === item.action ? "处理中…" : item.label}
        </button>
      ))}
    </div>
  );
}
