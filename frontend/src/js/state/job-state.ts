export function createJobState() {
  return {
    currentJobId: "",
    currentJobSnapshot: null,
    currentJobManifest: null,
    currentJobManifestJobId: "",
    currentJobManifestFetchedAt: 0,
    currentJobEvents: null,
    currentJobEventsJobId: "",
    currentJobEventsFetchedAt: 0,
    currentJobStageActions: null,
    currentJobStageActionsJobId: "",
    currentJobStageActionsFetchedAt: 0,
    currentJobPollGeneration: 0,
    currentJobPollInFlight: false,
    currentJobEventsFetchInFlight: false,
    currentJobManifestFetchInFlight: false,
    currentJobStageActionsFetchInFlight: false,
    currentJobDisplayedStageKey: "",
    currentJobDisplayedStageJobId: "",
    currentJobStartedAt: "",
    currentJobFinishedAt: "",
  };
}

export function resetJobState(target) {
  Object.assign(target, createJobState());
  syncCurrentJobStoreReset(target);
  syncRuntimePollingStoreReset(target);
  syncSecondaryResourceReset(target, { preserveInFlight: false });
}

export function resetJobSecondaryState(target) {
  Object.assign(target, {
    currentJobManifest: null,
    currentJobManifestJobId: "",
    currentJobManifestFetchedAt: 0,
    currentJobEvents: null,
    currentJobEventsJobId: "",
    currentJobEventsFetchedAt: 0,
    currentJobStageActions: null,
    currentJobStageActionsJobId: "",
    currentJobStageActionsFetchedAt: 0,
    currentJobPollInFlight: false,
    currentJobEventsFetchInFlight: false,
    currentJobManifestFetchInFlight: false,
    currentJobStageActionsFetchInFlight: false,
    currentJobDisplayedStageKey: "",
    currentJobDisplayedStageJobId: "",
  });
  syncSecondaryResourceReset(target, { preserveInFlight: false });
}

function storeBySymbol(target, name) {
  const symbols = Object.getOwnPropertySymbols(target || {});
  const found = symbols.find((symbol) => String(symbol) === `Symbol(${name})`);
  return found ? target[found] : null;
}

function syncCurrentJobStoreReset(target) {
  const store = storeBySymbol(target, "retainpdf.currentJobStore");
  if (!store?.batch) {
    return;
  }
  store.batch(({ actions }) => {
    actions.syncSnapshot(null, "", {});
    actions.clearTiming();
    actions.cacheDiagnostics("", null);
    actions.cacheResumePlan("", null);
  });
}

function syncRuntimePollingStoreReset(target) {
  const store = storeBySymbol(target, "retainpdf.runtimePollingStore");
  // startJob("") sẽ tăng generation đồng thời, khiến các polling đang thực hiện tự động vô hiệu
  store?.actions?.startJob?.("");
}

function syncSecondaryResourceReset(target, options) {
  const symbols = Object.getOwnPropertySymbols(target || {});
  const secondaryStoreSymbol = symbols.find((symbol) => String(symbol) === "Symbol(retainpdf.secondaryResourceStore)");
  const secondaryStore = secondaryStoreSymbol ? target[secondaryStoreSymbol] : null;
  if (!secondaryStore?.reset) {
    return;
  }
  const emptyRecord = {
    payload: null,
    jobId: "",
    fetchedAt: 0,
    inFlight: false,
  };
  const next = {
    events: { ...emptyRecord, inFlight: options?.preserveInFlight ? Boolean(target.currentJobEventsFetchInFlight) : false },
    manifest: { ...emptyRecord, inFlight: options?.preserveInFlight ? Boolean(target.currentJobManifestFetchInFlight) : false },
    stageActions: { ...emptyRecord, inFlight: options?.preserveInFlight ? Boolean(target.currentJobStageActionsFetchInFlight) : false },
  };
  secondaryStore.reset(next);
}
