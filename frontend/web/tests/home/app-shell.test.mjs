import test from "node:test";
import assert from "node:assert/strict";

import {
  createAppShellConfigPort,
  initializeIdleAppView,
} from "../../src/app/home/composition/idle-view.js";
import {
  buildJobWarningViewModel,
  buildWorkflowSectionsViewModel,
} from "@retainpdf/domain/job";

function createIdleHarness(overrides = {}) {
  const calls = [];
  return {
    calls,
    options: {
      configPort: createAppShellConfigPort({ isMock: () => false }),
      jobPresentationPort: {
        normalizeJobPayload: (payload) => ({ ...payload, status: "idle-normalized" }),
        summarizeStatus: (status) => `summary:${status}`,
      },
      setText: (id, value) => calls.push(["setText", id, value]),
      setWorkflowSections: (value) => calls.push(["setWorkflowSections", value]),
      setLinearProgress: (...args) => calls.push(["setLinearProgress", ...args]),
      updateActionButtons: (payload) => calls.push(["updateActionButtons", payload.status]),
      renderPageRangeSummary: () => calls.push(["renderPageRangeSummary"]),
      resetUploadProgress: () => calls.push(["resetUploadProgress"]),
      resetUploadedFile: () => calls.push(["resetUploadedFile"]),
      applyWorkflowMode: () => calls.push(["applyWorkflowMode"]),
      updateJobWarning: (status) => calls.push(["updateJobWarning", status]),
      resetEventsList: () => calls.push(["resetEventsList"]),
      activateDetailTab: (name) => calls.push(["activateDetailTab", name]),
      ...overrides,
    },
  };
}

test("initializeIdleAppView reads mock mode through app shell config port", () => {
  const { calls, options } = createIdleHarness({
    configPort: createAppShellConfigPort({ isMock: () => true }),
  });

  initializeIdleAppView(options);

  assert.ok(calls.some((call) => (
    call[0] === "setText"
    && call[1] === "error-box"
    && call[2] === "-"
  )));
});

test("initializeIdleAppView reads job presentation through app shell job port", () => {
  const { calls, options } = createIdleHarness();

  initializeIdleAppView(options);

  assert.deepEqual(
    calls.find((call) => call[0] === "updateActionButtons"),
    ["updateActionButtons", "idle-normalized"],
  );
  assert.deepEqual(
    calls.find((call) => call[0] === "setText" && call[1] === "job-summary"),
    ["setText", "job-summary", "summary:idle"],
  );
});

test("workflow visibility view model owns job section state", () => {
  assert.deepEqual(buildWorkflowSectionsViewModel(null), {
    hasJob: false,
    processing: false,
  });
  assert.deepEqual(buildWorkflowSectionsViewModel({
    job_id: "job-running",
    status: "running",
  }), {
    hasJob: true,
    processing: true,
  });
  assert.deepEqual(buildWorkflowSectionsViewModel({
    job_id: "job-ambiguous-succeeded",
    status: "succeeded",
  }), {
    hasJob: true,
    processing: true,
  });
  assert.deepEqual(buildWorkflowSectionsViewModel({
    job_id: "job-done",
    status: "succeeded",
    display_stage: "done",
  }), {
    hasJob: true,
    processing: false,
  });
});

test("job warning view model owns active statuses", () => {
  assert.deepEqual(buildJobWarningViewModel("queued"), { active: true });
  assert.deepEqual(buildJobWarningViewModel("running"), { active: true });
  assert.deepEqual(buildJobWarningViewModel("succeeded"), { active: false });
  assert.deepEqual(buildJobWarningViewModel("idle"), { active: false });
});

test("initializeIdleAppView does not reset mock-only error text in normal mode", () => {
  const { calls, options } = createIdleHarness();

  initializeIdleAppView(options);

  assert.equal(calls.some((call) => (
    call[0] === "setText"
    && call[1] === "error-box"
  )), false);
});
