// 最近任务卡片：阶段文案、进度、封面候选地址与图片缓存。
// 从原 recent-jobs.test.mjs 拆出，用例原样搬移。

import test from "node:test";
import assert from "node:assert/strict";
import {
  recentJobRawImageUrls,
  recentJobProgressPercent,
  stageKeyForRecentJobLabel,
  recentJobStageLabel,
  recentJobStatusLabel,
} from "../../src/features/library/domain/recent-jobs/card-presenter.js";
import {
  clearRecentJobImageCache,
  loadRecentJobImage,
} from "../../src/features/library/domain/recent-jobs/image-loader.js";
import { recentJobImageRefreshUrls } from "../../src/features/library/domain/recent-jobs/image-refresh.js";
import {
  buildJobImageCandidateUrls,
  normalizeJobImageUrl,
} from "@retainpdf/api/job-images";

test("recent job stage labels use the shared public stage resolver", () => {
  const mergedItem = {
    status: "running",
    stage: "translate",
    display_stage: "render",
    substage: "render_prewarm",
    stage_detail: "render payload prewarm: ready",
  };
  assert.equal(stageKeyForRecentJobLabel(mergedItem), "render");
  assert.equal(recentJobStageLabel(mergedItem), "渲染中");
	  assert.equal(
	    recentJobStageLabel({
	      status: "running",
	      display_stage: "render",
	      stage: "render",
	      current_stage: "rendering",
	      stage_detail: "render payload prewarm: ready",
	      runtime_status: {
	        stageKey: "translate",
	        detail: "正在翻译正文内容",
	      },
	    }),
	    "渲染中",
	  );
  assert.equal(
    recentJobStageLabel({
      status: "running",
      display_stage: "translation",
      stage: "render",
      stage_detail: "",
    }),
    "翻译中",
  );
	  assert.equal(
	    recentJobStageLabel({
	      status: "running",
	      display_stage: "translation",
	      stage_snapshot: {
	        stageKey: "render",
	        publicStage: "render",
	      },
	    }),
	    "翻译中",
	  );
	  assert.equal(
	    recentJobStageLabel({
	      status: "running",
	      display_stage: "translation",
	      runtime_status: {
	        stageKey: "done",
	        publicStage: "done",
	        detail: "翻译 PDF 已生成",
	      },
	      stage_snapshot: {
	        stageKey: "render",
	        publicStage: "render",
	        source: "legacy-stage",
	      },
	    }),
	    "翻译中",
	  );
  assert.equal(
    recentJobStageLabel({
      status: "running",
      display_stage: "render",
      stage: "rendering",
    }),
    "渲染中",
  );
  assert.equal(
    recentJobStageLabel({
      status: "succeeded",
      display_stage: "done",
      stage: "rendering",
    }),
    "已完成",
  );
  assert.equal(
    stageKeyForRecentJobLabel({
      job_id: "job-new-contract-terminal-card",
      status: "succeeded",
      stage_snapshot: null,
      background_snapshots: [
        {
          display_stage: "render",
          lane: "background",
          progress: { current: 2, total: 3, percent: 66.66666666666666, unit: "step" },
        },
      ],
      output_pdf_ready: true,
    }),
    "done",
  );
  assert.equal(
    recentJobStageLabel({
      job_id: "job-new-contract-terminal-card",
      status: "succeeded",
      stage_snapshot: null,
      background_snapshots: [
        {
          display_stage: "render",
          lane: "background",
          progress: { current: 2, total: 3, percent: 66.66666666666666, unit: "step" },
        },
      ],
      output_pdf_ready: true,
    }),
    "已完成",
  );
  assert.equal(
    recentJobStatusLabel("cancelled"),
    "已取消",
  );
});

test("recent job card progress prefers runtime status view model", () => {
  assert.equal(
    recentJobProgressPercent({
      status: "running",
      progress: { current: 100, total: 100, percent: 100, unit: "page" },
      runtime_status: {
        progress: { current: 25, total: 100, percent: 25, unit: "batch" },
      },
    }),
    25,
  );
});

test("recent job covers avoid probing missing image endpoints without readiness", () => {
  assert.deepEqual(
    recentJobRawImageUrls({
      job_id: "job-cover",
      thumbnail_url: "",
      cover_url: "",
    }),
    [],
  );
});

