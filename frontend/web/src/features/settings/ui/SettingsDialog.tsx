// SettingsDialog v2：左导航 + 右内容区（原"门厅弹窗"横向 pill 布局退役）。
//
// 布局：左侧竖排导航（图标+名称，Radix Tabs orientation=vertical，方向键可用），
// 右侧内容窗格（每区自带标题行 + 正文，独立滚动）。外观区升格为主题卡片网格
// 的主舞台；接口区直接内嵌 CredentialsWorkbench——首次配置门也是本弹窗停在
// api tab（payload.setupMode），不再有第二个外壳。术语表仍是独立顶层对话框
// （GlossariesDialog，自带 controller/store/测试契约），本面板只留入口按钮。
//
// 【测试契约，改版不许破】（credentials/glossaries/app-update component tests）：
// - #app-settings-dialog / #app-settings-close-btn
// - [data-settings-tab="api|glossary|sync|appearance|update"] 可点击
// - [data-settings-panel=…] forceMount + hidden 属性切换（测试断言 .hidden）
// - #credentials-btn / #glossary-btn 打开对应子对话框
// - 外观面板 #theme-appearance-panel 与 #theme-option-<id>
//
// 开合状态跨子树走 settings-hub-dialog-store；tab 切换是子树内瞬态（useState）。
// 不 forceMount Dialog 的 Content/Overlay：Radix modal Content 内部的
// hideOthers(content) effect 依赖真实的 mount/unmount 生命周期（deps=[]），
// forceMount 会让它在对话框从未打开时就永久生效，反而制造无障碍缺陷。AppUpdateBanner 的挂载生命
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
import { Button } from "@/ui/Button.jsx";

// Decoupled: settings → credentials / app-update 横向依赖改为经 HomeApp 注入(slot)。
// - credentialsWorkbenchSlot: 由 HomeApp 传入 <CredentialsWorkbench />
// - appUpdateBannerSlot: 由 HomeApp 传入 <AppUpdateBanner />
// 原先直接 import CredentialsWorkbench / AppUpdateBanner / credentials-dom-ids 导致
// settings 域强耦合 credentials 域；现仅依赖 shared/settings-dialog-ids (无状态常量)。


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
function IconSync(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path d="M19.5 9A7.5 7.5 0 0 0 6 6.6L4.5 8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 4v4h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.5 15A7.5 7.5 0 0 0 18 17.4l1.5-1.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19.5 20v-4h-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
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
  { id: "api", label: "接口设置", Icon: IconKey },
  { id: "glossary", label: "术语表", Icon: IconBook },
  { id: "sync", label: "同步", Icon: IconSync },
  { id: "appearance", label: "外观", Icon: IconPalette },
  { id: "update", label: "更新", Icon: IconUpdate },
];

const PANE_HEADS = {
  api: { title: "接口设置", desc: "" },
  glossary: { title: "术语表", desc: "维护术语偏好，翻译时优先使用你的术语。" },
  sync: { title: "同步", desc: "通过一个网盘文件夹，在几台电脑之间同步书库、译文和阅读进度。" },
  appearance: { title: "外观", desc: "选择界面配色，立即生效并记住本机选择。" },
  update: { title: "更新", desc: "查看当前版本，并从 GitHub Releases 重新检查更新。" },
};

function PaneHead({ tab, subtitle = null }: { tab: keyof typeof PANE_HEADS; subtitle?: React.ReactNode }) {
  const head = PANE_HEADS[tab];
  return (
    <header className="app-settings-pane-head">
      <h3>{head.title}</h3>
      {subtitle}
      {head.desc ? <p>{head.desc}</p> : null}
    </header>
  );
}

export type SettingsDialogProps = {
  /**
   * 弹窗开合状态。payload.tab 决定打开时激活哪个 tab（api/glossary/update）；
   * payload.setupMode 表示这次是首次配置门——首配不再另开一个外壳，就是本弹窗
   * 停在 api tab，只是多一句引导、表单按钮变成「保存并启动」。
   */
  dialogStore: DialogStore<{ tab?: string; setupMode?: boolean } | null>;
  /** 「术语表」tab 里点 #glossary-btn 时打开术语表弹窗。 */
  onOpenGlossaries: () => void;
  /** 切到 API tab 前让凭据域预热表单（可选）。setupMode 原样透传。 */
  onPrepareCredentialPanels?: (options?: { setupMode?: boolean }) => void;
  credentialsWorkbenchSlot?: React.ReactNode | null;
  /**
   * 首次配置门的一句引导，只在 payload.setupMode 时渲染。由 HomeApp 注入而不是
   * 本文件直接 import credentials-dom-ids——那正是当初被拆成 slot 的原因。
   */
  apiPaneSetupHintSlot?: React.ReactNode | null;
  appUpdateBannerSlot?: React.ReactNode | null;
  /** 「同步」分栏的内容（由 HomeApp 注入 SyncSettingsPanel）。 */
  syncPanelSlot?: React.ReactNode | null;
};

export function SettingsDialog({
  dialogStore,
  onOpenGlossaries,
  onPrepareCredentialPanels,
  credentialsWorkbenchSlot = null,
  apiPaneSetupHintSlot = null,
  appUpdateBannerSlot = null,
  syncPanelSlot = null,
}: SettingsDialogProps) {

  const dialogState = useDialogState(dialogStore);
  const open = Boolean(dialogState.open);
  const { onCloseAutoFocus } = useDialogReturnFocus(open);
  const [activeTab, setActiveTab] = useState(dialogState.payload?.tab || "api");
  const setupMode = Boolean(dialogState.payload?.setupMode);

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
    // setupMode 必须跟着一起传：这个 effect 每次进 api tab 都跑，若只调无参版本
    // 就会把首配门刚设上的 setupMode 冲回 false，表单立刻退回普通形态。
    const prepare = () => onPrepareCredentialPanels?.({ setupMode });
    prepare();
    const raf = requestAnimationFrame(prepare);
    return () => cancelAnimationFrame(raf);
  }, [open, activeTab, onPrepareCredentialPanels, setupMode]);

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
                  <PaneHead tab="api" subtitle={setupMode ? apiPaneSetupHintSlot : null} />
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
                      术语表决定翻译时的优先译法。可维护多张术语表并
                      按需启用，翻译任务发起时生效。
                    </p>
                    <Button id={APP_SETTINGS_DIALOG_IDS.glossaryButton} className="app-settings-action" onClick={openGlossaries}>
                      打开术语表
                    </Button>
                  </div>
                </TabsPrimitive.Content>

                <TabsPrimitive.Content
                  value="sync"
                  forceMount
                  hidden={activeTab !== "sync"}
                  className={panelClass("sync")}
                  data-settings-panel="sync"
                >
                  <PaneHead tab="sync" />
                  {activeTab === "sync" ? syncPanelSlot : null}
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
