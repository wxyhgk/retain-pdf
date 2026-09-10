export function createStatusDetailOverviewCoordinator({
  runtimePort,
  apiPrefix = "",
  fetchJobPayload,
  fetchJobEvents,
  fetchJobDiagnostics,
  fetchResumePlan,
  fetchJobStageActions,
  renderJob,
  renderOverviewSnapshot,
  setErrorText,
}: any = {}) {
  const state = {
    loadingPromise: null,
  };

  function cachedContextFor(jobId) {
    const previousContext = runtimePort.currentRenderContext(jobId);
    if (previousContext.job) {
      return previousContext;
    }
    return {
      ...previousContext,
      job: runtimePort.currentJobSnapshot() || { job_id: jobId },
    };
  }

  async function loadFreshContext(jobId, previousContext) {
    const [payload, eventsPayload, diagnosticsPayload, resumePlan, stageActionsPayload] = await Promise.all([
      fetchJobPayload ? fetchJobPayload(jobId, { apiPrefix }) : Promise.resolve(previousContext.job),
      fetchJobEvents ? fetchJobEvents(jobId, apiPrefix, 200, 0).catch(() => previousContext.events) : Promise.resolve(previousContext.events),
      fetchJobDiagnostics ? fetchJobDiagnostics(jobId, apiPrefix).catch(() => null) : Promise.resolve(null),
      fetchResumePlan ? fetchResumePlan(jobId, apiPrefix).catch(() => null) : Promise.resolve(null),
      fetchJobStageActions ? fetchJobStageActions(jobId, apiPrefix).catch(() => null) : Promise.resolve(null),
    ]);
    if (!runtimePort.isCurrentJob(jobId)) {
      return null;
    }
    return runtimePort.applyOverviewPayload({
      payload,
      eventsPayload,
      diagnosticsPayload,
      resumePlan,
      stageActionsPayload,
      fallbackJobId: jobId,
    });
  }

  async function ensureLoaded({ force = false }: any = {}) {
    const jobId = runtimePort.currentJobId();
    if (!jobId) {
      return;
    }
    if (state.loadingPromise && !force) {
      await state.loadingPromise;
      return;
    }
    const previousContext = runtimePort.currentRenderContext(jobId);
    renderOverviewSnapshot(cachedContextFor(jobId));
    state.loadingPromise = (async () => {
      try {
        const renderContext = await loadFreshContext(jobId, previousContext);
        if (!renderContext) {
          return;
        }
        renderJob?.(renderContext);
        renderOverviewSnapshot(renderContext);
      } catch (error) {
        setErrorText?.(error.message || String(error));
      } finally {
        state.loadingPromise = null;
      }
    })();
    await state.loadingPromise;
  }

  return {
    ensureLoaded,
    cachedContextFor,
  };
}
