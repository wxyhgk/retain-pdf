import type { TranslationLoadItemsOptions, createStatusDetailTranslationDataPort } from "./translation-data-port.js";

/** dataPort 读写后返回的选中项信息（loadSummaryAndItems / loadItems 的回包形状） */
type TranslationSelection = {
  jobId?: string;
  selectedItemId: string;
  shouldLoadSelectedItem: boolean;
  selectionChanged: boolean;
};

/** 翻译 tab 渲染选项（列表 / 详情共用的 loading / 空态文案） */
export interface TranslationTabRenderOptions {
  loading?: boolean;
  hasItems?: boolean;
  emptyText?: string;
}

export interface TranslationTabCoordinatorDeps {
  dataPort: ReturnType<typeof createStatusDetailTranslationDataPort>;
  renderEmpty: (text: string) => void;
  renderSummary: () => void;
  renderItems: (options?: TranslationTabRenderOptions) => void;
  renderItemDetail: (options?: TranslationTabRenderOptions) => void;
  renderReplay: () => void;
  setReplayLoading?: (state: { hasResult: boolean; status: string }) => void;
}

export function createStatusDetailTranslationTabCoordinator({
  dataPort,
  renderEmpty,
  renderSummary,
  renderItems,
  renderItemDetail,
  renderReplay,
  setReplayLoading,
}: TranslationTabCoordinatorDeps) {
  function renderCurrent() {
    renderSummary();
    renderItems();
    renderItemDetail();
    renderReplay();
  }

  function renderSelectionPlaceholder(selection: TranslationSelection) {
    renderItemDetail({
      emptyText: selection?.selectedItemId ? "请选择左侧 item" : "没有可查看的 item",
    });
    renderReplay();
  }

  async function loadSelectedItem(selection: TranslationSelection) {
    // jobId 在 loadItems 路径由调用方补齐；缺失时不发请求（实际调用点都带 jobId）。
    if (!selection?.shouldLoadSelectedItem || !selection.jobId) {
      return;
    }
    await loadItem(selection.jobId, selection.selectedItemId);
  }

  async function loadItems(jobId: string, { selectFirst = false }: TranslationLoadItemsOptions = {}) {
    renderItems({ loading: true });
    const selection = await dataPort.loadItems(jobId, { selectFirst });
    renderItems();
    if (!selection.selectionChanged) {
      return selection;
    }
    renderSelectionPlaceholder(selection);
    await loadSelectedItem({ ...selection, jobId });
    return selection;
  }

  async function loadItem(jobId: string, itemId: string) {
    if (!itemId) {
      return;
    }
    renderItems();
    renderItemDetail({ loading: true });
    renderReplay();
    await dataPort.loadItem(jobId, itemId);
    renderItemDetail();
  }

  async function ensureLoaded({ force = false }: { force?: boolean } = {}) {
    const jobId = dataPort.jobId();
    if (!jobId) {
      dataPort.reset("");
      renderEmpty("请先选择任务");
      return;
    }
    dataPort.syncJob();
    if (dataPort.state.loaded && !force) {
      renderCurrent();
      return;
    }
    renderEmpty("正在读取翻译调试数据...");
    try {
      const selection = await dataPort.loadSummaryAndItems({ selectFirst: true });
      renderSummary();
      renderItems();
      renderSelectionPlaceholder(selection);
      await loadSelectedItem(selection);
      dataPort.markLoaded();
    } catch (error) {
      renderEmpty((error as { message?: string } | null)?.message || String(error));
    }
  }

  async function applyFilter(query: Parameters<typeof dataPort.applyQuery>[0]) {
    dataPort.applyQuery(query);
    renderSummary();
    try {
      const selection = await dataPort.loadSummaryAndItems({ selectFirst: true });
      renderSummary();
      renderItems();
      renderSelectionPlaceholder(selection);
      await loadSelectedItem(selection);
      // applyQuery 不再提前置 loaded，成功之后才认；失败时保持未加载，
      // 下次进 tab 会重新拉，而不是被 `loaded && !force` 短路卡在错误态。
      dataPort.markLoaded();
    } catch (error) {
      renderItems({
        loading: false,
        hasItems: false,
        emptyText: (error as { message?: string } | null)?.message || String(error),
      });
    }
  }

  async function changePage(direction: Parameters<typeof dataPort.changePage>[0]) {
    const previousOffset = dataPort.state.query.offset;
    if (!dataPort.changePage(direction)) {
      return;
    }
    try {
      await loadItems(dataPort.jobId(), { selectFirst: true });
    } catch (error) {
      // 翻页失败要把 offset 退回去：changePage 是先就地改 query 再发请求，
      // 不回滚的话列表区显示错误、而分页 meta 已经写着新的页码，
      // "上一页/下一页"的可用状态也跟着错位。
      dataPort.state.query.offset = previousOffset;
      renderItems({
        loading: false,
        hasItems: false,
        emptyText: (error as { message?: string } | null)?.message || String(error),
      });
    }
  }

  async function replaySelected() {
    if (!dataPort.jobId() || !dataPort.state.selectedItemId) {
      return;
    }
    setReplayLoading?.({
      hasResult: false,
      status: "重放中...",
    });
    await dataPort.replaySelectedItem();
    renderReplay();
  }

  return {
    ensureLoaded,
    applyFilter,
    changePage,
    loadItem,
    replaySelected,
    loadItems,
    renderCurrent,
  };
}
