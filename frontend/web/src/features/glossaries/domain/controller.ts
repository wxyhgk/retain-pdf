import {
  completeDownloadToast,
  failDownloadToast,
  showDownloadPreparing,
  updateDownloadProgress,
} from "@/platform/utils/download-feedback.js";
import {
  fileNameFromDisposition,
  prepareDownloadTarget,
  saveResponseDownload,
} from "@/platform/utils/downloads.js";

export type GlossariesFeature = {
  bindEvents: () => void;
  open: () => unknown;
  reloadGlossaries: () => unknown;
  save: () => unknown;
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
}: any): GlossariesFeature {
  const state = {
    items: [],
    selectedId: "",
    currentDetail: null,
    draftOnly: false,
  };

  function renderList() {
    viewPort.renderList(state.items, state.selectedId);
  }

  function renderDraft(detail: any = {}) {
    state.currentDetail = {
      glossary_id: detail.glossary_id || "",
      name: detail.name || "",
      entries: Array.isArray(detail.entries) ? detail.entries : [],
    };
    viewPort.renderEditor(state.currentDetail);
  }

  async function reloadGlossaries({ keepSelection = true }: any = {}) {
    const payload = await fetchGlossaries(apiPrefix);
    state.items = Array.isArray(payload?.items) ? payload.items : [];
    if (!keepSelection || !state.items.some((item) => item.glossary_id === state.selectedId)) {
      state.selectedId = state.items[0]?.glossary_id || "";
    }
    renderList();
    if (state.selectedId) {
      await selectGlossary(state.selectedId);
    } else {
      state.draftOnly = true;
      renderDraft({ name: "", entries: [] });
    }
    return state.items;
  }

  async function selectGlossary(glossaryId) {
    const normalizedGlossaryId = `${glossaryId || ""}`.trim();
    if (!normalizedGlossaryId) {
      return;
    }
    state.selectedId = normalizedGlossaryId;
    state.draftOnly = false;
    renderList();
    viewPort.setStatus("正在读取术语表...");
    try {
      const detail = await fetchGlossary(normalizedGlossaryId, apiPrefix);
      renderDraft(detail);
      viewPort.setStatus("");
    } catch (err) {
      viewPort.setStatus(err.message || String(err), "error");
    }
  }

  async function open() {
    viewPort.openDialog();
    viewPort.setStatus("正在读取术语表...");
    try {
      await reloadGlossaries();
      viewPort.setStatus("");
    } catch (err) {
      viewPort.setStatus(err.message || String(err), "error");
    }
  }

  function close() {
    viewPort.closeDialog();
  }

  function createNew() {
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
    const payload = viewPort.readEditorPayload();
    if (!payload.name.trim()) {
      viewPort.setStatus("请填写术语表名称。", "error");
      return;
    }
    if (payload.skippedMissingTarget?.length > 0) {
      viewPort.setStatus("固定译法/偏好译法需要填写译文。", "error");
      return;
    }
    delete payload.skippedMissingTarget;
    viewPort.setStatus("正在保存...");
    try {
      const saved = state.selectedId && !state.draftOnly
        ? await updateGlossary(apiPrefix, state.selectedId, payload)
        : await createGlossary(apiPrefix, payload);
      state.selectedId = saved.glossary_id || state.selectedId;
      state.draftOnly = false;
      await reloadGlossaries();
      await refreshWorkflowGlossaries?.({ force: true, selectedId: state.selectedId });
      viewPort.setStatus("已保存。", "valid");
    } catch (err) {
      viewPort.setStatus(err.message || String(err), "error");
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
      viewPort.setStatus(err.message || String(err), "error");
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
    const downloadTarget = await prepareDownloadTarget(fallbackName);
    if (downloadTarget.kind === "aborted") {
      return;
    }
    viewPort.setStatus("正在导出 CSV...");
    try {
      showDownloadPreparing(fallbackName);
      const resp = await exportGlossaryCsv(apiPrefix, state.selectedId);
      const disposition = resp.headers.get("content-disposition") || "";
      const filename = fileNameFromDisposition(disposition, fallbackName);
      await saveResponseDownload(resp, {
        target: downloadTarget,
        filename,
        onProgress: ({ receivedBytes, totalBytes, percent, done }) => {
          if (done) {
            completeDownloadToast(filename);
            return;
          }
          updateDownloadProgress({ filename, receivedBytes, totalBytes, percent });
        },
      });
      viewPort.setStatus(`已导出 ${filename}。`, "valid");
    } catch (err) {
      const message = err.message || String(err);
      viewPort.setStatus(message, "error");
      failDownloadToast(message);
    }
  }

  async function applyImport() {
    const csvText = viewPort.readCsvText();
    if (!csvText.trim()) {
      viewPort.setStatus("请先粘贴 CSV 内容。", "error");
      return;
    }
    viewPort.setStatus("正在解析 CSV...");
    try {
      const payload = await parseGlossaryCsv(apiPrefix, csvText);
      renderDraft({
        ...viewPort.readEditorPayload(),
        entries: Array.isArray(payload?.entries) ? payload.entries : [],
      });
      viewPort.clearCsvText();
      viewPort.setImportVisible(false);
      viewPort.setStatus(`已解析 ${Number(payload?.entry_count) || 0} 条。`, "valid");
    } catch (err) {
      viewPort.setStatus(err.message || String(err), "error");
    }
  }

  function bindEvents() {
    viewPort.bindEvents({
      open,
      close,
      reload: () => reloadGlossaries().catch((err) => viewPort.setStatus(err.message || String(err), "error")),
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
