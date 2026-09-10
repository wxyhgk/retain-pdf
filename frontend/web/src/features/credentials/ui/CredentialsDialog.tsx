// CredentialsDialog(React 版 <browser-credentials-dialog>,对照
// components/dialogs/browser-credentials-dialog.js 逐 id 镜像 + browser.js
// (kept 控制器)的开合/校验/保存编排)。
//
// Dialog 渲染层统一走 src/components/ui/dialog.tsx 的 AppDialog 契约：
// 遮罩、尺寸、纸面壳、标题栏、正文区、关闭按钮和动画均由共享层提供。open 受控于
// credentialsDialogStore(useCredentialsController 的 open),onOpenChange
// 在 next===false 时统一调用 dialogStore.close()——Escape、点击背板
// outside-click 检测、点击共享关闭按钮三条路径都走这一个回调,不需要再手写
// handleBackdropClick/keydown 监听。
//
// 不 forceMount Content/Overlay:Radix modal Content 内部有一个
// hideOthers(content)(aria-hidden 兄弟节点)的 effect,依赖组件的真实
// mount/unmount 生命周期(deps=[]),forceMount 会让它在对话框从未打开时就
// 永久生效——反而制造新的无障碍缺陷。已确认对话框关闭时 OCR/DeepSeek/任务
// 选项的未保存草稿会随之丢失(输入是非受控 ref,组件卸载即重置),但没有
// 测试/产品语义要求"关闭后保留未保存草稿",这是可接受的、更符合直觉的
// Dialog UX(草稿在保存前不持久)。
//
// 打开入口：APP_EVENTS.openBrowserCredentials
// - setupMode=true → 本弹窗（首次配置门，独立「接口设置」）
// - 其余情况 → 设置中心 API 区（唯一常规填 Key 入口，避免双窗口）
// HeroUpload 门禁、AI 缺 Key 横幅、提交流都走同一事件。
//
// API 设置不再嵌套二级 Tab；公式默认值并入翻译卡。首次配置门与设置中心
// 复用同一个 CredentialsWorkbench，字段始终同时挂载，保存读取语义不变。

import {
  Dialog,
  DialogBody,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogShell,
  DialogTitle,
} from "@/ui/components/dialog.js";
import { useAppEvent } from "@/ui/hooks/use-app-event.js";
import { useDialogReturnFocus } from "@/ui/hooks/use-dialog-return-focus.js";
import { useCredentialsServices } from "./credentials-context.jsx";
import { CREDENTIAL_DOM_IDS } from "./credentials-dom-ids.js";
import { useCredentialsController } from "./useCredentialsController.js";
import { CredentialsWorkbench } from "./CredentialsWorkbench.jsx";
import { APP_EVENTS } from "@/platform/contracts/app-contract.js";

const { browser: BROWSER_IDS } = CREDENTIAL_DOM_IDS;

export function CredentialsDialog() {
  const { open, view, feature, dialogStore } = useCredentialsController();
  const { openSettingsHubApiTab } = useCredentialsServices();
  const { onCloseAutoFocus } = useDialogReturnFocus(open);

  useAppEvent(APP_EVENTS.openBrowserCredentials, (event) => {
    const detail = event?.detail || {};
    // 常规：只打开「设置 → API 设置」；仅首次配置走独立弹窗
    if (detail.setupMode) {
      feature?.openBrowserCredentialsDialog({ setupMode: true });
      return;
    }
    openSettingsHubApiTab?.();
  });

  // Esc / 背板点击 / 关闭按钮都经这一个回调回写 store(dialogStore.close()
  // 对已关闭状态是幂等 no-op,和 handlers.save() 内部调用 viewPort.closeDialog()
  // 不会冲突)。
  function handleOpenChange(nextOpen) {
    if (!nextOpen) {
      dialogStore.close();
    }
  }

  const setupMode = Boolean(view.setupMode);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        id={CREDENTIAL_DOM_IDS.dialog}
        data-setup-mode={setupMode ? "1" : "0"}
        onCloseAutoFocus={onCloseAutoFocus}
        showCloseButton={false}
      >
          <DialogShell className="desktop-shell">
            <DialogHeader className="desktop-head">
              <div className="credential-dialog-head">
                <DialogTitle asChild>
                  <h2 id={BROWSER_IDS.title}>{setupMode ? "首次配置" : "接口设置"}</h2>
                </DialogTitle>
                <p id={BROWSER_IDS.subtitle} className="muted hidden"></p>
              </div>
              <DialogCloseButton id={BROWSER_IDS.closeButton} />
            </DialogHeader>
            {/* 表单主体抽到 CredentialsWorkbench（与 SettingsHubDialog API 区
                共用同一实现），本弹窗只剩首次配置门（setupMode）一个场景。 */}
            <DialogBody className="desktop-body credential-dialog-body">
              <CredentialsWorkbench />
            </DialogBody>
          </DialogShell>
      </DialogContent>
    </Dialog>
  );
}
