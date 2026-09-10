import {
  hasCanonicalEventContract,
} from "../contract/job-stage-event-contract.js";
import { firstNumber } from "../presentation/job-stage-presentation-utils.js";
import {
  publicProgressOf,
} from "./job-stage-progress-adapter.js";

export function progressFromEvent(event) {
  const payload = event?.payload && typeof event.payload === "object" ? event.payload : {};
  const publicProgress = publicProgressOf({
    ...payload,
    ...event,
    progress: event?.progress || payload.progress,
  });
  if (publicProgress.current !== null || publicProgress.total !== null) {
    return {
      current: publicProgress.current,
      total: publicProgress.total,
    };
  }
  if (hasCanonicalEventContract(event)) {
    return {
      current: null,
      total: null,
    };
  }
  const current = firstNumber(
    event?.progress_current,
    event?.current,
    payload.progress_current,
    payload.render?.progress_current,
    payload.render?.current,
    payload.current,
    payload.current_page,
    payload.page_current,
    payload.currentPage,
    payload.extracted_pages,
    payload.extractedPages,
    payload.rendered_pages,
    payload.renderedPages,
    payload.completed_pages,
    payload.completedPages,
    payload.finished_pages,
    payload.finishedPages,
    payload.pages_done,
    payload.pagesDone,
  );
  const total = firstNumber(
    event?.progress_total,
    event?.total,
    payload.progress_total,
    payload.render?.progress_total,
    payload.render?.total,
    payload.total,
    payload.total_pages,
    payload.totalPages,
    payload.page_total,
    payload.pageTotal,
    payload.num_pages,
    payload.numPages,
    payload.page_count,
    payload.pages,
  );
  if (current !== null || total !== null) {
    return { current, total };
  }
  return {
    current: null,
    total: null,
  };
}

export function progressPercentFromEvent(event) {
  const payload = event?.payload && typeof event.payload === "object" ? event.payload : {};
  const publicProgress = publicProgressOf({
    ...payload,
    ...event,
    progress: event?.progress || payload.progress,
  });
  if (publicProgress.percent !== null || publicProgress.current !== null || publicProgress.total !== null || publicProgress.unit) {
    return publicProgress.percent;
  }
  if (hasCanonicalEventContract(event)) {
    return null;
  }
  return firstNumber(
    event?.progress_percent,
    payload.progress_percent,
    payload.render?.progress_percent,
    payload.render?.percent,
    event?.percent,
    payload.percent,
  );
}
