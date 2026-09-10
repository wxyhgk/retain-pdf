import {
  APP_EVENTS,
} from "@/platform/contracts/app-contract.js";
import type { TranslationWorkflowDialogStatePort } from "./dialog/state.js";
import {
  TRANSLATION_WORKFLOW_DIALOG,
  TRANSLATION_WORKFLOW_MODES,
} from "../domain.js";

// 翻译工作流对话框 runtime(React 世界版控制器)。
//
// 复用纯逻辑:state.js 的 dialogStatePort(store 驱动开合/模式,并同步 home
// viewMode)、contract.js 的模式常量、status-area-port 契约。旧 controller.js
// 的 DOM 绑定(dialogElement/closeButton addEventListener)由 React 组件的
// onClick 取代,这里只保留 document 级事件桥。
//
// 事件契约(蓝图风险 5,不可破坏):
// - 用户侧开合入口(添加按钮 / 关闭按钮 / 背板 / Escape)一律先 dispatch
//   APP_EVENTS.openTranslationWorkflow / closeTranslationWorkflow,再由本
//   runtime 的 document 监听统一落状态——3b recent-jobs 的库刷新挂起/恢复
//   (bindings.js)与 app-actions 提交流程都依赖这两个事件在 document 上可见。
// 三回调职责(签名/事件名不变,只做状态落地,不发新事件):
// - open:由 APP_EVENTS.openTranslationWorkflow 触发,成功→ 落 store.open+
//   同步 DOM data-open,失败(无 port)则空转,事件已消费不再重抛。
// - close:由 APP_EVENTS.closeTranslationWorkflow / Escape 触发,成功→ 落
//   store.close + 同步 DOM data-open=closed 并解除书库刷新挂起;失败→ 保持原
//   开合态,后台轮询不受影响。
// - sync:由 APP_EVENTS.statusAreaVisibilityChanged 触发,成功→ 按
//   statusArea 可见性重算 mode;失败(无 port)→ 保持原 mode,不开关对话框。

export interface TranslationWorkflowStatusAreaPort {
  isVisible?: () => boolean;
  hide?: () => void;
  returnHome?: () => void;
}

export interface TranslationWorkflowUploadSessionPort {
  resetUploadSession?: () => void;
}

export interface CreateTranslationWorkflowDialogRuntimeOptions {
  dialogStatePort?: TranslationWorkflowDialogStatePort;
  statusAreaPort?: TranslationWorkflowStatusAreaPort;
  uploadSessionPort?: TranslationWorkflowUploadSessionPort | null;
  documentRef?: Document;
}

export interface OpenTranslationWorkflowEventDetail {
  mode?: string;
}

export type OpenTranslationWorkflowEventLike = Event | {
  detail?: OpenTranslationWorkflowEventDetail;
};

