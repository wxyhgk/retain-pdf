import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { isNewerVersion } from "../src/js/features/app-update/github-release.js";
import {
  readUpdateCache,
  writeUpdateCache,
} from "../src/js/features/app-update/state.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendRoot = path.resolve(__dirname, "..");
const generatedVersionPath = path.join(frontendRoot, "src/js/generated/app-version.js");

function withLocalStorage(fn) {
  const store = new Map();
  const previousWindow = globalThis.window;
  globalThis.window = {
    localStorage: {
      getItem: (key) => store.get(key) || null,
      setItem: (key, value) => store.set(key, value),
    },
  };
  try {
    return fn();
  } finally {
    globalThis.window = previousWindow;
  }
}

test("isNewerVersion compares beta suffix numbers instead of only major version", () => {
  assert.equal(isNewerVersion("v4.1.6-beta2", "4.1.6-beta1"), true);
  assert.equal(isNewerVersion("v4.1.6-beta1", "4.1.6-beta2"), false);
  assert.equal(isNewerVersion("v4.1.6-beta10", "4.1.6-beta1"), true);
  assert.equal(isNewerVersion("v4.1.6-beta1", "4.1.6-beta10"), false);
  assert.equal(isNewerVersion("v4.1.7", "4.1.6-beta9"), true);
});

test("update cache reports freshness using 24 hour ttl", () => {
  withLocalStorage(() => {
    writeUpdateCache({
      currentVersion: "4.1.6-beta1",
      latestVersion: "4.1.6-beta2",
      hasUpdate: true,
      htmlUrl: "https://github.com/wxyhgk/retain-pdf/releases/tag/v4.1.6-beta2",
    }, 1000);

    const fresh = readUpdateCache(1000 + 23 * 60 * 60 * 1000);
    assert.equal(fresh.fresh, true);
    assert.equal(fresh.info.hasUpdate, true);

    const stale = readUpdateCache(1000 + 25 * 60 * 60 * 1000);
    assert.equal(stale.fresh, false);
    assert.equal(stale.info.latestVersion, "4.1.6-beta2");
  });
});

test("generate-app-version uses release version override", () => {
  const before = fs.readFileSync(generatedVersionPath, "utf8");
  try {
    execFileSync("node", ["./scripts/generate-app-version.mjs"], {
      cwd: frontendRoot,
      env: {
        ...process.env,
        RETAIN_PDF_VERSION: "9.8.7-beta10",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    const generated = fs.readFileSync(generatedVersionPath, "utf8");

    assert.match(generated, /export const APP_VERSION = "9\.8\.7-beta10";/);
  } finally {
    fs.writeFileSync(generatedVersionPath, before, "utf8");
  }
});
