// CredentialsWorkbench：凭据表单主体（OCR / 翻译 / Agent + 保存行），
// 从 CredentialsDialog 抽出的双宿主组件：
//   1. SettingsDialog 的接口区内嵌（常规入口，无二层弹窗）
//   2. CredentialsDialog（仅剩首次配置门 setupMode 一个场景）
// 两个宿主互斥挂载（设置是模态、门弹窗只从上传引导触发），BROWSER_IDS 的
// DOM id 不会同屏重复。状态/保存/校验全部走 useCredentialsController 的
// 单例 store——宿主只是壳。
import { useEffect, useRef, useState } from "react";
import { CREDENTIAL_DOM_IDS } from "./credentials-dom-ids.js";
import { useCredentialsController } from "./useCredentialsController.js";
import { OcrPanels, TranslationPanel } from "./ProviderPanels.jsx";
import { Button } from "@/ui/Button.jsx";
import { AgentRuntimeSettingsCard } from "./AgentRuntimeSettingsCard.jsx";
import { DialogFooter } from "@/ui/components/dialog.js";
import { FormStatusLine } from "@/ui/components/form-status-line.js";
import { Check, Save, ScanText } from "lucide-react";
import { OCR_PROVIDER_DEFINITIONS } from "@/platform/config/providers.js";

const { browser: BROWSER_IDS } = CREDENTIAL_DOM_IDS;

// 保存成功反馈至少停留这么久。保存本身可能只要几毫秒（浏览器写 localStorage
// 是同步的），不兜底的话按钮闪一下就回到原样，用户根本看不到自己点成功了。
const SAVED_FEEDBACK_MS = 1600;

export function CredentialsWorkbench() {
  const { credentials, view, handlers } = useCredentialsController();

  const setupMode = Boolean(view.setupMode);
  const status = view.dialogStatus || { message: "", tone: "" };
  const saving = status.tone === "pending";

  // 「点了没反应」的另一半：保存快到肉眼看不见时，给成功态一个最短停留。
  //
  // 触发锚点是「进入过 pending」，不是成功文案的内容——文案里的时刻精度只有秒，
  // 同一秒内连点两次会得到一模一样的字符串，若拿它当指纹就又退回"零变化"。
  // 每轮保存必然先经过 pending，在那里清掉上一次的指纹，成功时就一定重播。
  const [savedPulse, setSavedPulse] = useState(false);
  const lastSavedMessage = useRef("");
  useEffect(() => {
    if (status.tone === "pending") {
      lastSavedMessage.current = "";
      setSavedPulse(false);
      return;
    }
    if (status.tone !== "valid" || !status.message) return;
    if (status.message === lastSavedMessage.current) return;
    lastSavedMessage.current = status.message;
    setSavedPulse(true);
    const timer = setTimeout(() => setSavedPulse(false), SAVED_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [status.tone, status.message]);

  const saveLabel = saving
    ? "正在保存…"
    : savedPulse
      ? "已保存"
      : setupMode ? "保存并启动" : "保存接口";

  const saveAction = (
    <DialogFooter className="credential-dialog-actions credential-document-actions">
      <FormStatusLine id={BROWSER_IDS.status} status={view.dialogStatus} className="upload-status" />
      <Button
        id={BROWSER_IDS.saveButton}
        className={savedPulse ? "app-button is-saved" : "app-button"}
        // 保存期间禁用：此前全程可点，重复点击只会被 save-flow 的并发门
        // 静默丢弃，用户得不到任何"正在处理"的信号。
        disabled={saving}
        aria-busy={saving}
        onClick={() => handlers?.save?.()}
      >
        {savedPulse && !saving ? <Check aria-hidden="true" /> : <Save aria-hidden="true" />}
        {saveLabel}
      </Button>
    </DialogFooter>
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
                <select
                  id={BROWSER_IDS.ocrProviderSelect}
                  className="credential-ocr-provider-select"
                  aria-label="OCR 提供商"
                  value={credentials.ocrProvider}
                  disabled={saving}
                  onChange={(event) => handlers?.changeProvider?.(event)}
                >
                  {OCR_PROVIDER_DEFINITIONS.map((provider) => (
                    <option key={provider.id} value={provider.id}>{provider.label}</option>
                  ))}
                </select>
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
