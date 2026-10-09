import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const require = createRequire(import.meta.url);
const { createCliInstaller } = require("./cli-install.js");

function sandbox(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "retainpdf-cli-install-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const source = path.join(root, "app", "retainpdf");
  fs.mkdirSync(path.dirname(source), { recursive: true });
  fs.writeFileSync(source, "#!/bin/sh\n");
  const system = path.join(root, "usr-local-bin");
  const user = path.join(root, "home", ".local", "bin");
  return { root, source, system, user };
}

test("installs into the user's bin when the system one is not writable, and says how to reach it", { skip: process.platform === "win32" }, (t) => {
  const { source, system, user } = sandbox(t);
  const installer = createCliInstaller({ resolveSource: () => source, targets: [system, user], onPath: () => false });
  assert.equal(installer.status().installedAt, "");
  const result = installer.install();
  assert.equal(result.ok, true);
  assert.equal(result.path, path.join(user, "retainpdf"));
  assert.equal(fs.readlinkSync(result.path), source);
  assert.match(result.hint, /export PATH=/);
  assert.equal(installer.status().installedAt, result.path);
  // 再装一次:替换自己的链接。
  assert.equal(installer.install().ok, true);
});

test("prefers the system bin when writable and never overwrites a real file", { skip: process.platform === "win32" }, (t) => {
  const { source, system, user } = sandbox(t);
  fs.mkdirSync(system, { recursive: true });
  fs.writeFileSync(path.join(system, "retainpdf"), "someone else's program");
  const installer = createCliInstaller({ resolveSource: () => source, targets: [system, user], onPath: () => true });
  const result = installer.install();
  assert.equal(result.ok, false);
  assert.match(result.error, /同名文件/);
  assert.equal(fs.readFileSync(path.join(system, "retainpdf"), "utf8"), "someone else's program");
  fs.rmSync(path.join(system, "retainpdf"));
  const again = installer.install();
  assert.equal(again.path, path.join(system, "retainpdf"));
  assert.equal(again.hint, "");
});

test("windows and missing binaries are reported, not attempted", () => {
  assert.equal(createCliInstaller({ resolveSource: () => "x", platform: "win32" }).install().ok, false);
  assert.match(createCliInstaller({ resolveSource: () => "" }).install().error, /没有命令行工具/);
});
