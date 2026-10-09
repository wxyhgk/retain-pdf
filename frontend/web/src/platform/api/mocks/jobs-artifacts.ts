import {
  getMockJobArtifactsManifest,
  getMockJobMarkdown,
} from "@/platform/mock/index.js";

// mock-only 适配器:index.ts 的 mockable() 只在 mock 模式调用这些实现。
// mock manifests 已携带完整产物集合,无需二次投影。
export async function fetchJobArtifactsManifest(jobId: string, apiPrefix: string) {
  void jobId;
  void apiPrefix;
  return getMockJobArtifactsManifest();
}

export async function fetchJobMarkdown(jobId: string, apiPrefix: string) {
  void jobId;
  void apiPrefix;
  return getMockJobMarkdown();
}
