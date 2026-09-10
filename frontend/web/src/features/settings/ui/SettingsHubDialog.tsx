// SettingsHubDialog v2：左导航 + 右内容区（原"门厅弹窗"横向 pill 布局退役）。
//
// 布局：左侧竖排导航（图标+名称，Radix Tabs orientation=vertical，方向键可用），
// 右侧内容窗格（每区自带标题行 + 正文，独立滚动）。外观区升格为主题卡片网格
// 的主舞台；API/词表因真实表单仍是独立顶层对话框（CredentialsDialog/
// GlossariesDialog，各有 controller/store/测试契约），本面板作为"启动区"
// 保留入口按钮——后续如要内嵌，动的是那两个 feature，不是这里。
//
// 【测试契约，改版不许破】（credentials/glossaries/app-update component tests）：
// - #app-settings-dialog / #app-settings-close-btn
// - [data-settings-tab="api|glossary|appearance|update"] 可点击
// - [data-settings-panel=…] forceMount + hidden 属性切换（测试断言 .hidden）
// - #credentials-btn / #glossary-btn 打开对应子对话框
// - 外观面板 #theme-appearance-panel 与 #theme-option-<id>
//
// 开合状态跨子树走 settings-hub-dialog-store；tab 切换是子树内瞬态（useState）。
// 不 forceMount Dialog 的 Content/Overlay（Radix hideOthers 依赖真实
// mount/unmount，见 CredentialsDialog 头注释）。AppUpdateBanner 的挂载生命
// 周期说明见旧版头注释结论：后台自检由 composition 的纯逻辑控制器驱动，
// 与本组件是否挂载无关。

import { useEffect, useState } from "react";
import { Tabs as TabsPrimitive } from "radix-ui";
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogShell,
  DialogTitle,
} from "@/ui/components/dialog.js";
import { useDialogState } from "@/ui/hooks/use-dialog-state.js";
// TODO(feature-layout 批次 5): dialog-store 是通用状态工具，随批次 5 迁入 platform 后改指。
import type { DialogStore } from "@/platform/store/dialog-store.js";
import { useDialogReturnFocus } from "@/ui/hooks/use-dialog-return-focus.js";
import { APP_SETTINGS_DIALOG_IDS } from "./settings-dialog-ids.js";
import { ThemeAppearancePanel } from "./ThemeAppearancePanel.jsx";
import { Button as ButtonBase } from "@/ui/Button.jsx";

// Decoupled: settings → credentials / app-update 横向依赖改为经 HomeApp 注入(slot)。
// - credentialsWorkbenchSlot: 由 HomeApp 传入 <CredentialsWorkbench />
// - appUpdateBannerSlot: 由 HomeApp 传入 <AppUpdateBanner />
// 原先直接 import CredentialsWorkbench / AppUpdateBanner / credentials-dom-ids 导致
// settings 域强耦合 credentials 域；现仅依赖 shared/settings-dialog-ids (无状态常量)。

// Button.size 在未注解源文件里被推断为必填;unstyled 路径运行时不用 size。
const Button = ButtonBase as any;

