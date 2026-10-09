import { createLibraryEventPort } from "@/platform/contracts/library-event-contract.js";

export function createRecentJobsLibraryRefreshPort({ target = document }: Parameters<typeof createLibraryEventPort>[0] = {}) {
  return createLibraryEventPort({ target });
}
