import {
  createStore,
} from "@/platform/store/store.js";
import {
  APP_EVENTS,
} from "@/platform/contracts/app-contract.js";
import {
  buildWorkflowSectionsViewModel,
} from "@retainpdf/domain/job";
import {
  createTranslationWorkflowStatusAreaPort,
} from "@/features/ingest/domain.js";
import type {
  Store,
} from "@/platform/store/store.js";

// 状态区(#status-section)可见性 feature。
//
// 3a 只落"可见性 + 事件契约"(镜像 ui/status-area-view.js 的 setStatusAreaVisible
// 与 ui/presentation-view.js 的 setWorkflowSectionsView):StatusCard 本体是 3b
// (recent-jobs + job-runtime 蓝图 features/status/)的范围,这里的 store 届时
// 直接被 StatusCard.jsx 家族复用。
//
// 事件契约:每次 setVisible 都 dispatch statusAreaVisibilityChanged(旧世界
// 同款,translation-workflow-dialog 靠它同步 upload/status 模式)。

export type StatusAreaState = {
  visible: boolean;
};

export type StatusAreaActions = {
  setVisible: (state: StatusAreaState, visible?: boolean) => StatusAreaState;
};

export type StatusAreaStore = Store<StatusAreaState, StatusAreaActions>;

export type StatusAreaPort = {
  hide: () => void;
  isVisible: () => boolean;
  returnHome: () => void;
};

export type WorkflowSectionsViewModel = {
  hasJob: boolean;
  processing: boolean;
};

export type StatusAreaFeature = {
  isVisible: () => boolean;
  setVisible: (visible: boolean) => void;
  setWorkflowSections: (job?: unknown) => WorkflowSectionsViewModel;
  statusAreaPort: StatusAreaPort;
  store: StatusAreaStore;
};

export function createStatusAreaFeature({
  documentRef = globalThis.document,
}: {
  documentRef?: Document | null;
} = {}): StatusAreaFeature {
  const store = createStore<StatusAreaState, StatusAreaActions>({
    name: "homeStatusArea",
    initialState: { visible: false },
    actions: {
      setVisible(currentState, visible = false) {
        return { ...currentState, visible: Boolean(visible) };
      },
    },
  });

  function dispatchVisibilityChanged() {
    if (documentRef?.dispatchEvent && typeof globalThis.CustomEvent === "function") {
      documentRef.dispatchEvent(new globalThis.CustomEvent(APP_EVENTS.statusAreaVisibilityChanged));
    }
  }

  function setVisible(visible: boolean) {
    store.actions.setVisible(visible);
    dispatchVisibilityChanged();
  }

  function isVisible() {
    return Boolean(store.getSnapshot().visible);
  }

  // 旧世界从状态卡元素冒泡 returnHome;新世界直接发到 document
  // (消费方 jobRuntimeFeature.returnToHome 是 document 级监听,3b 接线)
  function returnHome() {
    if (documentRef?.dispatchEvent && typeof globalThis.CustomEvent === "function") {
      documentRef.dispatchEvent(new globalThis.CustomEvent(APP_EVENTS.returnHome));
    }
  }

  // setWorkflowSections(job):idle 复位链与 3b runtime-reset 共用的回调
  function setWorkflowSections(job: unknown = null): WorkflowSectionsViewModel {
    const viewModel = buildWorkflowSectionsViewModel(job) as WorkflowSectionsViewModel;
    setVisible(viewModel.hasJob);
    return viewModel;
  }

  const statusAreaPort = createTranslationWorkflowStatusAreaPort({
    isVisible,
    hide: () => setVisible(false),
    returnHome,
  }) as StatusAreaPort;

  return {
    isVisible,
    setVisible,
    setWorkflowSections,
    statusAreaPort,
    store,
  };
}
