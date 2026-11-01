import type {
  AgentRuntimeConfigView,
  AgentRuntimeMode,
} from "@/platform/api/index.js";
import { Bot, Box, FileSearch, KeyRound, Link2, Network } from "lucide-react";
import { SecretInput } from "./SecretInput.js";
import { ChoiceTiles } from "./ChoiceTiles.jsx";
import { FieldLabel } from "./FieldLabel.jsx";
import { modeLabel } from "./agent-runtime-helpers.js";

// 运行模式的图标卡片：画面上写短名，全名在悬停里。
const MODE_TILES = [
  { value: "python", icon: <FileSearch />, label: "Markdown 检索", title: modeLabel("python") },
  { value: "openai", icon: <Bot />, label: "OpenAI 兼容", title: modeLabel("openai") },
  { value: "fx", icon: <Network />, label: "FX Gateway", title: modeLabel("fx") },
] as const;

export interface AgentRuntimeFieldsProps {
  mode: AgentRuntimeMode;
  onModeChange: (mode: AgentRuntimeMode) => void;
  config: AgentRuntimeConfigView | null;
  busy: boolean;
  baseUrl: string;
  onBaseUrlChange: (value: string) => void;
  model: string;
  onModelChange: (value: string) => void;
  modelKey: string;
  onModelKeyChange: (value: string) => void;
  fxGatewayBaseUrl: string;
  onFxGatewayBaseUrlChange: (value: string) => void;
  fxModel: string;
  onFxModelChange: (value: string) => void;
  gatewayKey: string;
  onGatewayKeyChange: (value: string) => void;
}

export function AgentRuntimeFields({
  mode,
  onModeChange,
  config,
  busy,
  baseUrl,
  onBaseUrlChange,
  model,
  onModelChange,
  modelKey,
  onModelKeyChange,
  fxGatewayBaseUrl,
  onFxGatewayBaseUrlChange,
  fxModel,
  onFxModelChange,
  gatewayKey,
  onGatewayKeyChange,
}: AgentRuntimeFieldsProps) {
  return (
    <div className="credential-agent-grid">
      <div className="credential-agent-mode-field">
        <ChoiceTiles<AgentRuntimeMode>
          label="AI Agent 运行模式"
          value={mode}
          onChange={onModeChange}
          disabled={busy}
          options={MODE_TILES.map((tile) => ({ ...tile, props: { "data-agent-mode": tile.value } }))}
        />
      </div>

      {mode !== "fx" ? (
        <>
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
        </>
      ) : (
        <>
          <label className="credential-agent-url-field">
            <FieldLabel icon={<Link2 />}>FX Gateway URL（可选）</FieldLabel>
            <input
              aria-label="FX Gateway URL"
              type="url"
              value={fxGatewayBaseUrl}
              placeholder="http://127.0.0.1:端口"
              onChange={(event) => onFxGatewayBaseUrlChange(event.target.value)}
              disabled={busy}
            />
          </label>
          <p className="credential-agent-fx-url-note">
            仅支持本机 HTTP + 端口；远程地址请使用 OpenAI 模式。留空使用官方 Gateway。
          </p>
          <label className="credential-agent-model-field">
            <FieldLabel icon={<Box />}>FX 模型（可选）</FieldLabel>
            <input
              aria-label="FX 模型"
              value={fxModel}
              placeholder="使用 Gateway 默认模型"
              onChange={(event) => onFxModelChange(event.target.value)}
              disabled={busy}
            />
          </label>
          <label className="credential-agent-key-field">
            <FieldLabel icon={<KeyRound />}>Gateway Key</FieldLabel>
            <SecretInput
              aria-label="FX Gateway Key"
              secretLabel="FX Gateway Key"
              autoComplete="off"
              value={gatewayKey}
              placeholder="Gateway Key"
              onChange={(event) => onGatewayKeyChange(event.target.value)}
              disabled={busy}
            />
          </label>
        </>
      )}
    </div>
  );
}
