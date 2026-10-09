// 上传对话框 —— 仅「添加 PDF」上传入口。
//
// 弹窗只做上传：不再有 STATUS 模式，也不在弹窗里渲染进度卡。提交成功（或仅收藏）
// 后关闭弹窗，并直接打开该文档的书籍详情 —— 进度统一在详情「进度」Tab。
//
// Document identity: 上传即建档，POST /uploads 现在返回 document_id（= 内容哈希）。
// 前端把它存进 upload session state（uploadStatePort.documentId），上传结束后凭它
// 直接 openBookDetail，不需要再反查。
//
// 关闭仍统一路由到 services.workflowDialog.requestClose()（Escape/背板/关闭按钮
// 三路径一致）；Escape 的 preventDefault 保留，实际关闭交给既有 document 监听器。
//
// 提交仍与旧实现一样在 capture 阶段拦截 #job-form（WorkflowPanel 内的 onSubmit
// 被 stopPropagation 压住，避免跑两遍 submit-flow）：失败留屏展示行内错误，
// 成功则跳详情。

import { useEffect, useRef } from "react";
import { SUBMIT_BLOCK_REASONS } from "@/platform/contracts/submit-readiness-contract.js";
import {
  TRANSLATION_WORKFLOW_DIALOG,
} from "../domain.js";
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogShell,
  DialogTitle,
} from "@/ui/components/dialog.js";
import { useStoreSnapshot } from "@/ui/hooks/use-store.js";
import {
  useHomeBridge,
  useHomeDialogStore,
  useHomeUploadStatePort,
  useHomeWorkflowDialog,
} from "@/ui/context/home-services-context.js";
import { useDialogReturnFocus } from "@/ui/hooks/use-dialog-return-focus.js";
import { WorkflowPanel } from "./WorkflowPanel.jsx";
import { useLibraryServices } from "@/features/library/index.js";

/** 提交表单的结果：status 为 submitted / blocked / 其它失败态。 */
type SubmitFormResult = {
  status?: string;
  readiness?: { reason?: string } | null;
  payload?: { job_id?: string; document_id?: string } | null;
} | null;

