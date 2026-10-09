import {
  revokeMarkdownImageUrls as revokeMarkdownImageUrlsView,
} from "./artifacts.js";
import type { JobLike, JobPayload, ManifestPayload } from "@retainpdf/domain/job";
import type { EventsPayload } from "@retainpdf/domain/job-status";
import type { ResumePlanLike } from "../dialog/resume-actions.js";
import type { MarkdownPayloadLike } from "./page-ports.js";

/** 详情页（DOM 版）的页面级可变状态 */
export interface JobDetailPageState {
  job: JobLike | JobPayload | null;
  manifestPayload: ManifestPayload | null;
  markdownPayload: MarkdownPayloadLike | null;
  markdownImageUrls: string[];
  eventsPayload: EventsPayload | null;
  eventsLoadingPromise: Promise<EventsPayload> | null;
  rerunActionUrl: string;
  resumePlan: ResumePlanLike | null;
}

export function createJobDetailPageState(): JobDetailPageState {
  return {
    job: null,
    manifestPayload: null,
    markdownPayload: null,
    markdownImageUrls: [],
    eventsPayload: null,
    eventsLoadingPromise: null,
    rerunActionUrl: "",
    resumePlan: null,
  };
}

export function revokeJobDetailMarkdownImageUrls(state: JobDetailPageState | null | undefined) {
  revokeMarkdownImageUrlsView(state?.markdownImageUrls || []);
}
