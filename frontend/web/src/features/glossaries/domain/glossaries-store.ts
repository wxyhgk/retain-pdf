// GlossariesDialog 的纯视图态 + 与 features/glossaries/controller.js(kept
// 控制器)对接的 store 驱动 viewPort(蓝图 §3,镜像
// credentials-view-store.js 的写法)。
//
// 旧世界 glossary-view-port.js/view.js 全部是 DOM 直写(死,不 import);这里
// 用同名方法签名重新实现,"写"的目的地从 DOM 换成 store / editorRef,让
// GlossariesDialog.jsx 系的组件订阅渲染。controller.js(reload/select/save/
// delete/export/applyImport 等编排逻辑)一行不改地复用。
//
// 编辑器态(draft/csvText)不在 store 里:高频受控输入只应触碰 editorRef +
// editor 订阅,不进全局 store 快照(蓝图风险 1 的姊妹问题——双写源打架)。
// store 只留列表/选中/状态/导入面板开合;组件经 useGlossariesController 订阅
// editor,行为与旧 store 版一致。

import { createStore } from "@/platform/store/store.js";
import type { Store } from "@/platform/store/store.js";

/** 事件处理函数表（viewPort.bindEvents 写入 handlersRef） */
export type HandlersBag = {
  [key: string]: ((...args: unknown[]) => unknown) | undefined | null;
};

/**
 * 对话框开合端口的最小结构（装配层用通用的 createDialogStore 实例满足它，
 * 见 src/pages/home/state/dialog-store.js）。
 * 本功能只用 open()/close()，不依赖装配层的具体类型。
 */
export type GlossariesDialogStorePort = {
  open: (payload?: unknown) => unknown;
  close: () => unknown;
};

/** 列表项（API 列表摘要） */
export type GlossaryListItem = {
  glossary_id?: string;
  name?: string;
  entry_count?: number;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
};

/** 编辑器行（受控表格） */
export type GlossaryEntryRow = {
  source: string;
  target: string;
  note: string;
  level: string;
  match_mode: string;
};

export type GlossaryDraft = {
  name: string;
  entries: GlossaryEntryRow[];
};

/** save() 读取的编辑器 payload（含 preserve 语义） */
export type GlossaryEditorPayload = {
  name: string;
  entries: Array<{
    source: string;
    target: string;
    level: string;
    match_mode: string;
    context: string;
    note: string;
  }>;
  skippedMissingTarget: string[];
};

export type GlossariesViewState = {
  items: GlossaryListItem[];
  selectedId: string;
  status: { message: string; tone: string };
  importVisible: boolean;
};

export type GlossariesViewActions = {
  setList(
    state: GlossariesViewState,
    payload?: { items?: GlossaryListItem[]; selectedId?: string },
  ): GlossariesViewState;
  setStatus(
    state: GlossariesViewState,
    payload?: { message?: string; tone?: string },
  ): GlossariesViewState;
  setImportVisible(state: GlossariesViewState, visible?: boolean): GlossariesViewState;
};

/** 编辑器态(store 之外,由 editorRef 持有 + editor 订阅分发) */
export type GlossariesEditorState = {
  draft: GlossaryDraft;
  csvText: string;
};

export type GlossariesEditorActions = {
  setDraft(payload?: { name?: string; entries?: Array<Partial<GlossaryEntryRow> | GlossaryEntryRow> }): void;
  setName(name?: string): void;
  addEntryRow(entry?: Partial<GlossaryEntryRow>): void;
  updateEntryField(payload?: { index?: number; field?: keyof GlossaryEntryRow; value?: string }): void;
  removeEntryRow(index: number): void;
  setCsvText(csvText?: string): void;
  clearCsvText(): void;
};

export type GlossariesEditorPort = {
  getSnapshot(): GlossariesEditorState;
  subscribe(listener: (snapshot: GlossariesEditorState) => void): () => void;
  actions: GlossariesEditorActions;
};

