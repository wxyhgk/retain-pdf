// AI Agent 卡片的字段：只有 OpenAI 兼容这一种（模型地址、模型、Key）。
// 以前还能选 Markdown 检索问答、FX Gateway，用户说用不上（2026-11-01），前端只留这一种；后端的模式还在。
import { Box, KeyRound, Link2 } from "lucide-react";
import { SecretInput } from "./SecretInput.js";
import { FieldLabel } from "./FieldLabel.jsx";

export interface AgentRuntimeFieldsProps {
  busy: boolean;
  baseUrl: string;
  onBaseUrlChange: (value: string) => void;
  model: string;
  onModelChange: (value: string) => void;
  modelKey: string;
  onModelKeyChange: (value: string) => void;
}

export function AgentRuntimeFields({
  busy,
  baseUrl,
  onBaseUrlChange,
  model,
  onModelChange,
  modelKey,
  onModelKeyChange,
}: AgentRuntimeFieldsProps) {
  return (
    <div className="credential-agent-grid">
      <label className="credential-agent-url-field">
        <FieldLabel icon={<Link2 />}>模型 API URL</FieldLabel>
        <input
          aria-label="模型 API URL"
          type="url"
          value={baseUrl}
          onChange={(event) => onBaseUrlChange(event.target.value)}
          disabled={busy}
        />
      </label>
      <label className="credential-agent-model-field">
        <FieldLabel icon={<Box />}>模型</FieldLabel>
        <input
          aria-label="AI 模型"
          value={model}
          onChange={(event) => onModelChange(event.target.value)}
          disabled={busy}
        />
      </label>
      <label className="credential-agent-key-field">
        <FieldLabel icon={<KeyRound />}>模型 API Key</FieldLabel>
        <SecretInput
          aria-label="模型 API Key"
          secretLabel="模型 API Key"
          autoComplete="off"
          value={modelKey}
          placeholder="模型 API Key"
          onChange={(event) => onModelKeyChange(event.target.value)}
          disabled={busy}
        />
      </label>
    </div>
  );
}