test("recent job covers only use the server-provided image urls (no self-built fallbacks)", () => {
  // 书架和文档列表现在给同一本书同一个地址；以前自己再拼 jobs/… 和 library/books/… 两条，同一张图下两份。
  assert.deepEqual(
    recentJobRawImageUrls({
      job_id: "job-cover",
      thumbnail_ready: true,
      artifacts: {
        cover: { ready: true },
      },
    }),
    [],
  );

  assert.deepEqual(
    recentJobRawImageUrls({
      job_id: "job-cover",
      thumbnail_url: "https://example.test/api/v1/library/books/job-cover/thumbnail",
      cover_url: "https://example.test/api/v1/library/books/job-cover/cover",
    }).slice(0, 2),
    [
      "https://example.test/api/v1/library/books/job-cover/thumbnail",
      "https://example.test/api/v1/library/books/job-cover/cover",
    ],
  );
});

test("job image API boundary builds and normalizes recent job cover candidates", () => {
  assert.deepEqual(
    buildJobImageCandidateUrls({
      job_id: "job api",
      thumbnail_url: "/custom/thumb.jpg",
      cover_url: "/custom/cover.jpg",
    }),
    [
      "/custom/thumb.jpg",
      "/custom/cover.jpg",
    ],
  );
  assert.deepEqual(
    buildJobImageCandidateUrls({
      job_id: "job api",
      thumbnail_ready: true,
      cover_ready: true,
    }),
    [],
  );
  assert.equal(normalizeJobImageUrl("/api/v1/jobs/job-cover/cover"), "/api/v1/jobs/job-cover/cover");
});

test("recent job image cache can be invalidated for runtime card updates", async () => {
  const previousFetch = global.fetch;
  const previousUrl = global.URL;
  let fetchCount = 0;
  global.fetch = async () => {
    fetchCount += 1;
    return {
      ok: true,
      async blob() {
        return { fetchCount };
      },
    };
  };
  global.URL = {
    createObjectURL(blob) {
      return `blob:${blob.fetchCount}`;
    },
  };

  try {
    assert.equal(await loadRecentJobImage("/api/v1/jobs/job-cache/cover"), "blob:1");
    assert.equal(await loadRecentJobImage("/api/v1/jobs/job-cache/cover"), "blob:1");
    assert.equal(fetchCount, 1);

    clearRecentJobImageCache("/api/v1/jobs/job-cache/cover");
    assert.equal(await loadRecentJobImage("/api/v1/jobs/job-cache/cover"), "blob:2");
    assert.equal(fetchCount, 2);
  } finally {
    clearRecentJobImageCache("/api/v1/jobs/job-cache/cover");
    global.fetch = previousFetch;
    global.URL = previousUrl;
  }
});

test("recent job image cache keys include optional item version", async () => {
  const previousFetch = global.fetch;
  const previousUrl = global.URL;
  let fetchCount = 0;
  global.fetch = async () => {
    fetchCount += 1;
    return {
      ok: true,
      async blob() {
        return { fetchCount };
      },
    };
  };
  global.URL = {
    createObjectURL(blob) {
      return `blob:${blob.fetchCount}`;
    },
  };

  try {
    const rawUrl = "/api/v1/jobs/job-cache-version/cover";
    assert.equal(await loadRecentJobImage(rawUrl, { cacheVersion: "running|10" }), "blob:1");
    assert.equal(await loadRecentJobImage(rawUrl, { cacheVersion: "running|10" }), "blob:1");
    assert.equal(await loadRecentJobImage(rawUrl, { cacheVersion: "succeeded|100" }), "blob:2");
    assert.equal(fetchCount, 2);
  } finally {
    clearRecentJobImageCache("/api/v1/jobs/job-cache-version/cover");
    global.fetch = previousFetch;
    global.URL = previousUrl;
  }
});

test("recent job image refresh collects previous and next cover candidates", () => {
  const urls = recentJobImageRefreshUrls(
    {
      job_id: "job-image-refresh",
      cover_url: "/api/v1/jobs/job-image-refresh/old-cover",
      thumbnail_url: "/api/v1/jobs/job-image-refresh/old-thumbnail",
    },
    {
      job_id: "job-image-refresh",
      cover_url: "/api/v1/jobs/job-image-refresh/new-cover",
      thumbnail_url: "/api/v1/jobs/job-image-refresh/new-thumbnail",
    },
  );

  assert.ok(urls.includes("/api/v1/jobs/job-image-refresh/old-cover"));
  assert.ok(urls.includes("/api/v1/jobs/job-image-refresh/old-thumbnail"));
  assert.ok(urls.includes("/api/v1/jobs/job-image-refresh/new-cover"));
  assert.ok(urls.includes("/api/v1/jobs/job-image-refresh/new-thumbnail"));
});
