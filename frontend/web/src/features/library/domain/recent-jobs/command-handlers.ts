import { invalidateLibraryBooksResource } from "./library-books-resource.js";
import { hydrateCreatedRecentJob } from "./created-job-hydration.js";
import { isTerminalStatus } from "@retainpdf/domain/job";
import type {
  RecentJobsCommandPort,
  RecentJobsCommandSubscription,
  RecentJobsJobCommandPayload,
  RecentJobsRefreshRequest,
} from "./commands.js";
import type { LibraryJobItem } from "./runtime-item.js";
import type { RecentJobsRuntimePatches } from "./runtime-patches.js";

export interface BindRecentJobsCommandHandlersOptions {
  apiPrefix?: string;
  commandPort?: Pick<RecentJobsCommandPort, "subscribe">;
  fetchJobPayload?: (
    jobId: string,
    options?: { apiPrefix?: string } | string,
  ) => Promise<LibraryJobItem | Record<string, unknown> | null | undefined>;
  libraryBooksResource?: { invalidate?: () => void } | null;
  runtimePatches?: Pick<RecentJobsRuntimePatches, "update" | "insert">;
  refreshScheduler?: {
    scheduleRefresh: (options?: RecentJobsRefreshRequest) => void;
  };
}

export function bindRecentJobsCommandHandlers({
  apiPrefix,
  commandPort,
  fetchJobPayload,
  libraryBooksResource,
  runtimePatches,
  refreshScheduler,
}: BindRecentJobsCommandHandlersOptions = {}): RecentJobsCommandSubscription {
  return commandPort.subscribe({
    onRefreshRequested: ({ delay, force }: RecentJobsRefreshRequest = {}) => {
      invalidateLibraryBooksResource(libraryBooksResource);
      refreshScheduler.scheduleRefresh({ delay: Number(delay ?? 600), force });
    },
    onJobUpdated: ({ job }: RecentJobsJobCommandPayload = {}) => {
      // 运行中只做单卡补丁，不 invalidate / 不整页 refresh。
      // 每拍 invalidate 会让后续任意 soft reload 都打满网、整格重渲。
      runtimePatches.update(job);
      const status = `${(job as LibraryJobItem | null | undefined)?.status || ""}`.trim();
      if (isTerminalStatus(status)) {
        invalidateLibraryBooksResource(libraryBooksResource);
        // soft silent：终态一次对齐文档投影/封面，无视 5s 节流与挂起
        refreshScheduler.scheduleRefresh({ delay: 400, force: true, bypassThrottle: true });
      }
    },
    onJobCreated: ({ job }: RecentJobsJobCommandPayload = {}) => {
      invalidateLibraryBooksResource(libraryBooksResource);
      // insert 内部已按 document_id upsert：已有书就地更新，不会再 prepend 第二张
      runtimePatches.insert(job);
      void hydrateCreatedRecentJob({
        job,
        apiPrefix,
        fetchJobPayload,
        runtimePatches,
      });
    },
  });
}