// statusCardSlot 已移除：进度不再进本弹窗。
export function IngestDialog({
  hiddenInputsSlot = null,
}: {
  hiddenInputsSlot?: React.ReactNode | null;
} = {}) {
  const dialogStore = useHomeDialogStore();
  const uploadStatePort = useHomeUploadStatePort();
  const library = useLibraryServices();
  const workflowDialog = useHomeWorkflowDialog();
  const bridge = useHomeBridge();
  const dialog = useStoreSnapshot(dialogStore);
  const open = Boolean(dialog.open);
  const { onCloseAutoFocus } = useDialogReturnFocus(open);

  // <html> 级样式钩子在 React 根之外，用 effect 同步（卸载时清理）。
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle(TRANSLATION_WORKFLOW_DIALOG.classes.rootOpen, open);
    return () => root.classList.remove(TRANSLATION_WORKFLOW_DIALOG.classes.rootOpen);
  }, [open]);

  function readUploadedDocumentId() {
    try {
      return `${uploadStatePort?.getSnapshot?.()?.documentId || ""}`.trim();
    } catch {
      return "";
    }
  }

  // 上传/提交结束后跳到该文档的书籍详情。仅收藏没有 job，落概览；提交了任务则
  // 直接落「进度」Tab。
  function openUploadedDocumentDetail(payload?: { job_id?: string; document_id?: string } | null) {
    const documentId = readUploadedDocumentId() || `${payload?.document_id || ""}`.trim();
    if (!documentId) return;
    const jobId = `${payload?.job_id || ""}`.trim();
    library.actions.openBookDetail({
      document_id: documentId,
      ...(jobId ? { job_id: jobId, active_job_id: jobId, prefer_translate_tab: true } : {}),
    });
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      workflowDialog.requestClose();
    }
  }

  const submittingRef = useRef(false);
  // 被拦提交的下一步定位：凭据/配置缺失由 submit-flow 弹框承接，这里只处理
  // 有明确站内目标的缺失项（文件选择 / Render 源与术语表入口 / 余额提示）。
  function focusBlockedSubmitTarget(readiness: { reason?: string } | null | undefined) {
    try {
      const reason = `${readiness?.reason || ""}`;
      let targetId = "";
      if (reason === SUBMIT_BLOCK_REASONS.MISSING_UPLOAD) {
        targetId = "file";
      } else if (reason === SUBMIT_BLOCK_REASONS.MISSING_RENDER_SOURCE) {
        targetId = "page-range-btn";
      } else if (reason === SUBMIT_BLOCK_REASONS.BUDGET_BLOCKING) {
        targetId = "translation-budget-note";
      }
      if (!targetId) return;
      const target = document.getElementById(targetId) as HTMLElement | null;
      if (!target || typeof target.focus !== "function") return;
      if (!target.hasAttribute("tabindex") && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) {
        target.setAttribute("tabindex", "-1");
      }
      target.focus({ preventScroll: true });
    } catch {
      // 定位失败不影响留屏可重提。
    }
  }
  function handleJobFormSubmitCapture(event: React.FormEvent) {
    const target = event.target as unknown as Element | null;
    const form = target && typeof target.closest === "function"
      ? target.closest("#job-form")
      : null;
    if (!form) return;
    event.preventDefault();
    event.stopPropagation();
    if (submittingRef.current) return;
    submittingRef.current = true;
    void (async () => {
      let result: SubmitFormResult = null;
      try {
        // bridge.submitForm 返回 unknown（home-services-context），这里按 submit-flow 的结果形状收窄。
        result = await bridge.submitForm(
          event as unknown as { preventDefault?: () => void },
        ) as SubmitFormResult;
      } catch {
        // submit-flow 已落 error-box 行内错误，这里只保对话框不关。
      }
      submittingRef.current = false;
      if (`${result?.status || ""}` === "blocked") {
        focusBlockedSubmitTarget(result?.readiness);
        return; // 被拦：留屏可重提，并已把焦点带到缺失项。
      }
      if (`${result?.status || ""}` !== "submitted") return; // 失败/被拦：留屏可重提。
      openUploadedDocumentDetail(result?.payload);
    })();
  }

  // 「仅收藏」也跳详情：让关闭事件先走完再开详情，避免两个模态弹窗同时抢焦点。
  function handleShellClickCapture(event: React.MouseEvent) {
    const target = event.target as Element | null;
    if (target && typeof target.closest === "function" && target.closest("#store-only-btn")) {
      globalThis.setTimeout(() => openUploadedDocumentDetail(null), 0);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          id={TRANSLATION_WORKFLOW_DIALOG.ids.dialog}
          className={`translation-workflow-dialog ${TRANSLATION_WORKFLOW_DIALOG.classes.uploadMode}`}
          data-open={TRANSLATION_WORKFLOW_DIALOG.datasetValues.open}
          onCloseAutoFocus={onCloseAutoFocus}
          onEscapeKeyDown={(event) => event.preventDefault()}
          aria-labelledby={TRANSLATION_WORKFLOW_DIALOG.ids.title}
          showCloseButton={false}
          size="standard"
        >
          <DialogShell
            className="desktop-shell translation-workflow-shell"
            onSubmitCapture={handleJobFormSubmitCapture}
            onClickCapture={handleShellClickCapture}
          >
            <DialogHeader className="translation-workflow-head is-upload-head">
              <DialogTitle asChild>
                <h2 id={TRANSLATION_WORKFLOW_DIALOG.ids.title} className="sr-only">
                  {TRANSLATION_WORKFLOW_DIALOG.copy.uploadTitle}
                </h2>
              </DialogTitle>
              <DialogCloseButton
                id={TRANSLATION_WORKFLOW_DIALOG.ids.closeButton}
              />
            </DialogHeader>
            <WorkflowPanel hiddenInputsSlot={hiddenInputsSlot} />
          </DialogShell>
        </DialogContent>
    </Dialog>
  );
}
