// 展示组件边界：只收 props 发回调，不直连 services/store；
// 凭据门/预算提示的可见性与文案由 UploadTile 容器映射为 props。
import type { ReactNode } from "react";

export type TranslationBudgetView = {
  visible: boolean;
  tone: string;
  message: string;
  blocking: boolean;
  topUpUrl: string;
};

export function CredentialGateNotice({
  visible,
  onOpenSettings,
}: {
  visible: boolean;
  onOpenSettings: () => void;
}) {
  return (
    <div id="credential-gate" className={`credential-gate${visible ? "" : " hidden"}`}>
      <div className="credential-gate-panel" aria-live="polite">
        <span className="credential-gate-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M8 11V8a4 4 0 1 1 8 0v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="5" y="11" width="14" height="10" rx="3" stroke="currentColor" strokeWidth="1.5" />
            <circle cx="12" cy="16" r="1.2" fill="currentColor" />
          </svg>
        </span>
        <strong id="credential-gate-title">处理前需要完成 API 设置</strong>
        <em id="credential-gate-help">仍可上传或收藏 PDF；执行 OCR 或翻译前，请先填写对应 API 凭据。</em>
        <button
          id="credential-gate-action"
          type="button"
          className="credential-gate-action"
          onClick={onOpenSettings}
        >
          打开设置
        </button>
      </div>
    </div>
  );
}

export function TranslationBudgetNote({ budget }: { budget: TranslationBudgetView }) {
  const classes = [
    "translation-budget-note",
    budget.visible ? "" : "hidden",
    budget.tone === "error" ? "is-error" : "",
    budget.tone === "valid" ? "is-valid" : "",
  ].filter(Boolean).join(" ");

  return (
    <div id="translation-budget-note" className={classes} aria-live="polite">
      {budget.visible ? budget.message : null}
      {budget.visible && budget.blocking ? (
        <>
          {" · "}
          <a href={budget.topUpUrl} target="_blank" rel="noopener noreferrer">去充值</a>
        </>
      ) : null}
    </div>
  );
}

export function UploadBudgetSlot({ children }: { children: ReactNode }) {
  return <div className="upload-budget-slot">{children}</div>;
}
