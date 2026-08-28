import { isRecentJobActive } from "./card-presenter.js";
import {
  defaultRecentJobsRefreshEnvironment,
} from "./refresh-environment.js";

export const LIBRARY_ACTIVE_REFRESH_MS = 2500;

export function hasActiveRecentJobs(items = []) {
  return (Array.isArray(items) ? items : []).some(isRecentJobActive);
}

export function recentJobsEligibleForActiveRefresh(items = [], currentJobId = "") {
  const activeJobId = `${currentJobId || ""}`.trim();
  return (Array.isArray(items) ? items : [])
    .filter(isRecentJobActive)
    .filter((item) => {
      const jobId = `${item?.job_id || ""}`.trim();
      return jobId && jobId !== activeJobId;
    });
}

/**
 * Chỉ poll chi tiết "các tác vụ đang chạy khác" và patch từng thẻ.
 * Không loadRecentJobs toàn bộ danh sách theo chu kỳ nữa vì sẽ cộng dồn với soft/silent reload và làm lưới nhấp nháy.
 * Việc đồng bộ toàn bộ dành cho: màn đầu, tìm kiếm, sau khi xóa/tạo, refresh thủ công, scheduleRefresh.
 */
export function createActiveLibraryRefreshLoop({
  getItems,
  currentJobId = () => "",
  fetchJobPayload,
  apiPrefix,
  updateFromRuntime,
  // Giữ tham số để tương thích call-site cũ; đường chạy chu kỳ không còn dùng nữa.
  loadRecentJobs: _loadRecentJobs,
  isRecentJobsLoading,
  environment = defaultRecentJobsRefreshEnvironment,
}: any) {
  let activeLibraryRefreshTimer = null;

  function stop() {
    environment.clearTimeout(activeLibraryRefreshTimer);
    activeLibraryRefreshTimer = null;
  }

  async function refreshActiveRecentJobDetails() {
    if (!fetchJobPayload) {
      return;
    }
    const activeItems = recentJobsEligibleForActiveRefresh(getItems(), currentJobId()).slice(0, 6);
    await Promise.allSettled(activeItems.map(async (item) => {
      const jobId = `${item?.job_id || ""}`.trim();
      if (!jobId) {
        return;
      }
      const payload = await fetchJobPayload(jobId, apiPrefix);
      updateFromRuntime(payload);
    }));
  }

  function schedule({ resetTimer = true }: any = {}) {
    if (resetTimer) {
      stop();
    }
    if (activeLibraryRefreshTimer) {
      return;
    }
    if (!recentJobsEligibleForActiveRefresh(getItems(), currentJobId()).length) {
      return;
    }
    activeLibraryRefreshTimer = environment.setTimeout(() => {
      activeLibraryRefreshTimer = null;
      if (isRecentJobsLoading()) {
        schedule();
        return;
      }
      void refreshActiveRecentJobDetails().finally(() => {
        schedule();
      });
    }, LIBRARY_ACTIVE_REFRESH_MS);
  }

  return {
    schedule,
    stop,
  };
}
