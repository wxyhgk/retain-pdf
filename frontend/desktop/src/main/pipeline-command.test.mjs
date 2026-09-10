import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { resolvePipelineCommand } = require("./python-runtime.js");

function makeFile(root, relativePath) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, "fixture", "utf8");
  return target;
}

function withTempBackend(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "retainpdf-pipeline-command-"));
  try {
    run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("win32 prefers backend/bin wrapper over python/Scripts fallback", () => {
  withTempBackend((root) => {
    const primary = makeFile(root, "bin/retainpdf-pipeline.exe");
    const fallback = makeFile(root, "python/Scripts/retainpdf-pipeline.exe");
    assert.equal(resolvePipelineCommand(root, { platform: "win32" }), primary);
    assert.ok(fallback);
  });
});

test("win32 falls back to python/Scripts when bin wrapper is missing", () => {
  withTempBackend((root) => {
    const fallback = makeFile(root, "python/Scripts/retainpdf-pipeline.exe");
    assert.equal(resolvePipelineCommand(root, { platform: "win32" }), fallback);
  });
});

test("linux prefers backend/bin wrapper over python/bin fallback", () => {
  withTempBackend((root) => {
    const primary = makeFile(root, "bin/retainpdf-pipeline");
    const fallback = makeFile(root, "python/bin/retainpdf-pipeline");
    assert.equal(resolvePipelineCommand(root, { platform: "linux" }), primary);
    assert.ok(fallback);
  });
});

test("linux falls back to python/bin when bin wrapper is missing", () => {
  withTempBackend((root) => {
    const fallback = makeFile(root, "python/bin/retainpdf-pipeline");
    assert.equal(resolvePipelineCommand(root, { platform: "linux" }), fallback);
  });
});

test("darwin follows posix layout with bin priority and python/bin fallback", () => {
  withTempBackend((root) => {
    const primary = makeFile(root, "bin/retainpdf-pipeline");
    makeFile(root, "python/bin/retainpdf-pipeline");
    assert.equal(resolvePipelineCommand(root, { platform: "darwin" }), primary);
  });
  withTempBackend((root) => {
    const fallback = makeFile(root, "python/bin/retainpdf-pipeline");
    assert.equal(resolvePipelineCommand(root, { platform: "darwin" }), fallback);
  });
});

test("returns null when no wrapper exists", () => {
  withTempBackend((root) => {
    assert.equal(resolvePipelineCommand(root, { platform: "linux" }), null);
    assert.equal(resolvePipelineCommand(root, { platform: "darwin" }), null);
    assert.equal(resolvePipelineCommand(root, { platform: "win32" }), null);
  });
});

test("returns null for missing backend root", () => {
  assert.equal(resolvePipelineCommand("", { platform: "linux" }), null);
  assert.equal(resolvePipelineCommand(null, { platform: "linux" }), null);
});
