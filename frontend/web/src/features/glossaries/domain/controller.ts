import {
  completeDownloadToast,
  failDownloadToast,
  showDownloadPreparing,
  updateDownloadProgress,
} from "@/platform/utils/download-feedback.js";
import {
  downloadProtectedResponse,
  prepareDownloadTarget,
} from "@/platform/utils/downloads.js";

import type {
  GlossaryEditorPayload,
  GlossaryEntryRow,
  GlossaryListItem,
  GlossariesViewPort,
} from "./glossaries-store.js";
import { MAX_GLOSSARY_ENTRIES, mergeGlossaryEntries } from "./glossary-import.js";

/** 下载进度回调的载荷（与 platform 下载工具 emitProgress 的形状一致）。 */
type GlossaryDownloadProgress = {
  filename: string;
  receivedBytes: number;
  totalBytes: number;
  percent: number;
  done?: boolean;
};

/** 术语表详情：fetchGlossary 的返回值，也是 renderDraft 的入参。 */
type GlossaryDetail = {
  glossary_id?: string;
  name?: string;
  entries?: Array<Partial<GlossaryEntryRow>>;
};

/** 取错误文案：优先 message 字段，否则退回 String(err)。 */
function errorText(err: unknown): string {
  const message = typeof err === "object" && err !== null && "message" in err && typeof err.message === "string"
    ? err.message
    : "";
  return message || String(err);
}

export type GlossariesFeature = {
  bindEvents: () => void;
  open: () => unknown;
  reloadGlossaries: () => unknown;
  save: () => unknown;
};

/**
 * 术语表接口（签名与 platform/api 的实现一致，测试替身按同一签名写）。
 * 返回值在各调用点按已知形状读取（见 GlossaryDetail / GlossaryListItem 等）。
 */
export type GlossariesFeatureDeps = {
  apiPrefix: string;
  fetchGlossaries: (apiPrefix: string) => Promise<unknown>;
  fetchGlossary: (glossaryId: string, apiPrefix?: string) => Promise<unknown>;
  createGlossary: (apiPrefix: string, payload: unknown) => Promise<unknown>;
  updateGlossary: (apiPrefix: string, glossaryId: string, payload: unknown) => Promise<unknown>;
  deleteGlossary: (apiPrefix: string, glossaryId: string) => Promise<unknown>;
  exportGlossaryCsv: (apiPrefix: string, glossaryId: string) => Promise<unknown>;
  parseGlossaryCsv: (apiPrefix: string, csvText: string) => Promise<unknown>;
  /** 术语表增删改后让「添加 PDF」里的术语表下拉跟着刷新（ingest 的 loadGlossaryOptions）。 */
  refreshWorkflowGlossaries?: (options: { force?: boolean; selectedId?: string }) => unknown;
  view?: unknown;
  viewPort: GlossariesViewPort;
};

