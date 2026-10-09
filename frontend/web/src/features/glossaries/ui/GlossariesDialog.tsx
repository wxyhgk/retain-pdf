import { useState } from "react";
import { ConfirmDialog } from "@/ui/components/confirm-dialog.js";
// 生命周期,forceMount 会让它在对话框从未打开时就永久生效,制造新的无障碍
// 缺陷。术语表列表/编辑器的字段都受控于 glossariesStore(非本组件本地状态),
// 对话框关闭时 Content 卸载不会丢数据——controller.js 的 open() 在重新打开时
// 会 reloadGlossaries() 回填,语义不变。
//
// 打开入口:SettingsDialog"术语表"tab 的 #glossary-btn 调用
// services.glossaries.dialogStore.open()(蓝图 §0.4);本组件内部的 open 状态
// 迁移 effect(见 useGlossariesController.js)把这次打开接回 controller.js 的
// open(),补上"打开即刷新列表"的旧语义。

import {
  Dialog,
  DialogBody,
  DialogCloseButton,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogShell,
  DialogTitle,
} from "@/ui/components/dialog.js";
import { FormStatusLine } from "@/ui/components/form-status-line.js";
import { useDialogReturnFocus } from "@/ui/hooks/use-dialog-return-focus.js";
import { GLOSSARY_DOM_IDS } from "./glossaries-dom-ids.js";
import { useGlossariesController } from "./useGlossariesController.js";
import type { GlossariesControllerDeps } from "./useGlossariesController.js";
import type { GlossariesDialogStorePort } from "../domain/glossaries-store.js";
import { GlossaryList } from "./GlossaryList.jsx";
import { GlossaryEditor } from "./GlossaryEditor.jsx";
import { GlossaryImportPanel } from "./GlossaryImportPanel.jsx";
import { Button } from "@/ui/Button.jsx";


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
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [opBusy, setOpBusy] = useState(false);
  const draftName = `${view.draft?.name || ""}`.trim();

  // 保存/删除/导出进行中才禁用按钮：状态行文本无 tone 语义（"新术语表尚未保存。"
  // 这类提示语也有文案无 tone），不能拿它反推忙态。
  async function runOp(operation?: () => unknown) {
    if (opBusy) return;
    setOpBusy(true);
    try {
      await operation?.();
    } finally {
      setOpBusy(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      dialogStore.close();
    }
  }

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
                  <Button id={GLOSSARY_DOM_IDS.exportButton} className="app-button secondary" disabled={opBusy} onClick={() => void runOp(() => handlers?.exportCurrent?.())}>导出</Button>
                  <Button id={GLOSSARY_DOM_IDS.deleteButton} className="app-button secondary danger" disabled={opBusy} onClick={() => setConfirmDeleteOpen(true)}>删除</Button>
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
                <DialogFooter className="glossary-footer">
                  <FormStatusLine id={GLOSSARY_DOM_IDS.status} status={view.status} className="upload-status" />
                  <Button id={GLOSSARY_DOM_IDS.saveButton} className="app-button" disabled={opBusy} onClick={() => void runOp(() => handlers?.save?.())}>保存</Button>
                </DialogFooter>
              </section>
            </DialogBody>
            <ConfirmDialog
              id="glossary-delete-confirm"
              title="删除术语表"
              description={draftName ? `确定删除术语表「${draftName}」吗？删除后无法恢复。` : "确定删除当前术语表吗？删除后无法恢复。"}
              confirmLabel="删除"
              tone="danger"
              level="nested"
              open={confirmDeleteOpen}
              pending={opBusy}
              onOpenChange={(next) => { if (!next) setConfirmDeleteOpen(false); }}
              onConfirm={() => { setConfirmDeleteOpen(false); void runOp(() => handlers?.deleteCurrent?.()); }}
            />
          </DialogShell>
        </DialogContent>
    </Dialog>
  );
}