export type GlossariesViewStore = Store<GlossariesViewState, GlossariesViewActions>;

export type GlossariesViewPort = {
  openDialog: () => unknown;
  closeDialog: () => unknown;
  setStatus: (message?: string, tone?: string) => unknown;
  renderList: (items?: GlossaryListItem[], selectedId?: string) => unknown;
  renderEditor: (detail?: { name?: string; entries?: Array<Partial<GlossaryEntryRow>> }) => unknown;
  addEntryRow: (entry?: Partial<GlossaryEntryRow>) => unknown;
  readEditorPayload: () => GlossaryEditorPayload;
  setImportVisible: (visible?: boolean) => unknown;
  readCsvText: () => string;
  clearCsvText: () => unknown;
  bindEvents: (handlers: HandlersBag) => unknown;
};

export type GlossariesViewFeature = {
  store: GlossariesViewStore;
  editor: GlossariesEditorPort;
  viewPort: GlossariesViewPort;
  handlersRef: { current: HandlersBag | null };
};

function normalizeEntryForRow(entry: Partial<GlossaryEntryRow> = {}): GlossaryEntryRow {
  return {
    source: entry.source || "",
    target: entry.target || "",
    note: entry.note || "",
    level: entry.level || "preserve",
    match_mode: entry.match_mode || "case_insensitive",
  };
}

// 抄自 src/js/features/glossaries/view.js:155-184
// (readGlossaryEditorPayload)——尤其第 165 行的 preserve 语义必须原样保留:
// level==="preserve" 且用户没有手填译文时,target 用 source 回填(“保留原词”
// 语义,不是“译文缺失”);level 不是 preserve 时留空则视为“漏填译文”,计入
// skippedMissingTarget,由 controller.js 的 save() 拦截并提示错误。
// 纯函数:读调用方持有的 draft(编辑器 useState/ref),不读 store。
export function readEditorPayload(draft: GlossaryDraft = { name: "", entries: [] }): GlossaryEditorPayload {
  const entries: GlossaryEditorPayload["entries"] = [];
  const skippedMissingTarget: string[] = [];
  for (const row of draft.entries) {
    const source = `${row.source || ""}`.trim();
    if (!source) {
      continue;
    }
    const level = row.level || "preserve";
    const typedTarget = `${row.target || ""}`.trim();
    const target = typedTarget || (level === "preserve" ? source : "");
    if (!target) {
      skippedMissingTarget.push(source);
      continue;
    }
    entries.push({
      source,
      target,
      level,
      match_mode: row.match_mode || "case_insensitive",
      context: "",
      note: `${row.note || ""}`.trim(),
    });
  }
  return {
    name: `${draft.name || ""}`.trim() || "未命名术语表",
    entries,
    skippedMissingTarget,
  };
}

/** 旧名别名(同签名纯函数,供未迁移的调用方过渡)。 */
export const readEditorPayloadFromDraft = readEditorPayload;

