/** createTranslationState() 状态袋形状（可变，由 dataPort 就地写） */
export interface TranslationStateBag {
  jobId: string;
  loaded: boolean;
  summary: unknown;
  query: {
    finalStatus: string;
    q: string;
    limit: number;
    offset: number;
  };
  list: Array<{ item_id?: string; [key: string]: unknown }>;
  total: number;
  selectedItemId: string;
  selectedItem: unknown;
  replay: unknown;
}

export interface TranslationDataPortDeps {
  translationState: TranslationStateBag;
  apiPrefix?: string;
  currentJobId?: (() => string) | null;
  fetchTranslationDiagnostics: (jobId: string, apiPrefix?: string) => Promise<unknown>;
  fetchTranslationItems: (
    jobId: string,
    apiPrefix?: string,
    query?: TranslationStateBag["query"] | Record<string, unknown>,
  ) => Promise<unknown>;
  fetchTranslationItem: (
    jobId: string,
    itemId: string,
    apiPrefix?: string,
  ) => Promise<unknown>;
  replayTranslationItem: (
    jobId: string,
    itemId: string,
    apiPrefix?: string,
  ) => Promise<unknown>;
}

export interface TranslationLoadItemsOptions {
  selectFirst?: boolean;
}

export interface TranslationApplyQueryOptions {
  finalStatus?: string;
  q?: string;
}

export function createStatusDetailTranslationDataPort({
  translationState,
  apiPrefix,
  currentJobId,
  fetchTranslationDiagnostics,
  fetchTranslationItems,
  fetchTranslationItem,
  replayTranslationItem,
}: TranslationDataPortDeps) {
  function jobId() {
    return `${currentJobId?.() || ""}`.trim();
  }

  function reset(nextJobId = "") {
    translationState.jobId = nextJobId;
    translationState.loaded = false;
    translationState.summary = null;
    translationState.list = [];
    translationState.total = 0;
    translationState.selectedItemId = "";
    translationState.selectedItem = null;
    translationState.replay = null;
  }

  function syncJob() {
    const nextJobId = jobId();
    if (!nextJobId) {
      reset("");
      return "";
    }
    if (translationState.jobId !== nextJobId) {
      reset(nextJobId);
    }
    return nextJobId;
  }

  async function loadSummary(nextJobId: string) {
    translationState.summary = await fetchTranslationDiagnostics(nextJobId, apiPrefix);
    return translationState.summary;
  }

  async function loadItems(nextJobId: string, { selectFirst = false }: TranslationLoadItemsOptions = {}) {
    const payload = await fetchTranslationItems(nextJobId, apiPrefix, translationState.query) as {
      items?: Array<{ item_id?: string; [key: string]: unknown }>;
      total?: number;
    } | null | undefined;
    translationState.list = Array.isArray(payload?.items) ? payload.items : [];
    translationState.total = Number(payload?.total || 0);
    const shouldKeepCurrent = translationState.list.some((item) => item.item_id === translationState.selectedItemId);
    if (shouldKeepCurrent) {
      return {
        selectedItemId: translationState.selectedItemId,
        shouldLoadSelectedItem: false,
        selectionChanged: false,
      };
    }
    const nextItemId = selectFirst && translationState.list.length
      ? `${translationState.list[0].item_id || ""}`.trim()
      : "";
    translationState.selectedItemId = nextItemId;
    translationState.selectedItem = null;
    translationState.replay = null;
    return {
      selectedItemId: nextItemId,
      shouldLoadSelectedItem: Boolean(nextItemId),
      selectionChanged: true,
    };
  }

  async function loadSummaryAndItems({ selectFirst = false }: TranslationLoadItemsOptions = {}) {
    const nextJobId = syncJob();
    if (!nextJobId) {
      return {
        jobId: "",
        selectedItemId: "",
        shouldLoadSelectedItem: false,
        selectionChanged: true,
      };
    }
    await loadSummary(nextJobId);
    const itemSelection = await loadItems(nextJobId, { selectFirst });
    return {
      jobId: nextJobId,
      ...itemSelection,
    };
  }

  async function loadItem(nextJobId: string, itemId: string) {
    const normalizedItemId = `${itemId || ""}`.trim();
    if (!normalizedItemId) {
      return null;
    }
    translationState.selectedItemId = normalizedItemId;
    translationState.replay = null;
    translationState.selectedItem = await fetchTranslationItem(nextJobId, normalizedItemId, apiPrefix);
    return translationState.selectedItem;
  }

  async function replaySelectedItem() {
    const nextJobId = jobId();
    const itemId = `${translationState.selectedItemId || ""}`.trim();
    if (!nextJobId || !itemId) {
      return null;
    }
    translationState.replay = await replayTranslationItem(nextJobId, itemId, apiPrefix);
    return translationState.replay;
  }

  function applyQuery({ finalStatus = "", q = "" }: TranslationApplyQueryOptions = {}) {
    translationState.query.finalStatus = finalStatus;
    translationState.query.q = q;
    translationState.query.offset = 0;
    translationState.loaded = true;
  }

  function changePage(direction: string) {
    const limit = Number(translationState.query.limit || 20);
    const currentOffset = Number(translationState.query.offset || 0);
    const nextOffset = direction === "next"
      ? currentOffset + limit
      : Math.max(0, currentOffset - limit);
    if (nextOffset === currentOffset) {
      return false;
    }
    translationState.query.offset = nextOffset;
    return true;
  }

  function markLoaded() {
    translationState.loaded = true;
  }

  return {
    state: translationState,
    jobId,
    syncJob,
    reset,
    loadSummaryAndItems,
    loadItems,
    loadItem,
    replaySelectedItem,
    applyQuery,
    changePage,
    markLoaded,
  };
}

export type StatusDetailTranslationDataPort = ReturnType<typeof createStatusDetailTranslationDataPort>;
