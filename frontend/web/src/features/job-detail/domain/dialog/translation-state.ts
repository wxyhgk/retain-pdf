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

export function resetTranslationState(translationState, jobId = "") {
  translationState.jobId = jobId;
  translationState.loaded = false;
  translationState.summary = null;
  translationState.list = [];
  translationState.total = 0;
  translationState.selectedItemId = "";
  translationState.selectedItem = null;
  translationState.replay = null;
}
