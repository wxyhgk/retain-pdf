import { $ } from "../../dom.js";
import { buildFrontendPageUrl } from "../../config.js";
import { resolveJobActions } from "../../job.js";
import {
  boolLabel,
  degradationReasonOf,
  diagnosticsOf,
  errorTypesOf,
  escapeHtml,
  fallbackToOf,
  finalStatusClass,
  finalStatusLabel,
  finalStatusOf,
  firstNonEmptyText,
  normalizeRoutePath,
  pageNumberOf,
  previewText,
  renderField,
  renderTextBlock,
  routePathOf,
  summarizeTranslationFilter,
} from "./formatters.js";
import {
  activateDetailTabView,
  bindStatusDetailEvents,
  dialogComponent,
  openStatusDetailDialogView,
  readTranslationFilterQuery,
  setRerunButtonDisabled,
} from "./view.js";

export function mountStatusDetailFeature({
  state,
  apiPrefix,
  fetchTranslationDiagnostics,
  fetchTranslationItems,
  fetchTranslationItem,
  replayTranslationItem,
  rerunJob,
  startPolling,
  setText,
} = {}) {
  const translationState = {
    jobId: "",
    loaded: false,
    summary: null,
    query: {
      finalStatus: "kept_origin",
      q: "",
      limit: 20,
      offset: 0,
    },
    list: [],
    total: 0,
    selectedItemId: "",
    selectedItem: null,
    replay: null,
  };

  function buildDetailPageUrl(jobId) {
    const normalizedJobId = `${jobId || ""}`.trim();
    if (!normalizedJobId) {
      return "";
    }
    return buildFrontendPageUrl("./detail.html", {
      job_id: normalizedJobId,
    });
  }

  function getCurrentJobId() {
    return `${state?.currentJobId || ""}`.trim();
  }

  function firstJobIdFromPayload(payload) {
    return firstNonEmptyText(
      payload?.job_id,
      payload?.data?.job_id,
      payload?.job?.job_id,
      payload?.job?.id,
      payload?.id,
    );
  }

  function syncRerunAction(statusText = "") {
    const job = state?.currentJobSnapshot || null;
    const actions = job ? resolveJobActions(job) : {};
    const enabled = Boolean(actions.rerunEnabled && actions.rerun);
    dialogComponent()?.setRerunAction?.({
      enabled,
      status: statusText || (enabled
        ? "后端支持从当前任务产物创建恢复任务。"
        : "当前任务暂不可从断点恢复。"),
    });
    return actions.rerun || "";
  }

  async function rerunCurrentJob() {
    const actionUrl = syncRerunAction("正在提交恢复任务...");
    setRerunButtonDisabled(true);
    if (!actionUrl) {
      syncRerunAction("当前任务暂不可从断点恢复。");
      return;
    }
    try {
      const payload = await rerunJob(actionUrl);
      const nextJobId = firstJobIdFromPayload(payload);
      if (!nextJobId) {
        syncRerunAction("恢复任务已提交，但响应中没有 job_id。");
        return;
      }
      dialogComponent()?.close?.();
      setText?.("error-box", `已创建恢复任务 ${nextJobId}，开始轮询。`);
      startPolling?.(nextJobId);
    } catch (error) {
      syncRerunAction(error.message || String(error));
    }
  }

  function activateDetailTab(name = "overview") {
    activateDetailTabView(name);
    if (name === "translation") {
      void ensureTranslationData();
    }
  }

  function openStatusDetailDialog(tabName = "overview") {
    openStatusDetailDialogView(tabName);
    if (tabName === "translation") {
      void ensureTranslationData();
    }
  }

  function resetTranslationState(jobId = "") {
    translationState.jobId = jobId;
    translationState.loaded = false;
    translationState.summary = null;
    translationState.list = [];
    translationState.total = 0;
    translationState.selectedItemId = "";
    translationState.selectedItem = null;
    translationState.replay = null;
  }

  function renderTranslationEmpty(message) {
    const component = dialogComponent();
    component?.renderTranslationSummary({
      hidden: true,
      emptyText: message,
    });
    component?.renderTranslationItems({
      loading: false,
      hasItems: false,
      emptyText: message,
      meta: "-",
    });
    component?.renderTranslationItemDetail({
      loading: false,
      hasItem: false,
      emptyText: "请选择左侧 item",
      meta: "-",
      replayEnabled: false,
    });
    component?.renderTranslationReplay({
      hasResult: false,
      status: "-",
    });
  }

  function renderTranslationSummary() {
    const summary = translationState.summary?.summary || {};
    dialogComponent()?.renderTranslationSummary({
      counts: summary.counts || {},
      finalStatusCounts: summary.final_status_counts || {},
      providerFamily: `${summary.provider_family || ""}`.trim(),
      summaryScopeText: "当前 job 全量统计",
      filterText: summarizeTranslationFilter(translationState.query),
      hidden: false,
    });
  }

  function renderTranslationItems({ loading = false, emptyText = "没有匹配的翻译 item" } = {}) {
    const component = dialogComponent();
    const list = translationState.list || [];
    const offset = Number(translationState.query.offset || 0);
    const limit = Number(translationState.query.limit || 20);
    const total = Number(translationState.total || 0);
    const start = total > 0 ? offset + 1 : 0;
    const end = total > 0 ? Math.min(offset + list.length, total) : 0;
    const totalPages = total > 0 ? Math.ceil(total / Math.max(limit, 1)) : 0;
    const currentPage = total > 0 ? Math.floor(offset / Math.max(limit, 1)) + 1 : 0;
    const meta = loading
      ? "读取中..."
      : `共 ${total} 条，本页 ${list.length} 条，offset ${offset}，limit ${limit}`;
    const pageLabel = loading
      ? "读取中..."
      : total > 0
        ? `第 ${currentPage} / ${totalPages} 页`
        : "第 0 / 0 页";
    const markup = list.map((item) => {
      const active = item.item_id === translationState.selectedItemId;
      const routePath = normalizeRoutePath(routePathOf(item));
      const errorTypes = errorTypesOf(item);
      const errorLabel = errorTypes.length ? errorTypes.join(", ") : "-";
      const degradationReason = degradationReasonOf(item) || "-";
      const finalStatus = finalStatusOf(item);
      return `
        <button
          type="button"
          class="translation-item-card${active ? " is-active" : ""}"
          data-translation-item-id="${escapeHtml(item.item_id)}"
        >
          <div class="translation-item-card-top">
            <span class="translation-item-id mono">${escapeHtml(item.item_id || "-")}</span>
            <span class="translation-item-status ${finalStatusClass(finalStatus)}">${escapeHtml(finalStatusLabel(finalStatus))}</span>
          </div>
          <div class="translation-item-card-meta">
            <span class="translation-item-chip">第 ${escapeHtml(pageNumberOf(item))} 页</span>
            <span class="translation-item-chip">${escapeHtml(item.block_type || "-")}</span>
            <span class="translation-item-chip">${escapeHtml(item.classification_label || "-")}</span>
          </div>
          <div class="translation-item-card-route"><strong>route</strong> ${escapeHtml(routePath || "-")}</div>
          <div class="translation-item-card-preview">${escapeHtml(previewText(item.source_preview || item.source_text || ""))}</div>
          <div class="translation-item-card-footer">
            <span><strong>fallback</strong> ${escapeHtml(fallbackToOf(item) || "-")}</span>
            <span><strong>error</strong> ${escapeHtml(errorLabel)}</span>
          </div>
          <div class="translation-item-card-route"><strong>degradation</strong> ${escapeHtml(degradationReason)}</div>
        </button>
      `;
    }).join("");
    component?.renderTranslationItems({
      markup,
      hasItems: list.length > 0,
      emptyText,
      meta,
      loading,
      pageLabel,
      canPrev: offset > 0,
      canNext: offset + list.length < total,
    });
  }

  function renderTranslationItemDetail({ loading = false, emptyText = "请选择左侧 item" } = {}) {
    const component = dialogComponent();
    const payload = translationState.selectedItem;
    if (loading) {
      component?.renderTranslationItemDetail({
        loading: true,
        hasItem: false,
        emptyText,
        meta: "读取中...",
        replayEnabled: false,
      });
      return;
    }
    if (!payload?.item) {
      component?.renderTranslationItemDetail({
        loading: false,
        hasItem: false,
        emptyText,
        meta: "-",
        replayEnabled: false,
      });
      return;
    }
    const item = payload.item || {};
    const diagnostics = diagnosticsOf(item);
    const routePath = normalizeRoutePath(routePathOf(item));
    const pageNumber = pageNumberOf(payload, pageNumberOf(item));
    const finalStatus = finalStatusOf(item) || finalStatusOf(payload) || "-";
    const markup = `
      <div class="detail-info-list translation-detail-grid">
        ${renderField("item_id", payload.item_id || item.item_id || "-")}
        ${renderField("page_number", pageNumber)}
        ${renderField("block_type", item.block_type || "-")}
        ${renderField("math_mode", item.math_mode || "-")}
        ${renderField("classification_label", item.classification_label || "-")}
        ${renderField("should_translate", boolLabel(item.should_translate))}
        ${renderField("skip_reason", item.skip_reason || "-")}
        ${renderField("final_status", finalStatus)}
        ${renderField("route_path", routePath || "-")}
        ${renderField("fallback_to", fallbackToOf(item) || "-")}
        ${renderField("degradation_reason", degradationReasonOf(item) || "-")}
      </div>
      ${renderTextBlock("原文", item.source_text || "")}
      ${renderTextBlock("落盘翻译", item.translated_text || item.translation_unit_translated_text || item.group_translated_text || "")}
      ${renderTextBlock("保护后译文", item.protected_translated_text || item.translation_unit_protected_translated_text || item.group_protected_translated_text || "")}
      ${renderTextBlock("translation_diagnostics", diagnostics || {})}
    `;
    component?.renderTranslationItemDetail({
      loading: false,
      hasItem: true,
      markup,
      meta: `${payload.item_id || item.item_id || "-"} · 第 ${pageNumber} 页`,
      replayEnabled: true,
    });
  }

  function renderTranslationReplay() {
    const replay = translationState.replay;
    if (!replay?.payload) {
      dialogComponent()?.renderTranslationReplay({
        hasResult: false,
        status: "-",
      });
      return;
    }
    const payload = replay.payload || {};
    const markup = `
      <div class="translation-replay-grid">
        ${renderTextBlock("policy_before", payload.policy_before || {})}
        ${renderTextBlock("policy_after", payload.policy_after || {})}
        ${renderTextBlock("replay_result", payload.replay_result || {})}
        ${renderTextBlock("replay_error", payload.replay_error || null)}
      </div>
    `;
    dialogComponent()?.renderTranslationReplay({
      hasResult: true,
      markup,
      status: payload.replay_error ? "重放返回错误" : "重放完成",
    });
  }

  async function loadTranslationSummary(jobId) {
    translationState.summary = await fetchTranslationDiagnostics(jobId, apiPrefix);
    renderTranslationSummary();
  }

  async function reloadTranslationSummaryAndItems({ selectFirst = false } = {}) {
    const jobId = getCurrentJobId();
    if (!jobId) {
      resetTranslationState("");
      renderTranslationEmpty("请先选择任务");
      return;
    }
    await loadTranslationSummary(jobId);
    await loadTranslationItems(jobId, { selectFirst });
  }

  async function loadTranslationItems(jobId, { selectFirst = false } = {}) {
    renderTranslationItems({ loading: true });
    const payload = await fetchTranslationItems(jobId, apiPrefix, translationState.query);
    translationState.list = Array.isArray(payload?.items) ? payload.items : [];
    translationState.total = Number(payload?.total || 0);
    renderTranslationItems();
    const shouldKeepCurrent = translationState.list.some((item) => item.item_id === translationState.selectedItemId);
    if (shouldKeepCurrent) {
      return;
    }
    const nextItemId = selectFirst && translationState.list.length
      ? `${translationState.list[0].item_id || ""}`.trim()
      : "";
    translationState.selectedItemId = nextItemId;
    translationState.selectedItem = null;
    translationState.replay = null;
    renderTranslationItemDetail({
      emptyText: nextItemId ? "请选择左侧 item" : "没有可查看的 item",
    });
    renderTranslationReplay();
    if (nextItemId) {
      await loadTranslationItem(jobId, nextItemId);
    }
  }

  async function loadTranslationItem(jobId, itemId) {
    if (!itemId) {
      return;
    }
    translationState.selectedItemId = itemId;
    translationState.replay = null;
    renderTranslationItems();
    renderTranslationItemDetail({ loading: true });
    renderTranslationReplay();
    translationState.selectedItem = await fetchTranslationItem(jobId, itemId, apiPrefix);
    renderTranslationItemDetail();
  }

  async function replayCurrentItem() {
    const jobId = getCurrentJobId();
    const itemId = `${translationState.selectedItemId || ""}`.trim();
    if (!jobId || !itemId) {
      return;
    }
    dialogComponent()?.renderTranslationReplay({
      hasResult: false,
      status: "重放中...",
    });
    translationState.replay = await replayTranslationItem(jobId, itemId, apiPrefix);
    renderTranslationReplay();
  }

  async function ensureTranslationData({ force = false } = {}) {
    const jobId = getCurrentJobId();
    if (!jobId) {
      resetTranslationState("");
      renderTranslationEmpty("请先选择任务");
      return;
    }
    if (translationState.jobId !== jobId) {
      resetTranslationState(jobId);
    }
    if (translationState.loaded && !force) {
      renderTranslationSummary();
      renderTranslationItems();
      renderTranslationItemDetail();
      renderTranslationReplay();
      return;
    }
    renderTranslationEmpty("正在读取翻译调试数据...");
    try {
      await reloadTranslationSummaryAndItems({ selectFirst: true });
      translationState.loaded = true;
    } catch (error) {
      renderTranslationEmpty(error.message || String(error));
    }
  }

  async function handleTranslationApply() {
    const query = readTranslationFilterQuery();
    translationState.query.finalStatus = query.finalStatus;
    translationState.query.q = query.q;
    translationState.query.offset = 0;
    translationState.loaded = true;
    renderTranslationSummary();
    try {
      await reloadTranslationSummaryAndItems({ selectFirst: true });
    } catch (error) {
      renderTranslationItems({
        loading: false,
        hasItems: false,
        emptyText: error.message || String(error),
      });
    }
  }

  async function changeTranslationPage(direction) {
    const limit = Number(translationState.query.limit || 20);
    const nextOffset = direction === "next"
      ? Number(translationState.query.offset || 0) + limit
      : Math.max(0, Number(translationState.query.offset || 0) - limit);
    if (nextOffset === Number(translationState.query.offset || 0)) {
      return;
    }
    translationState.query.offset = nextOffset;
    try {
      await loadTranslationItems(getCurrentJobId(), { selectFirst: true });
    } catch (error) {
      renderTranslationItems({
        loading: false,
        hasItems: false,
        emptyText: error.message || String(error),
      });
    }
  }

  function bindEvents() {
    bindStatusDetailEvents({
      openStatusDetailDialog,
      activateDetailTab,
      handleTranslationApply,
      changeTranslationPage,
      loadTranslationItem,
      replayCurrentItem,
      rerunCurrentJob,
      currentJobId: getCurrentJobId,
      renderTranslationItemDetail,
      renderTranslationReplay: (payload) => dialogComponent()?.renderTranslationReplay(payload),
      renderTextBlock,
    });
  }

  return {
    activateDetailTab,
    bindEvents,
    openStatusDetailDialog,
    buildDetailPageUrl,
    ensureTranslationData,
    syncRerunAction,
  };
}
