import {
  requestThrottledLibraryRefresh,
} from "@/platform/contracts/library-event-contract.js";

const noopLibraryEventPort = Object.freeze({
  publishJobUpdated() {},
  requestRefresh() {},
});

export function requestLibraryRefresh(state, { terminal = false, port = noopLibraryEventPort }: any = {}) {
  requestThrottledLibraryRefresh(state, { terminal, port });
}

export function notifyLibraryJobUpdated(job, { port = noopLibraryEventPort }: any = {}) {
  port.publishJobUpdated(job);
}
