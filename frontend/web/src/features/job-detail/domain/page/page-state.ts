import {
  revokeMarkdownImageUrls as revokeMarkdownImageUrlsView,
} from "./artifacts.js";

export function createJobDetailPageState() {
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

export function revokeJobDetailMarkdownImageUrls(state) {
  revokeMarkdownImageUrlsView(state?.markdownImageUrls || []);
}
