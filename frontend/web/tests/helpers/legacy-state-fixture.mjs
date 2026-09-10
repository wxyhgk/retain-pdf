// 遗留全局 state 的测试夹具。
//
// 这些字段原先由 `src/js/state/slices.js` 的 `createInitialState()` 产出——
// 那是一个 8 片合并的全局可变单例。批次 5B 查明其中 6 片（job / upload /
// credential / home / recent-jobs / timer）在生产代码里零消费方：能力早已在
// `features/*` 用 `platform/store` 独立重建，单例只有 desktop / developer 两片
// 还活着（唯一消费方是 app/desktop/bootstrap.ts）。
//
// 但测试仍需要这个形状：被测的 features 函数把状态**写到**传入的对象上，
// 而若干断言校验字段的**初始值**（例如 currentJobEventsJobId 初始为 ""）。
// 那是夹具的属性，不是生产代码的属性。
//
// 所以把形状逐字搬到测试侧自持，让生产代码可以删掉那 6 片。
// 与原 createInitialState() 的展开顺序一致：timer → job → home → upload →
// recentJobs → credential（desktop / developer 两片不在此列，它们仍在生产代码里，
// 需要时从 platform 直接 import）。

export function createLegacyStateFixture() {
  return {
    // timer-state
    timer: null,
    elapsedTimer: null,
    // job-state
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
    // home-state
    homeViewMode: "library",
    homeRecentJobsLoadingState: "idle",
    homeRecentJobsError: "",
    lastLibraryRefreshRequestedAt: 0,
    // upload-state
    uploadId: "",
    uploadedFileName: "",
    uploadedPageCount: 0,
    uploadedBytes: 0,
    appliedPageRange: "",
    submitBusy: false,
    // recent-jobs-state
    recentJobsOffset: 0,
    recentJobsHasMore: true,
    recentJobsItems: [],
    // credential-state
    validatedOcrProvider: "",
    validatedOcrToken: "",
    ocrValidationStatus: "",
    deepseekBalanceCny: null,
    deepseekBalanceChecked: false,
  };
}
