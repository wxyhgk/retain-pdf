// 翻译工作流对话框 —— 仅「添加 PDF」上传入口使用。
//
// 书本任务进度 / 发起翻译已迁到书籍详情「翻译」Tab：
//   BookTranslationWorkflowPanel（#book-detail-status-section）
// 勿再把已有 document 的进度抬进本弹窗；selectJob 有 document_id 时会打开详情。
//
// Dialog 渲染层统一走共享 AppDialog；上传态与状态态都使用 standard 尺寸，
// 为大号拖放区与行内翻译选项保留足够空间。内部工作流卡片与状态卡仍由本
// feature 负责。
// 相比阶段 C 第一批(CredentialsDialog 等 4 个,dialog-store.js 工厂 + 单态
// 关闭语义)结构上有三处不同,逐一说明:
//
// 1. 开合状态源不是 dialog-store.js 工厂,是 bespoke createStore 包装的
//    dialogStatePort({open,mode})——services.stores.dialog 快照。本文件不改
//    这层(铁律),只换渲染。
//
// 2. 两态语义(dialog.mode: UPLOAD/STATUS)是对话框*内部*状态,不是 Radix 的
//    open/close——mode 只影响标题文案和 statusMode/uploadMode 两个 class,
//    与本次迁移正交,原样保留。
//
// 3. 关闭统一路由到 requestClose():Escape/背板/关闭按钮三条触发路径都必须走
//    services.workflowDialog.requestClose()(见 translation-workflow-dialog-
//    runtime.js),不能有任何一条绕过去直接调 dialogStatePort.close()——3b 库
//    刷新挂起/恢复(bindings.js)依赖 closeTranslationWorkflow 事件在 document
//    上可见,只有走 requestClose() 才会 dispatch 这个事件。
//
//    requestClose() 现在是"一次点击直接关闭"(不再是早期的两段式:状态可见时
//    先 returnHome、对话框不关)。两段式被用户判定为不符合预期(点任务进度的
//    × 会弹回空上传表单、还顺带 stopPolling 把任务重置),已改成 × = 关闭;
//    中止任务改由 StatusCard 的"取消任务"按钮负责。
//
//    Escape 键仍需额外处理:本对话框有一条独立的 document 级 keydown 监听
//    (runtime 的 bindEvents,事件契约要它在 document 上可见,不能删),已经在
//    调 requestClose()。若同时让 Radix Content 的 onEscapeKeyDown 走默认行为
//    (触发 onOpenChange(false) → requestClose()),一次 Escape 会触发两次
//    requestClose(),两次 closeTranslationWorkflow 事件会让 bindings.js 的
//    挂起/恢复逻辑重复跑一遍。这里显式 onEscapeKeyDown={(e)=>e.preventDefault()}
//    把 Escape 完全交给既有 document 监听器处理——DismissableLayer 的 keydown
//    挂在 capture 阶段、bindEvents 挂在 bubble 阶段,前者先跑并被我们
//    preventDefault(),Radix 自己的 onDismiss 被跳过,随后 bubble 阶段 bindEvents
//    正常触发一次 requestClose(),三条路径最终都恰好调用一次,不重复。
//
// 4. 不 forceMount Content(同其余对话框的决策，见 use-dialog-return-focus.js
//    头注释——forceMount 会让 Radix modal Content 内部的 hideOthers() 副作用
//    在应用启动时就永久生效)。WorkflowPanel(上传表单)和 #status-section(3b
//    StatusCard)因此随对话框关闭一起卸载。openUpload() 每次打开都无条件
//    resetUploadSession(),不存在跨开合保留上传态的预期;job-runtime 轮询引擎
//    是独立于 React 挂载生命周期的服务(store 驱动,不依赖 StatusCard 是否挂载),
//    卸载 StatusCard 不影响后台轮询——任务到终态时引擎自己 stopPolling,关闭
//    对话框不会漏掉常驻轮询。
//
// <html> 级样式钩子(rootOpen class)在 React 根之外,用 effect 同步(卸载时
// 清理),保持不动。触发按钮("添加",在 LibraryBottomBar 里)与本对话框跨
// 子树，Radix 默认的 triggerRef 焦点归还机制失效，复用
// use-dialog-return-focus.js(同 CredentialsDialog 等的先例)。

