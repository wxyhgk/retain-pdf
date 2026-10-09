import { isRecentJobActive } from "./card-presenter.js";

export function resolveRecoverableJobId(items = [], {
  readActiveJobId = () => "",
}: { readActiveJobId?: () => string } = {}) {
  const sourceItems = Array.isArray(items) ? items : [];
  const storedJobId = readActiveJobId();
  if (storedJobId) {
    const storedItem = sourceItems.find((item) => `${item?.job_id || ""}`.trim() === storedJobId);
    if (storedItem && !isRecentJobActive(storedItem)) {
      return "";
    }
    return storedJobId;
  }
  const activeItem = sourceItems.find(isRecentJobActive);
  return `${activeItem?.job_id || ""}`.trim();
}
