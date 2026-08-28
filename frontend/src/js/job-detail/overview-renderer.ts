import { $ } from "../dom/query.js";
import { resolveJobActions } from "../job/actions.js";
import { resolveLiveDurations } from "../job/durations.js";
import { renderArtifactsManifest } from "./artifacts.js";
import { applyDiagnostics, renderFailureDebugContext } from "./failure.js";
import { renderJobDetailActionLinks } from "./action-links.js";
import { renderInitialMarkdownContract } from "./markdown-flow.js";
import { summarizeResumePlan } from "./resume.js";
import { buildJobDetailStatusViewModel } from "./status-view-model.js";
import {
  renderJobDetailFailureSummary,
  renderJobDetailPublicError,
  renderJobDetailRuntimeSummary,
} from "./summary.js";

export function renderJobDetailOverview({
  diagnosticsPayload = null,
  job,
  manifestPayload = null,
  resumePlan = null,
  setActionLink,
  setEventsStatus,
  setText,
  state,
}) {
  if (state) {
    state.job = job;
    state.manifestPayload = manifestPayload;
    state.resumePlan = resumePlan;
  }
  const durations = resolveLiveDurations(job);
  const actions = resolveJobActions(job);
  const statusViewModel = buildJobDetailStatusViewModel(job, state?.eventsPayload);
  if (state) {
    state.rerunActionUrl = actions.rerun;
  }

  renderArtifactsManifest(manifestPayload);
  renderInitialMarkdownContract({
    job,
    markdownImageUrls: state?.markdownImageUrls || [],
    setActionLink,
    setText,
  });
  renderJobDetailRuntimeSummary({ durations, job, setText, statusViewModel });
  renderJobDetailFailureSummary({ job, setText });
  applyDiagnostics(diagnosticsPayload, job, setText);
  renderFailureDebugContext(job);

  const rerunEnabled = Boolean(resumePlan?.can_resume || (actions.rerunEnabled && actions.rerun));
  if ($("detail-rerun-btn")) {
    ($("detail-rerun-btn") as any).disabled = !rerunEnabled;
  }
  setText("detail-rerun-status", summarizeResumePlan(resumePlan));
  renderJobDetailPublicError({ job, setText });
  setEventsStatus("Chưa tải");
  renderJobDetailActionLinks({ actions, job, manifestPayload, setActionLink });

  return { actions, durations, statusViewModel };
}
