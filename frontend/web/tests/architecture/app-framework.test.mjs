import test from "node:test";
import assert from "node:assert/strict";

import {
  createCommandBus,
} from "../../src/platform/store/commands.js";
import {
  createResource,
} from "../../src/platform/store/resource.js";
import {
  createStore,
} from "../../src/platform/store/store.js";

test("createStore owns immutable snapshots and action updates", () => {
  const store = createStore({
    name: "library",
    initialState: {
      items: [],
      selectedId: "",
    },
    actions: {
      addBook(state, book) {
        state.items.push(book);
        return state;
      },
      selectBook(state, jobId) {
        return {
          ...state,
          selectedId: jobId,
        };
      },
    },
  });

  const events = [];
  const unsubscribe = store.subscribe((snapshot, meta) => {
    events.push({ snapshot, meta });
  });

  store.actions.addBook({ jobId: "job-1" });
  store.actions.selectBook("job-1");
  unsubscribe();
  store.actions.addBook({ jobId: "job-2" });

  assert.deepEqual(store.getSnapshot(), {
    items: [{ jobId: "job-1" }, { jobId: "job-2" }],
    selectedId: "job-1",
  });
  assert.equal(events.length, 2);
  assert.equal(events[0].meta.action, "addBook");
  assert.equal(events[0].meta.store, "library");
  assert.throws(() => {
    events[0].snapshot.items = [];
  }, TypeError);
});

test("createStore batches multiple updates into one subscriber notification", () => {
  const store = createStore({
    name: "status",
    initialState: {
      stage: "ocr",
      percent: 0,
    },
    actions: {
      setStage(state, stage) {
        return {
          ...state,
          stage,
        };
      },
      setPercent(state, percent) {
        return {
          ...state,
          percent,
        };
      },
    },
  });
  const events = [];
  store.subscribe((snapshot, meta) => {
    events.push({ snapshot, meta });
  });

  const result = store.batch(({ actions }) => {
    actions.setStage("translation");
    actions.setPercent(75);
    return "done";
  });

  assert.equal(result, "done");
  assert.deepEqual(store.getSnapshot(), {
    stage: "translation",
    percent: 75,
  });
  assert.equal(events.length, 1);
  assert.equal(events[0].meta.action, "setStage");
  assert.deepEqual(events[0].meta.previousState, {
    stage: "ocr",
    percent: 0,
  });
});

test("createCommandBus dispatches commands and can isolate handler errors", async () => {
  const errors = [];
  const commands = createCommandBus({
    onError: (error, meta) => errors.push({ error, meta }),
  });
  const calls = [];
  commands.on("reader:open", async (payload, meta) => {
    calls.push({ payload, meta });
    return payload.jobId;
  });
  commands.on("reader:open", () => {
    throw new Error("boom");
  });

  const results = await commands.dispatch("reader:open", { jobId: "job-1" });

  assert.deepEqual(results, ["job-1"]);
  assert.equal(calls[0].meta.command, "reader:open");
  assert.equal(errors.length, 1);
  assert.equal(errors[0].meta.command, "reader:open");
});

test("createResource owns loading success error and stale request guards", async () => {
  let releaseFirst;
  const firstLoad = new Promise((resolve) => {
    releaseFirst = () => resolve({ value: "first" });
  });
  const loads = [];
  const resource = createResource({
    name: "jobDetail",
    loader: async ({ jobId }) => {
      loads.push(jobId);
      if (jobId === "slow") {
        return firstLoad;
      }
      return { value: jobId };
    },
    cacheKey: ({ jobId }) => jobId,
  });

  const slowPromise = resource.load({ jobId: "slow" });
  const fastSnapshot = await resource.load({ jobId: "fast" });
  releaseFirst();
  await slowPromise;

  assert.equal(fastSnapshot.status, "success");
  assert.deepEqual(resource.getSnapshot().data, { value: "fast" });

  await resource.load({ jobId: "fast" });
  assert.deepEqual(loads, ["slow", "fast"]);

  resource.invalidate({ jobId: "fast" });
  await resource.load({ jobId: "fast" });
  assert.deepEqual(loads, ["slow", "fast", "fast"]);
});

test("createResource records loader errors without throwing by default", async () => {
  const resource = createResource({
    name: "failing",
    loader: async () => {
      throw new Error("network failed");
    },
  });

  const snapshot = await resource.load();

  assert.equal(snapshot.status, "error");
  assert.equal(snapshot.error.message, "network failed");
});
