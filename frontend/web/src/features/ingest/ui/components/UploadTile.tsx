// 上传工作流容器。
//
// 本文件是唯一的 store/服务读取点：快照与派生值全部在顶部一次取齐，
// 再以 props 往下传；展示组件只收 props 发回调，不直连 services/store。
// 事件回调全部具名化，JSX 内不写内联箭头，保证 id/文案/disabled 语义不变。

import { useCallback, type MouseEvent as ReactMouseEvent } from "react";

import { useStoreSnapshot } from "@/ui/hooks/use-store.js";
import { APP_EVENTS } from "@/platform/contracts/app-contract.js";
import { useHomeServices } from "@/app/home/home-services-context.js";
import type { UploadViewStore } from "../../domain/upload-store.js";
import { TranslationOptionsPanel } from "./PageRangeDialog.jsx";
import { ProcessingChoicePanel } from "./upload/ProcessingChoicePanel.jsx";
import { UploadDropzone } from "./upload/UploadDropzone.jsx";
import {
  CredentialGateNotice,
  TranslationBudgetNote,
  UploadBudgetSlot,
} from "./upload/UploadWorkflowNotices.jsx";

export function HeroUpload() {
  const services = useHomeServices();

  // —— 顶部一次收敛：服务句柄 ——
  const stores = services.stores;
  const uploadFeature = services.features.uploadFeature;
  const storeOnlyAction = services.library.actions.storeOnly;
  const uploadDomRefs = services.uploadDomRefs;

  // —— 顶部一次收敛：store 快照 ——
  const upload = useStoreSnapshot(stores.uploadView);
  const workflow = useStoreSnapshot(stores.workflowView);
  const credentialsView = useStoreSnapshot(stores.credentialsView);

  // —— 顶部一次收敛：派生视图值 ——
  const credentialGateVisible = Boolean((credentialsView as any)?.credentialGate?.show);

  // —— 具名回调：回填隐藏 file input 的 DOM 引用 ——
  const handleFileInputRef = useCallback((node: HTMLInputElement | null) => {
    uploadDomRefs.fileInput = node;
  }, [uploadDomRefs]);

  // —— 具名回调：点击卡片空白处透传为文件选择 ——
  function handleTileClick(event: ReactMouseEvent<HTMLDivElement>) {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.closest("button") || target.closest("a") || target.closest("input")) return;

    const input = uploadDomRefs.fileInput;
    if (input && !input.disabled) input.click();
  }

  // —— 具名回调：每次点开文件框前先清空 value，保证同文件可重选 ——
  function handleFileInputClick() {
    if (uploadDomRefs.fileInput) uploadDomRefs.fileInput.value = "";
  }

  // —— 具名回调：文件变化后交给上传控制器处理 ——
  function handleFileChange() {
    void uploadFeature?.handleFileSelected();
  }

  // —— 具名回调：翻译选项弹窗开/关切换 ——
  function handleToggleTranslationOptions() {
    if (upload.pageRangeDialogOpen) {
      (stores.uploadView as unknown as UploadViewStore).actions.closePageRangeDialog();
      return;
    }
    uploadFeature?.openPageRangeDialog();
  }

  // —— 具名回调：打开浏览器凭据设置 ——
  function handleOpenSettings() {
    document.dispatchEvent(new CustomEvent(APP_EVENTS.openBrowserCredentials));
  }

  // —— 具名回调：仅收藏，不提交任务 ——
  function handleStoreOnly() {
    storeOnlyAction?.();
  }

  return (
    <div className="upload-workflow">
      <UploadDropzone
        upload={upload}
        fileInputRef={handleFileInputRef}
        onFileInputClick={handleFileInputClick}
        onFileChange={handleFileChange}
        onTileClick={handleTileClick}
        budgetSlot={(
          <UploadBudgetSlot>
            <TranslationBudgetNote budget={workflow.budget} />
          </UploadBudgetSlot>
        )}
      />

      <CredentialGateNotice
        visible={credentialGateVisible}
        onOpenSettings={handleOpenSettings}
      />

      <ProcessingChoicePanel
        visible={upload.actionSlotVisible}
        uploadReady={upload.ready}
        submitBusy={workflow.submitBusy}
        submitDisabled={workflow.submitDisabled}
        submitLabel={workflow.submitLabel}
        ocrOnly={workflow.ocrOnly}
        pageRangeButtonVisible={workflow.pageRangeButtonVisible}
        pageRangeOpen={upload.pageRangeDialogOpen}
        onToggleTranslationOptions={handleToggleTranslationOptions}
        onStoreOnly={handleStoreOnly}
        translationOptionsSlot={<TranslationOptionsPanel />}
      />
    </div>
  );
}

// 保留既有导出名，外部 feature 无需感知组件拆分。
export const UploadTile = HeroUpload;