import { useEffect, useRef } from "react";
import {
  TRANSLATION_WORKFLOW_DIALOG,
  TRANSLATION_WORKFLOW_MODES,
  type TranslationWorkflowDialogStatePort,
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
import { useHomeServices } from "@/app/home/home-services-context.js";
import { useDialogReturnFocus } from "@/ui/hooks/use-dialog-return-focus.js";
import { WorkflowPanel } from "./WorkflowPanel.jsx";
import {
  APP_EVENTS,
} from "@/platform/contracts/app-contract.js";

// Decoupled: workflow → status 横向依赖改为经 HomeApp 注入(slot/prop)。
// - statusCardSlot: 由 HomeApp 传入 <StatusCard ... /> (原先直接 import StatusCard)
// - hiddenInputsSlot: 透传给 WorkflowPanel 的隐藏凭据 inputs (原先 WorkflowPanel 直接 import HiddenCredentialInputs)
// 保持向后兼容:若 slot 未注入则退化为不渲染(不用在 workflow 域内再 import status/credentials)。

export function TranslationWorkflowDialog({
  statusCardSlot = null,
  hiddenInputsSlot = null,
}: {
  statusCardSlot?: React.ReactNode | null;
  hiddenInputsSlot?: React.ReactNode | null;
} = {}) {
  const services = useHomeServices();
  const dialog = useStoreSnapshot(services.stores.dialog);
  const statusArea = useStoreSnapshot(services.stores.statusArea);

  const open = Boolean(dialog.open);
  const statusMode = dialog.mode === TRANSLATION_WORKFLOW_MODES.STATUS;
  const { onCloseAutoFocus } = useDialogReturnFocus(open);

  // <html> 级样式钩子在 React 根之外,用 effect 同步(卸载时清理)
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle(TRANSLATION_WORKFLOW_DIALOG.classes.rootOpen, open);
    return () => root.classList.remove(TRANSLATION_WORKFLOW_DIALOG.classes.rootOpen);
  }, [open]);

  const contentClasses = [
    "translation-workflow-dialog",
    statusMode
      ? TRANSLATION_WORKFLOW_DIALOG.classes.statusMode
      : TRANSLATION_WORKFLOW_DIALOG.classes.uploadMode,
  ].join(" ");

  // Escape(见头注释第 3 点，这里只 preventDefault，实际关闭由既有 document
  // 监听器处理)/ 背板点击(DismissableLayer 的 outside-click 检测)/ 关闭按钮
  // (DialogCloseButton)最终都统一路由到 requestClose() 的两段式关闭判断
  // (状态可见先 returnHome，否则才真正 close)，不直接调
  // dialogStatePort/dialogStore 的 close()。
  function handleOpenChange(nextOpen) {
    if (!nextOpen) {
      services.workflowDialog.requestClose();
    }
  }

  // B2 提交接线(仅本文件,不碰 Escape/背板/× 三路径与 requestClose 逻辑):
  // #job-form 的提交在这里 capture 阶段统一拦截,单次调用 bridge.submitForm,
  // WorkflowPanel 内的 onSubmit 由 stopPropagation 压住,避免一次提交跑两遍
  // submit-flow。
  // - 失败/被拦:submit-flow 已把原因写进 text store 的 error-box,WorkflowPanel
  //   内的 InlineErrorBox(已有 error-box 行内红字样式)直接展示;这里不关对话
  //   框、不卸载,用户改参可直接重提。
  // - 成功:submit-flow 会先 setWorkflowSections(抬起状态区)再 dispatch
  //   closeTranslationWorkflow(关对话框)。成功以状态区可见为准,这里补发一次
  //   带 STATUS 的 openTranslationWorkflow 事件(复用既有 document 事件契约),
  //   经 runtime.openFromEvent 原子落为 STATUS 态看进度,同时 DOM data-open
  //   与 store 保持一致(3b 库刷新挂起/恢复读的是 DOM)。
  const submittingRef = useRef(false);
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
      try {
        await services.bridge.submitForm(
          event as unknown as { preventDefault?: () => void },
        );
      } catch {
        // submit-flow 已落 error-box 行内错误,这里只保对话框不关。
      }
      submittingRef.current = false;
      let succeeded = false;
      try {
        succeeded = Boolean(services.statusArea?.isVisible?.());
      } catch {
        succeeded = false;
      }
      if (!succeeded) return; // 失败/被拦:留屏,行内错误已展示,允许重提。
      try {
        document.dispatchEvent(
          new globalThis.CustomEvent(APP_EVENTS.openTranslationWorkflow, {
            detail: { mode: TRANSLATION_WORKFLOW_MODES.STATUS },
          }),
        );
      } catch {
        // 保持已有关闭结果,不抛。
      }
    })();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          id={TRANSLATION_WORKFLOW_DIALOG.ids.dialog}
          className={contentClasses}
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
          >
            <DialogHeader className={`translation-workflow-head${statusMode ? "" : " is-upload-head"}`}>
              {statusMode ? (
                <div className="translation-workflow-head-copy">
                  <DialogTitle asChild>
                    <h2 id={TRANSLATION_WORKFLOW_DIALOG.ids.title}>
                      {TRANSLATION_WORKFLOW_DIALOG.copy.statusTitle}
                    </h2>
                  </DialogTitle>
                </div>
              ) : (
                <DialogTitle asChild>
                  <h2 id={TRANSLATION_WORKFLOW_DIALOG.ids.title} className="sr-only">
                    {TRANSLATION_WORKFLOW_DIALOG.copy.uploadTitle}
                  </h2>
                </DialogTitle>
              )}
              <DialogCloseButton
                id={TRANSLATION_WORKFLOW_DIALOG.ids.closeButton}
              />
            </DialogHeader>
            <WorkflowPanel hiddenInputsSlot={hiddenInputsSlot} />
            <section
              id="status-section"
              className={`translation-status-panel${statusArea.visible ? "" : " hidden"}`}
              aria-label="任务进度"
            >
              {statusCardSlot}
            </section>
          </DialogShell>
        </DialogContent>
    </Dialog>
  );
}
