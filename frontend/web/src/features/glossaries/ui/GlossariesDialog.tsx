// GlossariesDialog(React 版 <glossary-manager-dialog>,对照
// components/dialogs/glossary-manager-dialog-template.js 逐 id 镜像 +
// features/glossaries/controller.js(kept 控制器)的开合/读取/保存编排)。
//
// Dialog 渲染层统一走 src/components/ui/dialog.tsx 的 AppDialog 契约；
// 业务类只保留术语表内部的双栏编辑布局。open 受控于
// glossariesDialogStore(useGlossariesController 的 open),onOpenChange 在
// next===false 时统一调用 dialogStore.close()——Escape、点击背板、点击关闭
// 按钮三条路径都走这一个回调,不再需要手写 handleBackdropClick/keydown 监听。
//
// 不 forceMount Content/Overlay(同 CredentialsDialog.jsx 头注释的结论):Radix
// modal Content 内部 hideOthers(content) 的 effect 依赖真实 mount/unmount
// 生命周期,forceMount 会让它在对话框从未打开时就永久生效,制造新的无障碍
// 缺陷。词表列表/编辑器的字段都受控于 glossariesStore(非本组件本地状态),
// 对话框关闭时 Content 卸载不会丢数据——controller.js 的 open() 在重新打开时
// 会 reloadGlossaries() 回填,语义不变。
//
// 打开入口:SettingsHubDialog"词表"tab 的 #glossary-btn 调用
// services.glossaries.dialogStore.open()(蓝图 §0.4);本组件内部的 open 状态
// 迁移 effect(见 useGlossariesController.js)把这次打开接回 controller.js 的
// open(),补上"打开即刷新列表"的旧语义。

import {
  Dialog,
  DialogBody,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogShell,
  DialogTitle,
} from "@/ui/components/dialog.js";
import { useDialogReturnFocus } from "@/ui/hooks/use-dialog-return-focus.js";
import { GLOSSARY_DOM_IDS } from "./glossaries-dom-ids.js";
import { useGlossariesController } from "./useGlossariesController.js";
import type { GlossariesControllerDeps } from "./useGlossariesController.js";
import type { GlossariesDialogStorePort } from "../domain/glossaries-store.js";
import { GlossaryList } from "./GlossaryList.jsx";
import { GlossaryEditor } from "./GlossaryEditor.jsx";
import { GlossaryImportPanel } from "./GlossaryImportPanel.jsx";
import { Button as ButtonBase } from "@/ui/Button.jsx";
import type { ButtonHTMLAttributes, ComponentType } from "react";

// Button.size 在未注解源文件里被推断为必填;unstyled 路径运行时不用 size。
// GlossariesDialog 未迁移前的旧写法是 `as any`，这里收敛为"结构相同的按钮契约"，
// 运行时仍是同一个 ButtonBase，行为不变。
const Button = ButtonBase as unknown as ComponentType<
  ButtonHTMLAttributes<HTMLButtonElement> & { className?: string }
>;

/**
 * 视图依赖由调用方注入，而不是从页面的服务上下文里自取：
 * 功能不应反向依赖某个具体页面的装配层(app/home)。
 * 主页在 HomeApp 的挂载点把 services.glossaries 拆开传进来
 * （见 HomeApp 的 GlossariesDialogSlot，镜像 AppUpdateBannerSlot）。
 */
export type GlossariesDialogProps = GlossariesControllerDeps & {
  dialogStore: GlossariesDialogStorePort;
};

export function GlossariesDialog({ feature, view: viewFeature, open, dialogStore }: GlossariesDialogProps) {
  const { view, store: glossariesStore, handlers } = useGlossariesController({ feature, view: viewFeature, open });
  // view.store 在 HomeServices 上仍是 AppStore 默认泛型；运行时 actions 齐全
  const store = glossariesStore as unknown as {
    actions: {
      setName: (name: string) => unknown;
      updateEntryField: (payload: { index: number; field: string; value: unknown }) => unknown;
      removeEntryRow: (index: number) => unknown;
      setCsvText: (value: string) => unknown;
    };
  };
  const { onCloseAutoFocus } = useDialogReturnFocus(open);

  function handleOpenChange(nextOpen) {
    if (!nextOpen) {
      dialogStore.close();
    }
  }

  const status = view.status || { message: "", tone: "" };
  const statusContent = `${status.message || ""}`.trim();
  const statusClasses = [
    "upload-status",
    statusContent ? "" : "hidden",
    status.tone === "valid" ? "is-valid" : "",
    status.tone === "error" ? "is-error" : "",
  ].filter(Boolean).join(" ");

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          id={GLOSSARY_DOM_IDS.dialog}
          className="glossary-manager-dialog"
          onCloseAutoFocus={onCloseAutoFocus}
          showCloseButton={false}
        >
          <DialogShell className="desktop-shell glossary-manager-shell">
            <DialogHeader className="desktop-head">
              <div className="credential-dialog-head">
                <DialogTitle asChild>
                  <h2>术语表</h2>
                </DialogTitle>
              </div>
              <DialogCloseButton id={GLOSSARY_DOM_IDS.closeButton} />
            </DialogHeader>
            <DialogBody className="desktop-body glossary-manager-body">
              <GlossaryList
                items={view.items}
                selectedId={view.selectedId}
                onSelect={(glossaryId) => handlers?.selectGlossary?.(glossaryId)}
                onCreateNew={() => handlers?.createNew?.()}
              />

              <section className="glossary-editor-panel">
                <label className="glossary-name-field">
                  <span>名称</span>
                  <input
                    id={GLOSSARY_DOM_IDS.nameInput}
                    type="text"
                    autoComplete="off"
                    placeholder="例如 量子化学术语"
                    value={view.draft.name}
                    onChange={(event) => store.actions.setName(event.target.value)}
                  />
                </label>
                <div className="glossary-toolbar">
                  <Button id={GLOSSARY_DOM_IDS.addRowButton} className="app-button secondary" onClick={() => handlers?.addRow?.()}>添加</Button>
                  <Button id={GLOSSARY_DOM_IDS.importButton} className="app-button secondary" onClick={() => handlers?.showImport?.()}>CSV</Button>
                  <Button id={GLOSSARY_DOM_IDS.exportButton} className="app-button secondary" onClick={() => handlers?.exportCurrent?.()}>导出</Button>
                  <Button id={GLOSSARY_DOM_IDS.deleteButton} className="app-button secondary danger" onClick={() => handlers?.deleteCurrent?.()}>删除</Button>
                </div>
                <div className="glossary-editor-scroll">
                  <GlossaryEditor
                    entries={view.draft.entries}
                    onFieldChange={(index, field, value) => store.actions.updateEntryField({ index, field, value })}
                    onRemoveRow={(index) => store.actions.removeEntryRow(index)}
                  />
                  <GlossaryImportPanel
                    visible={view.importVisible}
                    csvText={view.csvText}
                    onCsvTextChange={(value) => store.actions.setCsvText(value)}
                    onApply={() => handlers?.applyImport?.()}
                    onCancel={() => handlers?.hideImport?.()}
                  />
                </div>
                <div className="glossary-footer">
                  <span id={GLOSSARY_DOM_IDS.status} className={statusClasses}>{statusContent}</span>
                  <Button id={GLOSSARY_DOM_IDS.saveButton} className="app-button" onClick={() => handlers?.save?.()}>保存</Button>
                </div>
              </section>
            </DialogBody>
          </DialogShell>
        </DialogContent>
    </Dialog>
  );
}
