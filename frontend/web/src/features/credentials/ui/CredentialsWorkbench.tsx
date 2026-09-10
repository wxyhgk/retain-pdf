// CredentialsWorkbench：凭据表单主体（OCR / 翻译 / Agent + 保存行），
// 从 CredentialsDialog 抽出的双宿主组件：
//   1. SettingsHubDialog 的 API 区内嵌（常规入口，无二层弹窗）
//   2. CredentialsDialog（仅剩首次配置门 setupMode 一个场景）
// 两个宿主互斥挂载（设置是模态、门弹窗只从上传引导触发），BROWSER_IDS 的
// DOM id 不会同屏重复。状态/保存/校验全部走 useCredentialsController 的
// 单例 store——宿主只是壳。
import { CREDENTIAL_DOM_IDS } from "./credentials-dom-ids.js";
import { useCredentialsController } from "./useCredentialsController.js";
import { OcrPanels, TranslationPanel } from "./ProviderPanels.jsx";
import { Button as ButtonBase } from "@/ui/Button.jsx";
import { AgentRuntimeSettingsCard } from "./AgentRuntimeSettingsCard.jsx";
import { Save, ScanText } from "lucide-react";

// Button.size 在未注解源文件里被推断为必填;unstyled 路径运行时不用 size。
const Button = ButtonBase as any;

const { browser: BROWSER_IDS } = CREDENTIAL_DOM_IDS;

export function CredentialsWorkbench() {
  const { view, handlers } = useCredentialsController();

  const setupMode = Boolean(view.setupMode);
  const dialogStatus = view.dialogStatus || { message: "", tone: "" };
  const statusContent = `${dialogStatus.message || ""}`.trim();
  const statusClasses = [
    "upload-status",
    statusContent ? "" : "hidden",
    dialogStatus.tone === "valid" ? "is-valid" : "",
    dialogStatus.tone === "error" ? "is-error" : "",
  ].filter(Boolean).join(" ");

  const saveAction = (
    <div className="actions credential-dialog-actions credential-document-actions">
      <span
        id={BROWSER_IDS.status}
        className={statusClasses}
        role="status"
        aria-live="polite"
      >
        {statusContent}
      </span>
      <Button
        id={BROWSER_IDS.saveButton}
        className="app-button"
        onClick={() => handlers?.save?.()}
      >
        <Save aria-hidden="true" />
        {setupMode ? "保存并启动" : "保存接口"}
      </Button>
    </div>
  );

  return (
    <div className="credential-workbench">
      <div className="credential-panels">
        <div className="credential-panel is-active" data-credential-panel="api">
          <div className="credential-card-grid credential-card-grid-compact credential-api-grid">
            <section className="credential-card credential-ocr-card">
              <div className="credential-card-head credential-card-head-rich">
                <span className="credential-card-icon" aria-hidden="true"><ScanText /></span>
                <div className="credential-card-copy">
                  <h3>OCR 识别</h3>
                </div>
                <span className="credential-card-tag">Paddle</span>
              </div>
              <OcrPanels />
            </section>
            <TranslationPanel footerAction={saveAction} />
          </div>
        </div>
      </div>
      {setupMode ? (
        <p className="credential-agent-setup-note">
          AI Agent 可稍后在设置中配置。
        </p>
      ) : (
        <div className="credential-agent-section">
          <AgentRuntimeSettingsCard />
        </div>
      )}
    </div>
  );
}