export function mountGlossariesFeature({
  apiPrefix,
  fetchGlossaries,
  fetchGlossary,
  createGlossary,
  updateGlossary,
  deleteGlossary,
  exportGlossaryCsv,
  parseGlossaryCsv,
  refreshWorkflowGlossaries,
  view = {},
  viewPort,
}: GlossariesFeatureDeps): GlossariesFeature {
  const state: {
    items: GlossaryListItem[];
    selectedId: string;
    currentDetail: GlossaryDetail | null;
    draftOnly: boolean;
  } = {
    items: [],
    selectedId: "",
    currentDetail: null,
    draftOnly: false,
  };
  // 并发选择守卫：只保留最后一次 selectGlossary 的回包，过期响应直接丢弃。
  let selectRequestSeq = 0;
  let importBusy = false;

  function renderList() {
    viewPort.renderList(state.items, state.selectedId);
  }

  function renderDraft(detail: GlossaryDetail = {}, markSaved = true) {
    state.currentDetail = {
      glossary_id: detail.glossary_id || "",
      name: detail.name || "",
      entries: Array.isArray(detail.entries) ? detail.entries : [],
    };
    viewPort.renderEditor(state.currentDetail, { markSaved });
  }

  async function reloadGlossaries({ keepSelection = true }: { keepSelection?: boolean } = {}) {
    const requestSeq = ++selectRequestSeq;
    viewPort.setLoading?.(true);
    try {
      const payload = (await fetchGlossaries(apiPrefix)) as { items?: GlossaryListItem[] } | undefined;
      if (requestSeq !== selectRequestSeq) return state.items;
      state.items = Array.isArray(payload?.items) ? payload.items : [];
      const nextId = keepSelection && state.items.some((item) => item.glossary_id === state.selectedId)
        ? state.selectedId : state.items[0]?.glossary_id || "";
      renderList();
      if (nextId) {
        await selectGlossary(nextId);
      } else {
        state.selectedId = "";
        state.draftOnly = true;
        renderList();
        renderDraft({ name: "", entries: [] });
        viewPort.setStatus("");
      }
      return state.items;
    } finally {
      if (requestSeq === selectRequestSeq) viewPort.setLoading?.(false);
    }
  }

  // 形参取 unknown：bindEvents 的 HandlersBag 以 (...args: unknown[]) 的形态传入。
  async function selectGlossary(glossaryId: unknown) {
    const normalizedGlossaryId = `${glossaryId || ""}`.trim();
    if (!normalizedGlossaryId) {
      return;
    }
    const requestSeq = ++selectRequestSeq;
    viewPort.setLoading?.(true);
    viewPort.setStatus("正在读取术语表...");
    try {
      const detail = (await fetchGlossary(normalizedGlossaryId, apiPrefix)) as GlossaryDetail;
      if (requestSeq !== selectRequestSeq) {
        return;
      }
      state.selectedId = normalizedGlossaryId;
      state.draftOnly = false;
      renderList();
      renderDraft(detail);
      viewPort.clearCsvText();
      viewPort.setImportVisible(false);
      viewPort.setStatus("");
    } catch (err) {
      if (requestSeq !== selectRequestSeq) {
        return;
      }
      viewPort.setStatus(errorText(err), "error");
    } finally {
      if (requestSeq === selectRequestSeq) viewPort.setLoading?.(false);
    }
  }

  async function open() {
    viewPort.openDialog();
    viewPort.setStatus("正在读取术语表...");
    try {
      await reloadGlossaries();
    } catch (err) {
      viewPort.setStatus(errorText(err), "error");
    }
  }

  function close() {
    ++selectRequestSeq;
    viewPort.setLoading?.(false);
    viewPort.clearCsvText();
    viewPort.setImportVisible(false);
    viewPort.closeDialog();
  }

  function createNew() {
    ++selectRequestSeq;
    viewPort.setLoading?.(false);
    viewPort.clearCsvText();
    viewPort.setImportVisible(false);
    state.selectedId = "";
    state.draftOnly = true;
    renderList();
    renderDraft({
      name: "未命名术语表",
      entries: [],
    });
    viewPort.addEntryRow();
    viewPort.setStatus("新术语表尚未保存。");
  }

  async function save() {
    if (viewPort.readCsvText?.().trim()) {
      viewPort.setImportVisible(true);
      viewPort.setStatus("还有待导入内容，请先解析并导入，或清空导入内容后保存。", "error");
      return;
    }
    const payload = viewPort.readEditorPayload();
    const { skippedMissingTarget, ...savePayload } = payload;
    if (!savePayload.name.trim()) {
      viewPort.setStatus("请填写术语表名称。", "error");
      return;
    }
    if (skippedMissingTarget?.length > 0) {
      viewPort.setStatus("需要填写译文的术语还有空缺。", "error");
      return;
    }
    if (savePayload.entries.length > MAX_GLOSSARY_ENTRIES) {
      viewPort.setStatus(`最多保存 ${MAX_GLOSSARY_ENTRIES} 条词条，请拆分为多份术语表。`, "error");
      return;
    }
    viewPort.setStatus("正在保存...");
    try {
      const saved = (state.selectedId && !state.draftOnly
        ? await updateGlossary(apiPrefix, state.selectedId, savePayload)
        : await createGlossary(apiPrefix, savePayload)) as { glossary_id?: string };
      state.selectedId = saved.glossary_id || state.selectedId;
      state.draftOnly = false;
      await reloadGlossaries();
      await refreshWorkflowGlossaries?.({ force: true, selectedId: state.selectedId });
      viewPort.setStatus("已保存。", "valid");
    } catch (err) {
      viewPort.setStatus(errorText(err), "error");
    }
  }

  async function deleteCurrent() {
    if (!state.selectedId || state.draftOnly) {
      renderDraft({ name: "", entries: [] });
      state.draftOnly = false;
      viewPort.setStatus("");
      return;
    }
    viewPort.setStatus("正在删除...");
    try {
      await deleteGlossary(apiPrefix, state.selectedId);
      state.selectedId = "";
      await reloadGlossaries({ keepSelection: false });
      await refreshWorkflowGlossaries?.({ force: true, selectedId: "" });
      viewPort.setStatus("已删除。", "valid");
    } catch (err) {
      viewPort.setStatus(errorText(err), "error");
    }
  }

  async function exportCurrent() {
    if (!state.selectedId || state.draftOnly) {
      viewPort.setStatus("请先保存术语表再导出。", "error");
      return;
    }
    if (typeof exportGlossaryCsv !== "function") {
      viewPort.setStatus("当前环境未接入术语表导出。", "error");
      return;
    }
    const fallbackName = `${state.currentDetail?.name || state.selectedId || "glossary"}.csv`;
    // 惰性:响应确认成功之后才问保存位置（见 downloads.ts）。
    const downloadTarget = (filename?: string) => prepareDownloadTarget(filename || fallbackName);
    viewPort.setStatus("正在导出 CSV...");
    try {
      showDownloadPreparing(fallbackName);
      const filename = await downloadProtectedResponse({
        fetchResponse: () => exportGlossaryCsv(apiPrefix, state.selectedId) as Promise<Response>,
        fallbackName,
        target: downloadTarget,
        onProgress: ({ filename: progressFilename, receivedBytes, totalBytes, percent, done }: GlossaryDownloadProgress) => {
          if (done) {
            completeDownloadToast(progressFilename);
            return;
          }
          updateDownloadProgress({ filename: progressFilename, receivedBytes, totalBytes, percent });
        },
      });
      viewPort.setStatus(`已导出 ${filename}。`, "valid");
    } catch (err) {
      const message = errorText(err);
      viewPort.setStatus(message, "error");
      failDownloadToast(message);
    }
  }

  async function applyImport(mode: unknown = "append", preparedCsv?: unknown) {
    if (importBusy) return;
    const csvText = viewPort.readCsvText();
    if (!csvText.trim()) {
      viewPort.setStatus("请先选择文件或粘贴 CSV / TSV 内容。", "error");
      return;
    }
    const requestSeq = selectRequestSeq;
    const draft = viewPort.readDraft?.() ?? viewPort.readEditorPayload();
    const originalDraft = JSON.stringify(draft);
    importBusy = true;
    viewPort.setStatus("正在解析术语...");
    try {
      const payload = (await parseGlossaryCsv(apiPrefix, typeof preparedCsv === "string" ? preparedCsv : csvText)) as { entries?: Array<Partial<GlossaryEntryRow>>; entry_count?: number; duplicate_count?: number } | undefined;
      if (requestSeq !== selectRequestSeq) return;
      if (originalDraft !== JSON.stringify(viewPort.readDraft?.() ?? viewPort.readEditorPayload()) || csvText !== viewPort.readCsvText()) {
        viewPort.setStatus("解析期间内容已修改，请重新导入；当前草稿未修改。", "error");
        return;
      }
      if (!payload?.entries?.length) throw new Error("没有解析到有效词条，请检查文件内容；当前草稿未修改。");
      const merged = mergeGlossaryEntries(draft.entries, payload.entries, mode === "replace" ? "replace" : "append");
      renderDraft({
        ...draft,
        entries: merged.entries,
      }, false);
      viewPort.clearCsvText();
      viewPort.setImportVisible(false);
      const duplicates = (Number(payload.duplicate_count) || 0) + merged.duplicateCount;
      viewPort.setStatus(`已解析 ${payload.entries.length} 条，合并 ${duplicates} 条重复词条，当前共 ${merged.entries.length} 条。请检查后保存。`, "valid");
    } catch (err) {
      if (requestSeq === selectRequestSeq) viewPort.setStatus(errorText(err), "error");
    } finally {
      importBusy = false;
    }
  }

  function bindEvents() {
    viewPort.bindEvents({
      open,
      close,
      reload: () => reloadGlossaries().catch((err) => viewPort.setStatus(errorText(err), "error")),
      selectGlossary,
      createNew,
      addRow: () => viewPort.addEntryRow(),
      save,
      deleteCurrent,
      exportCurrent,
      showImport: () => viewPort.setImportVisible(true),
      hideImport: () => viewPort.setImportVisible(false),
      applyImport,
    });
  }

  return {
    bindEvents,
    open,
    reloadGlossaries,
    save,
  };
}
