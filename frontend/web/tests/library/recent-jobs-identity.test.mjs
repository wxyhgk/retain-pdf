import test from "node:test";
import assert from "node:assert/strict";

import {
  dedupeLibraryCards,
  libraryCardIdentity,
  sameLibraryCard,
} from "../../src/features/library/domain/recent-jobs/library-card-identity.ts";
import {
  collectRecentJobsPage,
} from "../../src/features/library/domain/recent-jobs/pagination.ts";
import {
  createRecentJobsRuntimePatches,
} from "../../src/features/library/domain/recent-jobs/runtime-patches.ts";
import {
  createRecentJobsStatePort,
} from "../../src/features/library/domain/recent-jobs/state.ts";

test("library card identity prefers document_id and falls back to job_id", () => {
  assert.equal(
    libraryCardIdentity({ document_id: "doc-1", job_id: "job-new" }),
    "document:doc-1",
  );
  assert.equal(libraryCardIdentity({ job_id: "job-only" }), "job:job-only");
  assert.equal(libraryCardIdentity({}), "");
});

test("library card identity recognizes retry lineage before document_id is hydrated", () => {
  const previous = {
    document_id: "doc-1",
    job_id: "job-old",
    active_job_id: "job-old",
  };
  const retry = {
    job_id: "job-retry",
    source_job_id: "job-old",
  };

  assert.equal(sameLibraryCard(previous, retry), true);
  assert.deepEqual(
    dedupeLibraryCards([previous, { ...previous, job_id: "job-retry" }]),
    [previous],
  );
});

test("recent jobs state replace and prepend upsert by stable card identity", () => {
  const statePort = createRecentJobsStatePort({
    recentJobsItems: [
      { document_id: "doc-1", job_id: "job-old", title: "Book" },
      { document_id: "doc-2", job_id: "job-2", title: "Other" },
    ],
  });

  statePort.replaceItem({
    document_id: "doc-1",
    job_id: "job-retry",
    title: "Book",
    status: "running",
  });
  statePort.prependItem({
    document_id: "doc-2",
    job_id: "job-2-new",
    title: "Other",
    status: "running",
  });

  assert.deepEqual(
    statePort.getSnapshot().items.map(({ document_id, job_id }) => ({ document_id, job_id })),
    [
      { document_id: "doc-1", job_id: "job-retry" },
      { document_id: "doc-2", job_id: "job-2-new" },
    ],
  );
});

test("recent jobs pagination dedupes different job ids for the same document", async () => {
  const result = await collectRecentJobsPage({
    fetchLibraryBookList: async () => ({
      items: [
        { document_id: "doc-1", job_id: "job-new", workflow: "book" },
        { document_id: "doc-1", job_id: "job-old", workflow: "book" },
        { document_id: "doc-2", job_id: "job-2", workflow: "book" },
      ],
      has_more: false,
    }),
    apiPrefix: "/api/v1",
    startOffset: 0,
    pageSize: 2,
    existingJobIds: new Set(),
  });

  assert.deepEqual(result.collected.map((item) => item.job_id), ["job-new", "job-2"]);
});

test("retry job id replacement stays on replaceItem store path", () => {
  const statePort = createRecentJobsStatePort({
    recentJobsItems: [{
      document_id: "doc-1",
      job_id: "job-old",
      title: "Book",
      status: "succeeded",
      display_stage: "done",
    }],
  });
  const actions = [];
  statePort.subscribe((_snapshot, meta) => actions.push(meta.action));
  const runtimePatches = createRecentJobsRuntimePatches({
    statePort,
    replaceRecentJobCard: () => true,
    renderCurrentRecentJobs() {},
    storeDrivenRendering: true,
  });

  runtimePatches.update({
    job_id: "job-retry",
    source_job_id: "job-old",
    status: "running",
    display_stage: "ocr",
  });

  const [item] = statePort.getSnapshot().items;
  assert.equal(item.document_id, "doc-1");
  assert.equal(item.job_id, "job-retry");
  assert.equal(item.status, "running");
  assert.deepEqual(actions, ["replaceItem"]);
});
