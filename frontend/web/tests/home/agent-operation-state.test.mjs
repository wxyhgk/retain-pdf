import test from "node:test";
import assert from "node:assert/strict";

const {
  agentOperationReducer,
  INITIAL_AGENT_OPERATION_STATE,
} = await import("../../src/features/ask/domain/operations/operation-reducer.js");
const {
  hasActiveOperations,
  operationNeedsPolling,
  operationsByRequestMessage,
} = await import("../../src/features/ask/domain/operations/operation-selectors.js");
const {
  actionsForStatus,
} = await import("../../src/features/ask/ui/operations/AgentOperationActions.js");
const {
  createAgentOperationController,
  operationStatusLabel,
} = await import("../../src/features/ask/domain/operations/operation-controller.js");

function operation(overrides = {}) {
  return {
    operation_id: "op-1",
    conversation_id: "conv-1",
    request_message_id: "user-1",
    document_id: "doc-1",
    intent_summary: "删除第 2 页",
    status: "draft",
    current_attempt: 1,
    latest_event_seq: 1,
    updated_at: "2026-08-29T00:00:00Z",
    ...overrides,
  };
}

test("agent operation reducer hydrates by conversation and request message", () => {
  const state = agentOperationReducer(INITIAL_AGENT_OPERATION_STATE, {
    type: "hydrate",
    conversationId: "conv-1",
    operations: [operation()],
  });
  assert.deepEqual(state.idsByConversation["conv-1"], ["op-1"]);
  assert.deepEqual(state.idsByRequestMessage["user-1"], ["op-1"]);
  assert.equal(state.recoveryByConversation["conv-1"], "ready");
  assert.equal(operationsByRequestMessage(state, "conv-1")["user-1"][0].remote.status, "draft");
});

test("agent operation reducer rejects stale attempt and event snapshots", () => {
  let state = agentOperationReducer(INITIAL_AGENT_OPERATION_STATE, {
    type: "upsert",
    operation: operation({ current_attempt: 2, latest_event_seq: 8, status: "running" }),
  });
  state = agentOperationReducer(state, {
    type: "upsert",
    operation: operation({ current_attempt: 1, latest_event_seq: 99, status: "failed" }),
  });
  state = agentOperationReducer(state, {
    type: "upsert",
    operation: operation({ current_attempt: 2, latest_event_seq: 7, status: "failed" }),
  });
  assert.equal(state.byId["op-1"].remote.status, "running");
  assert.equal(state.byId["op-1"].remote.current_attempt, 2);
});

test("agent operation action matrix does not expose unsupported rollback", () => {
  assert.deepEqual(actionsForStatus("draft").map((item) => item.action), ["cancel", "run"]);
  assert.deepEqual(actionsForStatus("result_ready").map((item) => item.action), ["cancel", "commit"]);
  assert.deepEqual(actionsForStatus("committed"), []);
  assert.equal(actionsForStatus("ambiguous")[0].needsRiskConfirmation, true);
});

test("committed status distinguishes explicit and green-light application", () => {
  assert.equal(operationStatusLabel("committed"), "已应用");
  assert.equal(operationStatusLabel("committed", "green_light"), "AI 已直接应用");
  assert.equal(operationStatusLabel("draft", "green_light"), "等待自动执行");
  assert.equal(operationStatusLabel("result_ready", "green_light"), "等待自动应用");
});

test("green-light operations keep polling across automatic run and commit boundaries", () => {
  let state = agentOperationReducer(INITIAL_AGENT_OPERATION_STATE, {
    type: "upsert",
    operation: operation({ status: "draft" }),
  });
  assert.equal(hasActiveOperations(state, "conv-1", "explicit"), false);
  assert.equal(hasActiveOperations(state, "conv-1", "green_light"), true);
  assert.equal(operationNeedsPolling("result_ready", "explicit"), false);
  assert.equal(operationNeedsPolling("result_ready", "green_light"), true);
  assert.equal(actionsForStatus("draft", "green_light")[1].label, "立即执行");
  assert.equal(actionsForStatus("result_ready", "green_light")[1].label, "立即应用");
});

