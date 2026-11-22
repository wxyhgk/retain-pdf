import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createAppUpdater, UPDATE_STATUS_CHANNEL, notesText } = require("./app-updater.js");

function fakeUpdater() {
  const updater = new EventEmitter();
  updater.checks = 0;
  updater.installs = [];
  updater.checkForUpdates = async () => {
    updater.checks += 1;
    updater.emit("checking-for-update");
  };
  updater.quitAndInstall = (...args) => updater.installs.push(args);
  return updater;
}

function fakeTimers() {
  const timeouts = [];
  const intervals = [];
  return {
    timeouts,
    intervals,
    setTimeout: (fn, ms) => { timeouts.push({ fn, ms }); return timeouts.length; },
    clearTimeout: () => {},
    setInterval: (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; },
    clearInterval: () => {},
  };
}

function setup(overrides = {}) {
  const updater = fakeUpdater();
  const sent = [];
  const timers = fakeTimers();
  let loads = 0;
  const appUpdater = createAppUpdater({
    platform: "darwin",
    isPackaged: true,
    currentVersion: "2026.11.22",
    loadAutoUpdater: () => { loads += 1; return updater; },
    send: (channel, payload) => sent.push([channel, { ...payload }]),
    timers,
    ...overrides,
  });
  return { appUpdater, updater, sent, timers, loads: () => loads };
}

test("only packaged Windows / Mac builds auto-update; Linux and dev never load electron-updater", async () => {
  for (const [platform, isPackaged] of [["linux", true], ["darwin", false], ["win32", false]]) {
    const { appUpdater, timers, loads } = setup({ platform, isPackaged });
    appUpdater.start();
    assert.equal(appUpdater.status().supported, false, `${platform} packaged=${isPackaged}`);
    assert.deepEqual(await appUpdater.check(), appUpdater.status());
    assert.equal(appUpdater.install().ok, false);
    assert.equal(timers.timeouts.length + timers.intervals.length, 0);
    assert.equal(loads(), 0);
  }
  for (const platform of ["darwin", "win32"]) {
    assert.equal(setup({ platform }).appUpdater.status().supported, true, platform);
  }
});

test("start schedules a delayed first check and a periodic one", async () => {
  const { appUpdater, updater, timers } = setup({ checkDelayMs: 1000, checkIntervalMs: 5000 });
  appUpdater.start();
  appUpdater.start();
  assert.equal(timers.timeouts.length, 1, "start is idempotent");
  assert.equal(timers.timeouts[0].ms, 1000);
  assert.equal(timers.intervals[0].ms, 5000);
  await timers.timeouts[0].fn();
  assert.equal(updater.checks, 1);
  assert.equal(updater.autoDownload, true);
  assert.equal(updater.autoInstallOnAppQuit, true);
});

test("status follows electron-updater events and is pushed to the renderer; install only after download", async () => {
  const { appUpdater, updater, sent } = setup();
  await appUpdater.check();
  assert.equal(appUpdater.status().state, "checking");
  assert.equal(appUpdater.install().ok, false, "nothing downloaded yet");

  updater.emit("update-available", { version: "2026.11.23", releaseNotes: "<p>fix</p>" });
  assert.equal(appUpdater.status().state, "downloading");
  updater.emit("download-progress", { percent: 42.6 });
  assert.equal(appUpdater.status().percent, 43);
  // 下载中再点检查：不重复检查
  await appUpdater.check();
  assert.equal(updater.checks, 1);

  updater.emit("update-downloaded", { version: "2026.11.23" });
  const status = appUpdater.status();
  assert.equal(status.state, "downloaded");
  assert.equal(status.version, "2026.11.23");
  assert.equal(status.notes, "<p>fix</p>");
  assert.equal(status.currentVersion, "2026.11.22");
  assert.ok(sent.every(([channel]) => channel === UPDATE_STATUS_CHANNEL));
  assert.deepEqual(sent.map(([, payload]) => payload.state), ["checking", "checking", "downloading", "downloading", "downloaded"]);

  assert.equal(appUpdater.install().ok, true);
  assert.deepEqual(updater.installs, [[false, true]]);
});

test("not-available and errors are reported, and a failed check can be retried", async () => {
  const { appUpdater, updater } = setup();
  await appUpdater.check();
  updater.emit("update-not-available", { version: "2026.11.22" });
  assert.equal(appUpdater.status().state, "latest");
  updater.emit("error", new Error("net::ERR_INTERNET_DISCONNECTED"));
  assert.equal(appUpdater.status().state, "error");
  assert.match(appUpdater.status().error, /ERR_INTERNET_DISCONNECTED/);

  updater.checkForUpdates = async () => { throw new Error("rate limited"); };
  await appUpdater.check();
  assert.equal(appUpdater.status().state, "error");
  assert.match(appUpdater.status().error, /rate limited/);
});

test("release notes from GitHub come as a string or a list of versions", () => {
  assert.equal(notesText("plain"), "plain");
  assert.equal(notesText([{ version: "a", note: "one" }, { version: "b", note: " two " }]), "one\n\ntwo");
  assert.equal(notesText(null), "");
});
