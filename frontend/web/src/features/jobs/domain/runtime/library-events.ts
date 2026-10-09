import type { JobLike, JobPayload } from "@retainpdf/domain/job";
import {
  requestThrottledLibraryRefresh,
  type LibraryRefreshThrottleState,
} from "@/platform/contracts/library-event-contract.js";

/** 书架事件端口：发布任务更新 / 创建，以及请求刷新（requestRefresh 可缺省） */
export interface LibraryEventPort {
  publishJobUpdated: (job: JobLike | JobPayload) => void;
  publishJobCreated?: (job: JobLike | JobPayload) => void;
  requestRefresh?: (options?: { delay?: number | string; force?: boolean; bypassThrottle?: boolean }) => void;
}

const noopLibraryEventPort: LibraryEventPort = Object.freeze({
  publishJobUpdated() {},
  requestRefresh() {},
});

export function requestLibraryRefresh(
  state: object,
  { terminal = false, port = noopLibraryEventPort }: { terminal?: boolean; port?: LibraryEventPort } = {},
) {
  requestThrottledLibraryRefresh(state as LibraryRefreshThrottleState, { terminal, port });
}

export function notifyLibraryJobUpdated(
  job: JobLike | JobPayload,
  { port = noopLibraryEventPort }: { port?: LibraryEventPort } = {},
) {
  port.publishJobUpdated(job);
}
