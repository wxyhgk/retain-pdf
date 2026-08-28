export function createStatusDetailTranslationTabCoordinator({
  dataPort,
  renderEmpty,
  renderSummary,
  renderItems,
  renderItemDetail,
  renderReplay,
  setReplayLoading,
}: any) {
  function renderCurrent() {
    renderSummary();
    renderItems();
    renderItemDetail();
    renderReplay();
  }

  function renderSelectionPlaceholder(selection) {
    renderItemDetail({
      emptyText: selection?.selectedItemId ? "Vui lòng chọn item bên trái" : "Không có item để xem",
    });
    renderReplay();
  }

  async function loadSelectedItem(selection) {
    if (!selection?.shouldLoadSelectedItem) {
      return;
    }
    await loadItem(selection.jobId, selection.selectedItemId);
  }

  async function loadItems(jobId, { selectFirst = false }: any = {}) {
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

  async function loadItem(jobId, itemId) {
    if (!itemId) {
      return;
    }
    renderItems();
    renderItemDetail({ loading: true });
    renderReplay();
    await dataPort.loadItem(jobId, itemId);
    renderItemDetail();
  }

  async function ensureLoaded({ force = false }: any = {}) {
    const jobId = dataPort.jobId();
    if (!jobId) {
      dataPort.reset("");
      renderEmpty("Vui lòng chọn tác vụ trước");
      return;
    }
    dataPort.syncJob();
    if (dataPort.state.loaded && !force) {
      renderCurrent();
      return;
    }
    renderEmpty("Đang đọc dữ liệu debug bản dịch...");
    try {
      const selection = await dataPort.loadSummaryAndItems({ selectFirst: true });
      renderSummary();
      renderItems();
      renderSelectionPlaceholder(selection);
      await loadSelectedItem(selection);
      dataPort.markLoaded();
    } catch (error) {
      renderEmpty(error.message || String(error));
    }
  }

  async function applyFilter(query) {
    dataPort.applyQuery(query);
    renderSummary();
    try {
      const selection = await dataPort.loadSummaryAndItems({ selectFirst: true });
      renderSummary();
      renderItems();
      renderSelectionPlaceholder(selection);
      await loadSelectedItem(selection);
    } catch (error) {
      renderItems({
        loading: false,
        hasItems: false,
        emptyText: error.message || String(error),
      });
    }
  }

  async function changePage(direction) {
    if (!dataPort.changePage(direction)) {
      return;
    }
    try {
      await loadItems(dataPort.jobId(), { selectFirst: true });
    } catch (error) {
      renderItems({
        loading: false,
        hasItems: false,
        emptyText: error.message || String(error),
      });
    }
  }

  async function replaySelected() {
    if (!dataPort.jobId() || !dataPort.state.selectedItemId) {
      return;
    }
    setReplayLoading?.({
      hasResult: false,
      status: "Đang phát lại...",
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
