import assert from "node:assert/strict";
import test from "node:test";

import { createPortAllocator } from "./port-allocator.js";

function makeAllocator({ busy = new Set(), residuals = new Map(), describe = () => "" } = {}) {
  return createPortAllocator({
    canConnectToPort: async (_host, port) => busy.has(port),
    reclaimPortIfOwnResidual: async (_host, port) => {
      if (!busy.has(port)) {
        return { status: "free", occupant: null };
      }
      const occupant = residuals.get(port) || null;
      if (occupant) {
        busy.delete(port);
        return { status: "reclaimed", occupant };
      }
      return { status: "busy", occupant: { pid: "999", image: "" } };
    },
    describeOccupant: describe,
    logger: { warn() {}, error() {} },
  });
}

test("free ports resolve to defaults", async () => {
  const allocator = makeAllocator();
  const result = await allocator.allocateBackendPorts("127.0.0.1", {
    apiPort: 41000,
    simplePort: 42000,
    jobsPort: 41002,
    aiServicePort: 41100,
  });
  assert.deepEqual(result.ports, {
    apiPort: 41000,
    simplePort: 42000,
    jobsPort: 41002,
    aiServicePort: 41100,
  });
  assert.deepEqual(result.relocations, []);
});

test("foreign occupant on api port falls back to next free", async () => {
  const allocator = makeAllocator({ busy: new Set([41000]) });
  const result = await allocator.allocateBackendPorts("127.0.0.1", {
    apiPort: 41000,
    simplePort: 42000,
    jobsPort: 41002,
    aiServicePort: 41100,
  });
  assert.equal(result.ports.apiPort, 41001);
  assert.equal(result.ports.simplePort, 42000);
  assert.deepEqual(result.relocations, [{ role: "API", from: 41000, to: 41001 }]);
});

test("own residual is reclaimed, defaults kept", async () => {
  const allocator = makeAllocator({
    busy: new Set([41000, 41002]),
    residuals: new Map([
      [41000, { pid: "11", image: "rust_api.exe" }],
      [41002, { pid: "22", image: "retain-jobsd.exe" }],
    ]),
  });
  const result = await allocator.allocateBackendPorts("127.0.0.1", {
    apiPort: 41000,
    simplePort: 42000,
    jobsPort: 41002,
    aiServicePort: 41100,
  });
  assert.equal(result.ports.apiPort, 41000);
  assert.equal(result.ports.jobsPort, 41002);
  assert.deepEqual(result.relocations, []);
});

test("exhausted range throws with occupant detail", async () => {
  const busy = new Set([5000, 5001, 5002]);
  const allocator = createPortAllocator({
    canConnectToPort: async (_host, port) => busy.has(port),
    reclaimPortIfOwnResidual: async () => ({ status: "busy", occupant: { pid: "7", image: "" } }),
    describeOccupant: (port, occupant) => `pid=${occupant?.pid}@${port}`,
    maxOffset: 2,
    logger: { warn() {}, error() {} },
  });
  await assert.rejects(
    allocator.allocateRole("127.0.0.1", { key: "apiPort", label: "API", defaultPort: 5000 }, 5000),
    /5000[\s\S]*pid=7@5000/,
  );
});

test("exclude set skips ports", async () => {
  const allocator = createPortAllocator({
    canConnectToPort: async () => false,
    reclaimPortIfOwnResidual: async () => ({ status: "free", occupant: null }),
    describeOccupant: () => "",
    exclude: new Set([41000, 41001]),
    logger: { warn() {}, error() {} },
  });
  const result = await allocator.allocateBackendPorts("127.0.0.1", {
    apiPort: 41000,
    simplePort: 42000,
    jobsPort: 41002,
    aiServicePort: 41100,
  });
  assert.equal(result.ports.apiPort, 41002);
});