export function createTranslationWorkflowDialogRuntime({
  dialogStatePort,
  statusAreaPort,
  uploadSessionPort = null,
  documentRef = globalThis.document,
}: CreateTranslationWorkflowDialogRuntimeOptions = {}) {
  // 3b 修复(实测发现,非预先设计):recent-jobs 的 refresh-environment.js
  // 默认 isWorkflowOpen 读的是 #translation-workflow-dialog 的 data-open
  // 属性(DOM),不是任何 store——而 React 的 DOM 提交相对 store 写入是异步的。
  // close() 触发的"store 写入 → bindings.js 的 closeTranslationWorkflow 监听器
  // 读 DOM 判断 isSuspended()"全部发生在同一个同步事件派发调用栈内,此时 React
  // 还没来得及重渲提交新的 data-open,DOM 读到的仍是打开前的旧值——实测复现为
  // "关闭工作流对话框后库刷新永久卡死"(蓝图风险 5 的具体翻车形态)。
  // mountRecentJobsFeature 未开放 environment 注入口(见 composition.js 里的
  // 说明),没法从上游注入读 store 的 isWorkflowOpen,只能反过来:在 store 写入
  // 的同一拍,把这个属性也同步写一份到 DOM,消除给 DOM 读方的竞态窗口。
  // React 之后仍会按自己的节奏把同一个值再渲一遍(幂等,无副作用)。
  function syncOpenAttributeToDom(open: boolean) {
    const dialogEl = documentRef?.getElementById?.(TRANSLATION_WORKFLOW_DIALOG.ids.dialog);
    if (dialogEl?.dataset) {
      dialogEl.dataset.open = open
        ? TRANSLATION_WORKFLOW_DIALOG.datasetValues.open
        : TRANSLATION_WORKFLOW_DIALOG.datasetValues.closed;
    }
  }
  function resolveMode(mode?: string) {
    if (mode === TRANSLATION_WORKFLOW_MODES.STATUS || mode === TRANSLATION_WORKFLOW_MODES.UPLOAD) {
      return mode;
    }
    return statusAreaPort?.isVisible?.()
      ? TRANSLATION_WORKFLOW_MODES.STATUS
      : TRANSLATION_WORKFLOW_MODES.UPLOAD;
  }

  function isOpen() {
    return Boolean(dialogStatePort.getSnapshot().open);
  }

  // ---- 状态落地(document 监听调用;镜像旧 controller 的 openUpload/openFromEvent/close/sync) ----
  // open 职责:上传入口,成功→ 切 UPLOAD 态 + 复位上传会话 + 点亮 DOM data-open;
  // 失败→ 停留原态,不抛错(调用方 requestOpenUpload 只发事件,不直接改状态)。

  function openUpload() {
    statusAreaPort?.hide?.();
    uploadSessionPort?.resetUploadSession?.();
    dialogStatePort.open(TRANSLATION_WORKFLOW_MODES.UPLOAD);
    syncOpenAttributeToDom(true);
  }

  function openFromEvent(event: OpenTranslationWorkflowEventLike = {} as OpenTranslationWorkflowEventLike) {
    // open 分发:无 mode/UPLOAD→ openUpload;STATUS→ resolveMode 落对应态。
    // 成功→ data-open 同步;失败→ 保持原态。
    const detail = (event as { detail?: OpenTranslationWorkflowEventDetail })?.detail;
    const mode = detail?.mode;
    if (!mode || mode === TRANSLATION_WORKFLOW_MODES.UPLOAD) {
      openUpload();
      return;
    }
    dialogStatePort.open(resolveMode(mode));
    syncOpenAttributeToDom(true);
  }

  function close() {
    // close 职责:成功→ store.close + DOM data-open=closed(同拍写,消 React 异步
    // 提交竞态,让 bindings.js 读 DOM 解除书库刷新挂起);失败→ 原态保持,轮询照旧。
    dialogStatePort.close();
    syncOpenAttributeToDom(false);
  }

  function sync() {
    // sync 职责:成功→ 按 statusArea 可见性 setMode(STATUS/UPLOAD),不开关对话框;
    // 失败→ 保持原 mode。
    dialogStatePort.setMode(resolveMode());
  }

  // ---- 用户侧入口(React 组件调用;只发事件,不直接改状态) ----

  function dispatch(eventName: string, detail?: unknown) {
    if (documentRef?.dispatchEvent && typeof globalThis.CustomEvent === "function") {
      documentRef.dispatchEvent(new globalThis.CustomEvent(eventName, { detail }));
    }
  }

  function requestOpenUpload() {
    dispatch(APP_EVENTS.openTranslationWorkflow, { mode: TRANSLATION_WORKFLOW_MODES.UPLOAD });
  }

  // 关闭 = 直接关对话框,一次点击到位(不管当前是上传态还是任务进度态)。
  //
  // 旧的"两段式关闭"(状态可见时先 returnHome、对话框不关,再点一次才真关)被
  // 用户判定为不符合预期:点任务进度的 × 会先弹回"翻译 PDF"空上传表单、还顺带
  // 悄悄 stopPolling 把任务重置掉,像是"点关闭反而退回上一步"。现在统一成"× =
  // 关闭"。想中止运行中的任务有 StatusCard 上专门的"取消任务"按钮
  // (cancelCurrentJob),不靠关闭对话框来兼职做这件事。
  //
  // 关闭不影响后台任务:job-runtime 轮询独立于对话框挂载生命周期,任务到终态
  // 时 controller.js 会自己 pollingPort.stop()(见该文件 §renderJob),不会因为
  // 关了对话框就漏掉一个常驻轮询;图书馆网格的卡片仍会显示该任务的实时进度。
  function requestClose() {
    dispatch(APP_EVENTS.closeTranslationWorkflow);
  }

  function bindEvents() {
    if (!documentRef?.addEventListener) {
      return () => {};
    }
    const bindings: Array<[string, EventListener]> = [
      [APP_EVENTS.openTranslationWorkflow, openFromEvent as unknown as EventListener],
      [APP_EVENTS.closeTranslationWorkflow, close as EventListener],
      [APP_EVENTS.statusAreaVisibilityChanged, sync as EventListener],
    ];
    const onKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen()) {
        requestClose();
      }
    };
    bindings.forEach(([name, handler]) => documentRef.addEventListener(name, handler));
    documentRef.addEventListener("keydown", onKeydown);
    return () => {
      bindings.forEach(([name, handler]) => documentRef.removeEventListener(name, handler));
      documentRef.removeEventListener("keydown", onKeydown);
    };
  }

  return {
    bindEvents,
    close,
    isOpen,
    openFromEvent,
    openUpload,
    requestClose,
    requestOpenUpload,
    statePort: dialogStatePort,
    sync,
  };
}