function IconKey(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M14.5 9.5a4 4 0 1 1-1.2 2.86L5 20.65 3.35 19 11.6 10.7A4 4 0 0 1 14.5 9.5Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 6.5h.01" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
function IconBook(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M5.5 5.2A2.2 2.2 0 0 1 7.7 3H19v15.5H7.7a2.2 2.2 0 0 0-2.2 2.2V5.2Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M5.5 5.2A2.2 2.2 0 0 0 3.3 3H3v15.5h.3a2.2 2.2 0 0 1 2.2 2.2" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}
function IconPalette(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M12 3a9 9 0 1 0 9 9c0-.5-.04-1-.12-1.48a5 5 0 0 1-6.4-6.4A9 9 0 0 0 12 3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="8.5" cy="10" r="1.1" fill="currentColor" />
      <circle cx="11.5" cy="7.2" r="1.1" fill="currentColor" />
      <circle cx="15.2" cy="9" r="1.1" fill="currentColor" />
    </svg>
  );
}
function IconUpdate(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M12 5v2.1M12 16.9V19M5 12h2.1M16.9 12H19M7.05 7.05l1.5 1.5M15.45 15.45l1.5 1.5M16.95 7.05l-1.5 1.5M8.55 15.45l-1.5 1.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

const TABS = [
  { id: "api", label: "API 设置", Icon: IconKey },
  { id: "glossary", label: "词表", Icon: IconBook },
  { id: "appearance", label: "外观", Icon: IconPalette },
  { id: "update", label: "更新", Icon: IconUpdate },
];

const PANE_HEADS = {
  api: { title: "API 设置", desc: "" },
  glossary: { title: "术语表", desc: "维护固定译法、保留词和专业术语偏好。" },
  appearance: { title: "外观", desc: "选择界面配色，立即生效并记住本机选择。" },
  update: { title: "更新", desc: "查看当前版本，并从 GitHub Releases 重新检查更新。" },
};

function PaneHead({ tab }: { tab: keyof typeof PANE_HEADS }) {
  const head = PANE_HEADS[tab];
  return (
    <header className="app-settings-pane-head">
      <h3>{head.title}</h3>
      {head.desc ? <p>{head.desc}</p> : null}
    </header>
  );
}

export type SettingsHubDialogProps = {
  /** 弹窗开合状态；payload.tab 决定打开时激活哪个 tab（api/glossary/update）。 */
  dialogStore: DialogStore<{ tab?: string } | null>;
  /** 「词表」tab 里点 #glossary-btn 时打开术语表弹窗。 */
  onOpenGlossaries: () => void;
  /** 切到 API tab 前让凭据域预热表单（可选）。 */
  onPrepareCredentialPanels?: () => void;
  credentialsWorkbenchSlot?: React.ReactNode | null;
  appUpdateBannerSlot?: React.ReactNode | null;
};

export function SettingsHubDialog({
  dialogStore,
  onOpenGlossaries,
  onPrepareCredentialPanels,
  credentialsWorkbenchSlot = null,
  appUpdateBannerSlot = null,
}: SettingsHubDialogProps) {

  const dialogState = useDialogState(dialogStore);
  const open = Boolean(dialogState.open);
  const { onCloseAutoFocus } = useDialogReturnFocus(open);
  const [activeTab, setActiveTab] = useState(dialogState.payload?.tab || "api");

  useEffect(() => {
    if (open) {
      setActiveTab(dialogState.payload?.tab || "api");
    }
  }, [open]);

  // API 区内嵌凭据工作台：进入 api tab 时从凭据状态回填表单（不开二层弹窗）。
  // forceMount 保证面板已挂载；rAF 再补一次，避免 ref 尚未挂上导致密码框空白、保存读到空串。
  useEffect(() => {
    if (!open || activeTab !== "api") {
      return;
    }
    const prepare = () => onPrepareCredentialPanels?.();
    prepare();
    const raf = requestAnimationFrame(prepare);
    return () => cancelAnimationFrame(raf);
  }, [open, activeTab, onPrepareCredentialPanels]);

  function handleOpenChange(nextOpen) {
    if (!nextOpen) {
      dialogStore.close();
    }
  }

  function openGlossaries() {
    onOpenGlossaries();
  }

  function panelClass(tab: string) {
    // 纯字面量拼接（含空格分隔），避开 v4 扫描器的 `x${y}` 模板坑
    return activeTab === tab ? "app-settings-panel is-current" : "app-settings-panel";
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          id={APP_SETTINGS_DIALOG_IDS.dialog}
          className="app-settings-dialog"
          onCloseAutoFocus={onCloseAutoFocus}
          showCloseButton={false}
          size="wide"
        >
          <DialogShell className="desktop-shell app-settings-shell">
            <TabsPrimitive.Root
              className="app-settings-layout"
              orientation="vertical"
              value={activeTab}
              onValueChange={setActiveTab}
            >
              <aside className="app-settings-rail">
                <DialogTitle asChild>
                  <h2>设置</h2>
                </DialogTitle>
                <TabsPrimitive.List className="app-settings-nav" aria-label="设置分类">
                  {TABS.map(({ id, label, Icon }) => (
                    <TabsPrimitive.Trigger
                      key={id}
                      value={id}
                      className={activeTab === id ? "is-active" : ""}
                      data-settings-tab={id}
                    >
                      <Icon />
                      {label}
                    </TabsPrimitive.Trigger>
                  ))}
                </TabsPrimitive.List>
              </aside>

              <div className="app-settings-pane">
                <DialogCloseButton
                  id={APP_SETTINGS_DIALOG_IDS.closeButton}
                  className="app-settings-close"
                />

                <TabsPrimitive.Content
                  value="api"
                  forceMount
                  hidden={activeTab !== "api"}
                  className={panelClass("api")}
                  data-settings-panel="api"
                >
                  <PaneHead tab="api" />
                  {credentialsWorkbenchSlot}
                </TabsPrimitive.Content>

                <TabsPrimitive.Content
                  value="glossary"
                  forceMount
                  hidden={activeTab !== "glossary"}
                  className={panelClass("glossary")}
                  data-settings-panel="glossary"
                >
                  <PaneHead tab="glossary" />
                  <div className="app-settings-launcher">
                    <p>
                      词表决定翻译时的固定译法与保留词。可维护多张词表并
                      按需启用，翻译任务发起时生效。
                    </p>
                    <Button id={APP_SETTINGS_DIALOG_IDS.glossaryButton} className="app-settings-action" onClick={openGlossaries}>
                      打开词表
                    </Button>
                  </div>
                </TabsPrimitive.Content>

                <TabsPrimitive.Content
                  value="appearance"
                  forceMount
                  hidden={activeTab !== "appearance"}
                  className={panelClass("appearance")}
                  data-settings-panel="appearance"
                >
                  <PaneHead tab="appearance" />
                  <ThemeAppearancePanel />
                </TabsPrimitive.Content>

                <TabsPrimitive.Content
                  value="update"
                  forceMount
                  hidden={activeTab !== "update"}
                  className={panelClass("update")}
                  data-settings-panel="update"
                >
                  <PaneHead tab="update" />
                  {appUpdateBannerSlot}
                </TabsPrimitive.Content>
              </div>
            </TabsPrimitive.Root>
          </DialogShell>
        </DialogContent>
    </Dialog>
  );
}
