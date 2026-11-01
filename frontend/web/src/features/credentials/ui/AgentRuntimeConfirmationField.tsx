import type { AgentRuntimeConfigView } from "@/platform/api/index.js";
import { ShieldCheck, Zap } from "lucide-react";
import { ChoiceTiles } from "./ChoiceTiles.jsx";

export interface AgentRuntimeConfirmationFieldProps {
  confirmationMode: AgentRuntimeConfigView["agent_confirmation_mode"];
  onConfirmationModeChange: (
    mode: AgentRuntimeConfigView["agent_confirmation_mode"],
  ) => void;
  busy: boolean;
}

export function AgentRuntimeConfirmationField({
  confirmationMode,
  onConfirmationModeChange,
  busy,
}: AgentRuntimeConfirmationFieldProps) {
  return (
    <fieldset className="credential-agent-confirmation">
      <legend>
        操作确认
        <span>全局设置</span>
      </legend>
      <ChoiceTiles<AgentRuntimeConfigView["agent_confirmation_mode"]>
        label="Agent 操作确认方式"
        value={confirmationMode}
        onChange={onConfirmationModeChange}
        disabled={busy}
        options={[
          { value: "explicit", icon: <ShieldCheck />, label: "需要确认", title: "AI 每一步操作都等你确认" },
          { value: "green_light", icon: <Zap />, label: "绿灯模式", title: "AI 直接执行受支持的 PDF 操作" },
        ]}
      />
      {confirmationMode === "green_light" ? (
        <p>
          AI 可直接执行并应用受支持的 PDF 操作，无需逐步确认；不允许执行 shell 或任意系统命令。
        </p>
      ) : null}
    </fieldset>
  );
}
