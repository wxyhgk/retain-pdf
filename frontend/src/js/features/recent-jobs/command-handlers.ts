import { invalidateLibraryBooksResource } from "./library-books-resource.js";
import { hydrateCreatedRecentJob } from "./created-job-hydration.js";
import { isTerminalStatus } from "../../job/core.js";
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
    apiPrefix?: string,
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
      // Khi đang chạy chỉ patch một thẻ, không invalidate / không refresh cả trang.
      // Invalidate ở mỗi nhịp sẽ khiến mọi soft reload sau đó đánh đầy mạng và render lại cả lưới.
      runtimePatches.update(job);
      const status = `${(job as LibraryJobItem | null | undefined)?.status || ""}`.trim();
      if (isTerminalStatus(status)) {
        invalidateLibraryBooksResource(libraryBooksResource);
        // soft silent: terminal state đồng bộ projection/cover của document một lần.
        refreshScheduler.scheduleRefresh({ delay: 400, bypassThrottle: true });
      }
    },
    onJobCreated: ({ job }: RecentJobsJobCommandPayload = {}) => {
      invalidateLibraryBooksResource(libraryBooksResource);
      // Bên trong insert đã upsert theo document_id: sách đã có sẽ update tại chỗ, không prepend thẻ thứ hai.
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
