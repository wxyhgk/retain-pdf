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
// - [data-settings-tab="api|glossary|sync|backup|appearance|update"] 可点击
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
import { IconKey, IconBook, IconSync, IconChart, IconArchive, IconPalette, IconUpdate, IconUser, IconUsers } from "./settings-icons.jsx";
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
import { CommandLinePanel } from "./CommandLinePanel.jsx";
import { ThemeAppearancePanel } from "./ThemeAppearancePanel.jsx";
import { Button } from "@/ui/Button.jsx";

// Decoupled: settings → credentials / app-update 横向依赖改为经 HomeApp 注入(slot)。
// - credentialsWorkbenchSlot: 由 HomeApp 传入 <CredentialsWorkbench />
// - appUpdateBannerSlot: 由 HomeApp 传入 <AppUpdateBanner />
// 原先直接 import CredentialsWorkbench / AppUpdateBanner / credentials-dom-ids 导致
// settings 域强耦合 credentials 域；现仅依赖 shared/settings-dialog-ids (无状态常量)。


const TABS = [
  { id: "account", label: "账户", Icon: IconUser },
  { id: "admin", label: "账号管理", Icon: IconUsers },
  { id: "api", label: "接口设置", Icon: IconKey },
  { id: "glossary", label: "术语表", Icon: IconBook },
  { id: "usage", label: "总用量", Icon: IconChart },
  { id: "sync", label: "同步", Icon: IconSync },
  { id: "backup", label: "备份", Icon: IconArchive },
  { id: "appearance", label: "外观", Icon: IconPalette },
  { id: "update", label: "更新", Icon: IconUpdate },
];

const PANE_HEADS = {
  account: { title: "账户", desc: "当前登录的账号。" },
  admin: { title: "账号管理", desc: "账号由管理员创建，初始密码交给用户，用户首次登录时改成自己的密码。" },
  api: { title: "接口设置", desc: "" },
  glossary: { title: "术语表", desc: "维护术语偏好，翻译时优先使用你的术语。" },
  usage: { title: "总用量", desc: "全部书花掉的模型 token，按月、按模型、按环节。" },
  sync: { title: "同步", desc: "通过一个网盘文件夹，在几台电脑之间同步书库、译文和阅读进度。" },
  backup: { title: "备份", desc: "书库数据库每天自动备份，出问题时可以恢复到之前的某一天。" },
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
  /** 「备份」分栏的内容（由 HomeApp 注入 BackupPanel）。 */
  backupPanelSlot?: React.ReactNode | null;
  /** 「总用量」分栏的内容（由 HomeApp 注入 UsageSettingsPanel）。 */
  usagePanelSlot?: React.ReactNode | null;
  /** 多用户模式的「账户」「账号管理」分栏（不给就不出现，单机模式不给）。 */
  accountPanelSlot?: React.ReactNode | null;
  adminPanelSlot?: React.ReactNode | null;
  /** 不显示的分栏：多用户模式下普通用户看不到接口设置、同步、备份等单机才有的东西。 */
  hiddenTabs?: readonly string[];
};

export function SettingsDialog({
  dialogStore,
  onOpenGlossaries,
  onPrepareCredentialPanels,
  credentialsWorkbenchSlot = null,
  apiPaneSetupHintSlot = null,
  appUpdateBannerSlot = null,
  syncPanelSlot = null,
  backupPanelSlot = null,
  usagePanelSlot = null,
  accountPanelSlot = null,
  adminPanelSlot = null,
  hiddenTabs = [],
}: SettingsDialogProps) {
  const visibleTabs = TABS.filter(({ id }) => (
    !hiddenTabs.includes(id)
    && (id !== "account" || accountPanelSlot)
    && (id !== "admin" || adminPanelSlot)
  ));
  // 要打开的分栏被藏了（比如普通用户点到「接口设置」），就落到第一个能看的分栏。
  const pickTab = (requested?: string) => (
    visibleTabs.some(({ id }) => id === requested) ? `${requested}` : visibleTabs[0]?.id || "appearance"
  );

  const dialogState = useDialogState(dialogStore);
  const open = Boolean(dialogState.open);
  const { onCloseAutoFocus } = useDialogReturnFocus(open);
  const [activeTab, setActiveTab] = useState(() => pickTab(dialogState.payload?.tab || "api"));
  const setupMode = Boolean(dialogState.payload?.setupMode);

  useEffect(() => {
    if (open) {
      setActiveTab(pickTab(dialogState.payload?.tab || "api"));
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

  function handleOpenChange(nextOpen: boolean) {
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
                  {visibleTabs.map(({ id, label, Icon }) => (
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

                {accountPanelSlot ? (
                  <TabsPrimitive.Content value="account" forceMount hidden={activeTab !== "account"} className={panelClass("account")} data-settings-panel="account">
                    <PaneHead tab="account" />
                    {activeTab === "account" ? accountPanelSlot : null}
                  </TabsPrimitive.Content>
                ) : null}
                {adminPanelSlot ? (
                  <TabsPrimitive.Content value="admin" forceMount hidden={activeTab !== "admin"} className={panelClass("admin")} data-settings-panel="admin">
                    <PaneHead tab="admin" />
                    {activeTab === "admin" ? adminPanelSlot : null}
                  </TabsPrimitive.Content>
                ) : null}

                <TabsPrimitive.Content
                  value="api"
                  forceMount
                  hidden={activeTab !== "api"}
                  className={panelClass("api")}
                  data-settings-panel="api"
                >
                  <PaneHead tab="api" subtitle={setupMode ? apiPaneSetupHintSlot : null} />
                  {/* 被藏时不放内容：多用户的普通用户不该去读管理员专用的凭据、AI 设置接口。 */}
                  {hiddenTabs.includes("api") ? null : credentialsWorkbenchSlot}
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
                  value="backup"
                  forceMount
                  hidden={activeTab !== "backup"}
                  className={panelClass("backup")}
                  data-settings-panel="backup"
                >
                  <PaneHead tab="backup" />
                  {activeTab === "backup" ? backupPanelSlot : null}
                </TabsPrimitive.Content>

                <TabsPrimitive.Content
                  value="usage"
                  forceMount
                  hidden={activeTab !== "usage"}
                  className={panelClass("usage")}
                  data-settings-panel="usage"
                >
                  <PaneHead tab="usage" />
                  {activeTab === "usage" ? usagePanelSlot : null}
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
                  {activeTab === "update" ? <CommandLinePanel /> : null}
                </TabsPrimitive.Content>
              </div>
            </TabsPrimitive.Root>
          </DialogShell>
        </DialogContent>
    </Dialog>
  );
}
