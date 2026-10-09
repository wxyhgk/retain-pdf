import { defineConnectedComponent } from "@/platform/store/connector.js";
import type { LibraryJobItem, RecentJobsStatePort } from "./state.js";

type RecentJobsStoreRendererActions = {
  selectJob?: (jobId: string) => unknown;
  deleteJob?: (jobId: string) => void | Promise<void>;
  openJobReader?: (jobId: string, ...rest: unknown[]) => unknown;
};

type RecentJobsListPayload = {
  items: LibraryJobItem[];
  allItems: LibraryJobItem[];
  invocationSummary: Record<string, unknown> | null;
  reset: boolean;
  hasMore: boolean;
  onSelect?: RecentJobsStoreRendererActions["selectJob"];
  onDelete?: RecentJobsStoreRendererActions["deleteJob"];
  onReader?: RecentJobsStoreRendererActions["openJobReader"];
};

export function createRecentJobsStoreRenderer({
  recentJobsStatePort,
  renderRecentJobsList,
  actions,
  invocationSummary = null,
  renderActions = ["prependItem", "replaceItem", "removeJobFamily"],
}: {
  recentJobsStatePort?: Pick<RecentJobsStatePort, "store" | "getSnapshot">;
  renderRecentJobsList?: (payload: RecentJobsListPayload) => void;
  actions?: RecentJobsStoreRendererActions;
  invocationSummary?: Record<string, unknown> | null;
  renderActions?: string[];
} = {}) {
  if (!recentJobsStatePort?.store || typeof renderRecentJobsList !== "function") {
    return {
      renderNow() {},
      unmount() {},
    };
  }

  let currentInvocationSummary = invocationSummary;
  const actionSet = new Set((Array.isArray(renderActions) ? renderActions : [])
    .map((action) => `${action || ""}`.trim())
    .filter(Boolean));

  function renderList(viewModel) {
    renderRecentJobsList({
      items: viewModel.items,
      allItems: viewModel.items,
      invocationSummary: viewModel.invocationSummary ?? currentInvocationSummary,
      reset: true,
      hasMore: viewModel.hasMore,
      onSelect: actions?.selectJob,
      onDelete: actions?.deleteJob,
      onReader: actions?.openJobReader,
    });
  }

  const component = defineConnectedComponent({
    name: "recent-jobs-store-renderer",
    sources: {
      recentJobs: recentJobsStatePort.store,
    },
    mapState({ recentJobs }) {
      return {
        hasMore: Boolean(recentJobs?.hasMore),
        invocationSummary: recentJobs?.invocationSummary ?? null,
        items: Array.isArray(recentJobs?.items) ? recentJobs.items : [],
      };
    },
    render(viewModel, { meta = {} }: { meta?: { initial?: boolean; action?: string } } = {}) {
      if (meta.initial) {
        return;
      }
      if (!actionSet.has(`${meta.action || ""}`)) {
        return;
      }
      renderList(viewModel);
    },
  });

  const mounted = component.mount();

  function renderNow({ invocationSummary: nextInvocationSummary = currentInvocationSummary }: { invocationSummary?: Record<string, unknown> | null } = {}) {
    currentInvocationSummary = nextInvocationSummary;
    const snapshot = recentJobsStatePort.getSnapshot();
    renderList({
      items: snapshot.items,
      invocationSummary: snapshot.invocationSummary ?? currentInvocationSummary,
      hasMore: snapshot.hasMore,
    });
  }

  return {
    renderNow,
    unmount: () => mounted?.unmount?.(),
  };
}