test("agent operation controller reuses idempotency key after a lost response", async () => {
  const payloads = [];
  let attempts = 0;
  const dispatched = [];
  const api = {
    list: async () => ({ operations: [] }),
    get: async () => operation(),
    run: async (_id, payload) => {
      payloads.push(payload);
      attempts += 1;
      if (attempts === 1) throw new Error("network lost");
      return operation({ status: "queued", latest_event_seq: 2 });
    },
    cancel: async () => operation({ status: "cancelled" }),
    commit: async () => operation({ status: "committed" }),
    retry: async () => operation({ status: "queued" }),
  };
  const controller = createAgentOperationController(api, (action) => dispatched.push(action));
  await controller.perform("run", operation());
  await controller.perform("run", operation());
  assert.equal(payloads.length, 2);
  assert.equal(payloads[0].idempotency_key, payloads[1].idempotency_key);
  assert.equal(dispatched.some((action) => action.type === "action-error"), true);
  assert.equal(dispatched.at(-1).type, "action-finish");
});

test("agent operation controller keeps a lost action key across controller recreation", async () => {
  const stored = new Map();
  const storage = {
    getItem: (key) => stored.get(key) || null,
    setItem: (key, value) => stored.set(key, value),
    removeItem: (key) => stored.delete(key),
  };
  const payloads = [];
  const api = {
    list: async () => ({ operations: [] }),
    get: async () => operation(),
    run: async (_id, payload) => {
      payloads.push(payload);
      throw new Error("network lost");
    },
    cancel: async () => operation({ status: "cancelled" }),
    commit: async () => operation({ status: "committed" }),
    retry: async () => operation({ status: "queued" }),
  };
  await createAgentOperationController(api, () => {}, storage).perform("run", operation());
  await createAgentOperationController(api, () => {}, storage).perform("run", operation());
  assert.equal(payloads[0].idempotency_key, payloads[1].idempotency_key);
});

test("agent operation controller refreshes authoritative state after 409 without replaying", async () => {
  const dispatched = [];
  let runCalls = 0;
  let getCalls = 0;
  const conflict = Object.assign(new Error("stale operation(409)"), { status: 409 });
  const api = {
    list: async () => ({ operations: [] }),
    get: async () => {
      getCalls += 1;
      return operation({ status: "running", latest_event_seq: 4 });
    },
    run: async () => {
      runCalls += 1;
      throw conflict;
    },
    cancel: async () => operation({ status: "cancelled" }),
    commit: async () => operation({ status: "committed" }),
    retry: async () => operation({ status: "queued" }),
  };

  await createAgentOperationController(api, (action) => dispatched.push(action)).perform("run", operation());

  assert.equal(runCalls, 1);
  assert.equal(getCalls, 1);
  assert.equal(dispatched.at(-1).type, "action-finish");
  assert.equal(dispatched.at(-1).operation.status, "running");
  assert.equal(dispatched.some((action) => action.type === "action-error"), false);
});

test("ambiguous retry requires explicit duplicate-risk acceptance", async () => {
  const payloads = [];
  const dispatched = [];
  const api = {
    list: async () => ({ operations: [] }),
    get: async () => operation(),
    run: async () => operation({ status: "queued" }),
    cancel: async () => operation({ status: "cancelled" }),
    commit: async () => operation({ status: "committed" }),
    retry: async (_id, payload) => {
      payloads.push(payload);
      return operation({ status: "queued", current_attempt: 2 });
    },
  };
  const controller = createAgentOperationController(api, (action) => dispatched.push(action));
  const ambiguous = operation({ status: "ambiguous" });

  await controller.perform("retry", ambiguous);
  assert.equal(payloads.length, 0);
  assert.equal(dispatched.at(-1).type, "action-error");

  await controller.perform("retry", ambiguous, { acceptDuplicateRisk: true });
  assert.equal(payloads.length, 1);
  assert.equal(payloads[0].accept_duplicate_risk, true);
});

test("ordinary failed retry does not imply duplicate-risk acceptance", async () => {
  let retryPayload;
  const api = {
    list: async () => ({ operations: [] }),
    get: async () => operation(),
    run: async () => operation({ status: "queued" }),
    cancel: async () => operation({ status: "cancelled" }),
    commit: async () => operation({ status: "committed" }),
    retry: async (_id, payload) => {
      retryPayload = payload;
      return operation({ status: "queued", current_attempt: 2 });
    },
  };

  await createAgentOperationController(api, () => {}).perform("retry", operation({ status: "failed" }));
  assert.equal(Object.hasOwn(retryPayload, "accept_duplicate_risk"), false);
});