export function createGlossariesViewFeature({
  dialogStore,
}: {
  dialogStore: GlossariesDialogStorePort;
}): GlossariesViewFeature {
  const store = createStore<GlossariesViewState, GlossariesViewActions>({
    name: "glossariesView",
    initialState: {
      items: [],
      selectedId: "",
      status: { message: "", tone: "" },
      importVisible: false,
    },
    actions: {
      setList(currentState, { items = [], selectedId = "" } = {}) {
        return { ...currentState, items, selectedId };
      },
      setStatus(currentState, { message = "", tone = "" } = {}) {
        return { ...currentState, status: { message, tone } };
      },
      setImportVisible(currentState, visible = false) {
        return { ...currentState, importVisible: Boolean(visible) };
      },
    },
  });

  // 编辑器态(draft/csvText):ref 持有 + 订阅分发,不进 store。
  // 快照引用稳定(仅变更时替换),可直接作 useSyncExternalStore 的 getSnapshot。
  let editorSnapshot: GlossariesEditorState = {
    draft: { name: "", entries: [] },
    csvText: "",
  };
  const editorListeners = new Set<(snapshot: GlossariesEditorState) => void>();

  function emitEditor() {
    for (const listener of Array.from(editorListeners)) {
      listener(editorSnapshot);
    }
  }

  const editor: GlossariesEditorPort = {
    getSnapshot: () => editorSnapshot,
    subscribe: (listener: (snapshot: GlossariesEditorState) => void) => {
      editorListeners.add(listener);
      return () => {
        editorListeners.delete(listener);
      };
    },
    actions: {
      setDraft({ name = "", entries = [] } = {}) {
        editorSnapshot = {
          ...editorSnapshot,
          draft: { name, entries: entries.map((entry) => normalizeEntryForRow(entry)) },
        };
        emitEditor();
      },
      setName(name = "") {
        editorSnapshot = {
          ...editorSnapshot,
          draft: { ...editorSnapshot.draft, name },
        };
        emitEditor();
      },
      addEntryRow(entry = {}) {
        editorSnapshot = {
          ...editorSnapshot,
          draft: {
            ...editorSnapshot.draft,
            entries: [...editorSnapshot.draft.entries, normalizeEntryForRow(entry)],
          },
        };
        emitEditor();
      },
      updateEntryField({ index, field, value } = {}) {
        if (field == null || index == null) {
          return;
        }
        const entries = editorSnapshot.draft.entries.map((row, rowIndex) => (
          rowIndex === index ? { ...row, [field]: value } : row
        ));
        editorSnapshot = {
          ...editorSnapshot,
          draft: { ...editorSnapshot.draft, entries },
        };
        emitEditor();
      },
      removeEntryRow(index) {
        const entries = editorSnapshot.draft.entries.filter((_row, rowIndex) => rowIndex !== index);
        editorSnapshot = {
          ...editorSnapshot,
          draft: { ...editorSnapshot.draft, entries },
        };
        emitEditor();
      },
      setCsvText(csvText = "") {
        editorSnapshot = { ...editorSnapshot, csvText: `${csvText || ""}` };
        emitEditor();
      },
      clearCsvText() {
        if (!editorSnapshot.csvText) {
          return;
        }
        editorSnapshot = { ...editorSnapshot, csvText: "" };
        emitEditor();
      },
    },
  };

  // controller.js 在装配时同步调用一次 feature.bindEvents()(见
  // composition.js)捕获 open/close/reload/selectGlossary/createNew/addRow/
  // save/deleteCurrent/exportCurrent/showImport/hideImport/applyImport 等
  // 处理函数——React 世界没有旧 view.js 那种全局 DOM 监听步骤,JSX 按钮的
  // onClick 直接从这里取用(见 useGlossariesController.js)。
  const handlersRef: { current: HandlersBag | null } = { current: null };

  const viewPort = {
    openDialog: () => dialogStore.open(),
    closeDialog: () => dialogStore.close(),
    setStatus: (message = "", tone = "") => store.actions.setStatus({ message, tone }),
    renderList: (items: GlossaryListItem[] = [], selectedId = "") => store.actions.setList({ items, selectedId }),
    renderEditor: (detail: { name?: string; entries?: Array<Partial<GlossaryEntryRow>> } = {}) => editor.actions.setDraft(detail),
    addEntryRow: (entry: Partial<GlossaryEntryRow> = {}) => editor.actions.addEntryRow(entry),
    readEditorPayload: () => readEditorPayload(editor.getSnapshot().draft),
    setImportVisible: (visible = false) => store.actions.setImportVisible(visible),
    readCsvText: () => editor.getSnapshot().csvText,
    clearCsvText: () => editor.actions.clearCsvText(),
    bindEvents: (handlers: HandlersBag) => {
      handlersRef.current = handlers;
    },
  };

  return {
    store,
    editor,
    viewPort,
    handlersRef,
  };
}
