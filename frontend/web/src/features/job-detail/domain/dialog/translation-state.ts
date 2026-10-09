export function createTranslationState() {
  return {
    jobId: "",
    loaded: false,
    summary: null,
    query: {
      finalStatus: "",
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
}

export function resetTranslationState(
  translationState: ReturnType<typeof createTranslationState>,
  jobId = "",
) {
  translationState.jobId = jobId;
  translationState.loaded = false;
  translationState.summary = null;
  // 切任务不继承旧过滤器（limit 保留，仅重置筛选与翻页位置）。
  translationState.query.finalStatus = "";
  translationState.query.q = "";
  translationState.query.offset = 0;
  translationState.list = [];
  translationState.total = 0;
  translationState.selectedItemId = "";
  translationState.selectedItem = null;
  translationState.replay = null;
}
