import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";

import { stopChildGracefully } from "./graceful-stop.js";

const quietLogger = { warn() {} };

test("child that handles SIGTERM exits gracefully", { skip: process.platform === "win32" }, async () => {
  const child = spawn(process.execPath, [
    "-e",
    "process.on('SIGTERM', () => process.exit(0)); console.log('ready'); setInterval(() => {}, 1000);",
  ], { stdio: ["ignore", "pipe", "ignore"] });
  await new Promise((resolve) => child.stdout.once("data", resolve));
  const outcome = await stopChildGracefully(child, { graceMs: 5000, logger: quietLogger });
  assert.equal(outcome, "exited");
  assert.equal(child.exitCode, 0);
});

test("child that ignores SIGTERM is SIGKILLed after the grace period", { skip: process.platform === "win32" }, async () => {
  const child = spawn(process.execPath, [
    "-e",
    "process.on('SIGTERM', () => {}); console.log('ready'); setInterval(() => {}, 1000);",
  ], { stdio: ["ignore", "pipe", "ignore"] });
  await new Promise((resolve) => child.stdout.once("data", resolve));
  const outcome = await stopChildGracefully(child, { graceMs: 200, logger: quietLogger });
  assert.equal(outcome, "killed");
  assert.equal(child.signalCode, "SIGKILL");
});

test("already exited child resolves immediately", { skip: process.platform === "win32" }, async () => {
  const child = spawn(process.execPath, ["-e", ""], { stdio: "ignore" });
  await new Promise((resolve) => child.once("exit", resolve));
  assert.equal(await stopChildGracefully(child, { logger: quietLogger }), "gone");
  assert.equal(await stopChildGracefully(null, { logger: quietLogger }), "gone");
});
