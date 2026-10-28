// 上传工作流容器。
//
// 本文件是唯一的 store/服务读取点：快照与派生值全部在顶部一次取齐，
// 再以 props 往下传；展示组件只收 props 发回调，不直连 services/store。
// 事件回调全部具名化，JSX 内不写内联箭头，保证 id/文案/disabled 语义不变。

import { useCallback, useEffect, useState, useSyncExternalStore, type MouseEvent as ReactMouseEvent } from "react";
import { toast } from "sonner";

import { useStoreSnapshot } from "@/ui/hooks/use-store.js";
import { APP_EVENTS } from "@/platform/contracts/app-contract.js";
import {
  useHomeCredentialsViewStore,
  useHomeUploadDomRefs,
} from "@/ui/context/home-services-context.js";
import { useIngestServices, useIngestWorkflowView } from "../workflow-view-context.js";
import { TranslationOptionsPanel } from "./TranslationOptionsPanel.jsx";
import { ProcessingChoicePanel } from "./upload/ProcessingChoicePanel.jsx";
import { UploadDropzone } from "./upload/UploadDropzone.jsx";
import { BatchUploadPanel } from "./upload/BatchUploadPanel.jsx";
import { createBatchUploadSession, summarizeBatch, type BatchUploadSession } from "../../domain/upload/batch-session.js";
import {
  CredentialGateNotice,
  TranslationBudgetNote,
  UploadBudgetSlot,
} from "./upload/UploadWorkflowNotices.jsx";
import { useLibraryServices } from "@/features/library/index.js";

// 一次选了多个 PDF 时的会话；没有就是单本的老流程。
function useBatchState(session: BatchUploadSession | null) {
  const subscribe = useCallback(
    (onChange: () => void) => (session ? session.subscribe(onChange) : () => {}),
    [session],
  );
  return useSyncExternalStore(subscribe, () => session?.getSnapshot() ?? null);
}

function closeIngestDialog() {
  document.dispatchEvent(new CustomEvent(APP_EVENTS.closeTranslationWorkflow));
}

export function HeroUpload() {
  // —— 顶部一次收敛：服务句柄 ——
  const { uploadViewStore, features } = useIngestServices();
  const workflowView = useIngestWorkflowView();
  const credentialsViewStore = useHomeCredentialsViewStore();
  const library = useLibraryServices();
  const uploadFeature = features.uploadFeature;
  const storeOnlyAction = library.actions.storeOnly;
  const uploadDomRefs = useHomeUploadDomRefs();

  // —— 顶部一次收敛：store 快照 ——
  const upload = useStoreSnapshot(uploadViewStore);
  const workflow = useStoreSnapshot(workflowView.store);
  const credentialsView = useStoreSnapshot(credentialsViewStore);

  // —— 一次上传多本：选了不止一个文件时换成每本一行的列表 ——
  const [batchSession, setBatchSession] = useState<BatchUploadSession | null>(null);
  const batch = useBatchState(batchSession);
  useEffect(() => () => batchSession?.dispose(), [batchSession]);

  // —— 顶部一次收敛：派生视图值 ——
  // credentialsViewStore 经 HomeReadStore（默认 any）读出，这里只读取 show 字段。
  const credentialGateVisible = Boolean((credentialsView as { credentialGate?: { show?: boolean } } | undefined)?.credentialGate?.show);

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

  // —— 具名回调：文件变化后交给上传控制器处理；选了多个就走一次上传多本 ——
  function handleFileChange() {
    const selected = Array.from(uploadDomRefs.fileInput?.files || []);
    if (selected.length > 1) {
      startBatch(selected);
      return;
    }
    void uploadFeature?.handleFileSelected();
  }

  function startBatch(selected: File[]) {
    const uploadFile = uploadFeature?.uploadFileForBatch;
    const submitBatch = features.appActionsFeature?.submitBatch;
    if (!uploadFile || !submitBatch) return;
    // 单本那边可能已经传了一本：清掉，免得「直接翻译」还拿着它。
    uploadFeature?.resetUploadSession();
    uploadViewStore.actions.closeTranslationOptions();
    const session = createBatchUploadSession({ uploadFile, submitBatch });
    setBatchSession(session);
    void session.start(selected);
  }

  function handleBatchSubmit() {
    void submitBatchAndClose();
  }

  async function submitBatchAndClose() {
    const result = await batchSession?.submit();
    if (!result?.allSubmitted || !batchSession) return;
    // 可能分了几次才交完：按整批算。
    const submitted = summarizeBatch(batchSession.getSnapshot()).submitted;
    toast.success(`已提交 ${submitted} 本`, { description: "书架上可以看每本的进度。" });
    closeIngestDialog();
  }

  function handleBatchStoreOnly() {
    const stored = batch?.items.filter((item) => item.uploadId).length || 0;
    if (stored) toast.success(`${stored} 本已收进书库`);
    closeIngestDialog();
  }

  function handleBatchReset() {
    setBatchSession(null);
    uploadViewStore.actions.closeTranslationOptions();
  }

  // —— 具名回调：翻译选项开/关切换 ——
  function handleToggleTranslationOptions() {
    if (upload.translationOptionsOpen) {
      uploadViewStore.actions.closeTranslationOptions();
      return;
    }
    uploadFeature?.openTranslationOptions();
  }

  // —— 具名回调：打开浏览器凭据设置 ——
  function handleOpenSettings() {
    document.dispatchEvent(new CustomEvent(APP_EVENTS.openBrowserCredentials));
  }

  // —— 具名回调：仅收藏，不提交任务 ——
  function handleStoreOnly() {
    storeOnlyAction?.();
  }

  if (batch) {
    return (
      <div className="upload-workflow">
        <BatchUploadPanel
          batch={batch}
          ocrOnly={Boolean(workflow.ocrOnly)}
          optionsOpen={upload.translationOptionsOpen}
          onToggleOptions={handleToggleTranslationOptions}
          onSubmit={handleBatchSubmit}
          onStoreOnly={handleBatchStoreOnly}
          onReset={handleBatchReset}
          optionsSlot={<TranslationOptionsPanel hidePageRange />}
        />
        <CredentialGateNotice
          visible={credentialGateVisible}
          onOpenSettings={handleOpenSettings}
        />
      </div>
    );
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
        pageRangeOpen={upload.translationOptionsOpen}
        onToggleTranslationOptions={handleToggleTranslationOptions}
        onStoreOnly={handleStoreOnly}
        translationOptionsSlot={<TranslationOptionsPanel />}
      />
    </div>
  );
}

// 保留既有导出名，外部 feature 无需感知组件拆分。
export const UploadTile = HeroUpload;
