// SettingsDialog：设置弹窗的外壳——左导航 + 右内容区。
//
// 2026-11-12 起它不知道有哪些分栏：收一张分栏表（SettingsSection，见 ui/settings/settings-section.ts），按
// order 排好画导航和内容。各功能在自己目录登记自己的分栏，装配层 app/home/shell/settings-sections.tsx 把它们
// 列成一张表（方案：docs/ops/planning/frontend-migration/20261112-功能登记表.md）。以前分栏列表 TABS、标题
// PANE_HEADS、九个 *PanelSlot 参数都写在这里，每加一个功能都要改这个文件。
//
// 布局：左侧竖排导航（图标+名称，Radix Tabs orientation=vertical，方向键可用），右侧内容窗格（每区自带
// 标题行 + 正文，独立滚动）。首次配置门也是本弹窗停在 api 分栏（payload.setupMode），不再有第二个外壳。
//
// 【测试契约，改版不许破】（credentials/glossaries/app-update component tests）：
// - #app-settings-dialog / #app-settings-close-btn
// - [data-settings-tab=<分栏 id>] 可点击
// - [data-settings-panel=<分栏 id>] forceMount + hidden 属性切换（测试断言 .hidden）
//
// 开合状态跨子树走 settings-hub-dialog-store；分栏切换是子树内瞬态（useState）。
// 不 forceMount Dialog 的 Content/Overlay：Radix modal Content 内部的 hideOthers(content) effect 依赖真实的
// mount/unmount 生命周期（deps=[]），forceMount 会让它在对话框从未打开时就永久生效，反而制造无障碍缺陷。

import { useEffect, useMemo, useState } from "react";
import { Tabs as TabsPrimitive } from "radix-ui";
import {
  Button,
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogShell,
  DialogTitle,
} from "@retainpdf/ui";
import { useDialogState } from "@/ui/hooks/use-dialog-state.js";
import type { DialogStore } from "@/platform/store/dialog-store.js";
import { useDialogReturnFocus } from "@/ui/hooks/use-dialog-return-focus.js";
import { sortSettingsSections, type SettingsSection } from "@/ui/settings/settings-section.js";
import { APP_SETTINGS_DIALOG_IDS } from "./settings-dialog-ids.js";

export type SettingsDialogProps = {
  /**
   * 弹窗开合状态。payload.tab 决定打开时停在哪个分栏（不给停在 api）；payload.setupMode 表示这次是首次配置门
   * ——首配不另开外壳，就是本弹窗停在 api 分栏，分栏自己按 setupMode 多一句引导、按钮变「保存并启动」。
   */
  dialogStore: DialogStore<{ tab?: string; setupMode?: boolean } | null>;
  /** 要显示的分栏。谁能看见由调用方定（多用户的普通用户看不到接口设置等），这里有什么画什么。 */
  sections: readonly SettingsSection[];
  /** 点标题旁的「?」：打开说明书里讲这一栏的那一页（参数是分栏登记的 guide，即模块名）。不给就不显示「?」。 */
  onOpenGuide?: (module: string) => void;
};

function PaneHead({ section, setupMode, active, onOpenGuide }: {
  section: SettingsSection;
  setupMode: boolean;
  active: boolean;
  onOpenGuide?: (module: string) => void;
}) {
  const subtitle = section.subtitle?.({ active, setupMode }) ?? null;
  const guide = section.guide;
  return (
    <header className="app-settings-pane-head">
      <h3>
        {section.title || section.label}
        {guide && onOpenGuide ? (
          <Button
            className="settings-guide-link"
            title="使用说明"
            aria-label={`${section.label}的使用说明`}
            data-settings-guide={guide}
            onClick={() => onOpenGuide(guide)}
          >
            ?
          </Button>
        ) : null}
      </h3>
      {subtitle}
      {section.description ? <p>{section.description}</p> : null}
    </header>
  );
}

export function SettingsDialog({ dialogStore, sections, onOpenGuide }: SettingsDialogProps) {
  const visible = useMemo(() => sortSettingsSections(sections), [sections]);
  // 要打开的分栏不在表里（比如普通用户点到「接口设置」），就落到第一个能看的分栏。
  const pickTab = (requested?: string) => (
    visible.some(({ id }) => id === requested) ? `${requested}` : visible[0]?.id || ""
  );

  const dialogState = useDialogState(dialogStore);
  const open = Boolean(dialogState.open);
  const { onCloseAutoFocus } = useDialogReturnFocus(open);
  const [activeTab, setActiveTab] = useState(() => pickTab(dialogState.payload?.tab || "api"));
  const setupMode = Boolean(dialogState.payload?.setupMode);
  const activeSection = visible.find(({ id }) => id === activeTab) || null;

  useEffect(() => {
    if (open) {
      setActiveTab(pickTab(dialogState.payload?.tab || "api"));
    }
  }, [open]);

  // 切到某一栏时让它预热（接口设置：从凭据状态回填表单，不开二层弹窗）。内容是 forceMount 的，已经挂着；
  // 下一帧再补一次，避免 ref 还没挂上导致密码框空白、保存读到空串。setupMode 要一起传：这个 effect 每次进
  // 接口设置都跑，只调无参版本会把首配门刚设上的 setupMode 冲回 false。
  const onShow = activeSection?.onShow;
  useEffect(() => {
    if (!open || !onShow) {
      return;
    }
    const prepare = () => onShow({ setupMode });
    prepare();
    const raf = requestAnimationFrame(prepare);
    return () => cancelAnimationFrame(raf);
  }, [open, activeTab, onShow, setupMode]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      dialogStore.close();
    }
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
                  {visible.map(({ id, label, Icon }) => (
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

                {visible.map((section) => {
                  const active = activeTab === section.id;
                  const context = { active, setupMode };
                  return (
                    <TabsPrimitive.Content
                      key={section.id}
                      value={section.id}
                      forceMount
                      hidden={!active}
                      // 纯字面量（含空格分隔），避开 Tailwind v4 扫描器的 `x${y}` 模板坑
                      className={active ? "app-settings-panel is-current" : "app-settings-panel"}
                      data-settings-panel={section.id}
                    >
                      <PaneHead section={section} setupMode={setupMode} active={active} onOpenGuide={onOpenGuide} />
                      {section.lazy === false || active ? section.render(context) : null}
                    </TabsPrimitive.Content>
                  );
                })}
              </div>
            </TabsPrimitive.Root>
          </DialogShell>
        </DialogContent>
    </Dialog>
  );
}
