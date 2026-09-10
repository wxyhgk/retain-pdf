import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { packCurrentDesktopAsar } from "./pack-current-asar.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..", "..");
const remoteBase = "D:\\RetainPDF-win-test";
const remoteSource = `${remoteBase}\\source`;
const remoteNode = `${remoteBase}\\tools\\node\\node.exe`;
const smokeRequested = process.argv.includes("--smoke");
const keepRunning = process.argv.includes("--keep-running");
const hostIndex = process.argv.indexOf("--host");
const sshHost = hostIndex >= 0
  ? process.argv[hostIndex + 1]
  : process.env.RETAINPDF_WINDOWS_SSH_HOST || "win11-shenzhou";

if (!sshHost || !/^[a-zA-Z0-9._-]+$/.test(sshHost)) {
  throw new Error(`invalid SSH host alias: ${sshHost || "<missing>"}`);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || repoRoot,
    env: options.env || process.env,
    stdio: options.stdio || "inherit",
    encoding: options.encoding,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status}`);
  }
  return result;
}

function runRemotePowerShell(script) {
  const wrappedScript = `$ProgressPreference = 'SilentlyContinue'\n${script}`;
  const encoded = Buffer.from(wrappedScript, "utf16le").toString("base64");
  run("ssh", [
    "-o", "BatchMode=yes",
    "-o", "ConnectTimeout=8",
    sshHost,
    "powershell.exe",
    "-NoLogo",
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy", "Bypass",
    "-OutputFormat", "Text",
    "-EncodedCommand", encoded,
  ]);
}

async function waitForProcess(child, label) {
  return await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${label} exited with status ${code}`));
      }
    });
  });
}

async function syncDesktopSource() {
  runRemotePowerShell(`
$ErrorActionPreference = 'Stop'
$source = '${remoteSource}'
if ($source -ne 'D:\\RetainPDF-win-test\\source') { throw 'Unexpected remote source path' }
if (Test-Path $source) { Remove-Item $source -Recurse -Force }
New-Item -ItemType Directory -Path $source -Force | Out-Null
`);

  const git = spawn(
    "git",
    ["ls-files", "-co", "--exclude-standard", "-z", "--", "frontend/desktop"],
    { cwd: repoRoot, stdio: ["ignore", "pipe", "inherit"] },
  );
  const tar = spawn(
    "tar",
    ["--null", "-T", "-", "-czf", "-"],
    {
      cwd: repoRoot,
      env: { ...process.env, COPYFILE_DISABLE: "1" },
      stdio: ["pipe", "pipe", "inherit"],
    },
  );
  const ssh = spawn(
    "ssh",
    ["-o", "BatchMode=yes", sshHost, `tar.exe -xzf - -C ${remoteSource}`],
    { cwd: repoRoot, stdio: ["pipe", "inherit", "inherit"] },
  );
  git.stdout.pipe(tar.stdin);
  tar.stdout.pipe(ssh.stdin);
  await Promise.all([
    waitForProcess(git, "git file listing"),
    waitForProcess(tar, "desktop source archive"),
    waitForProcess(ssh, "desktop source transfer"),
  ]);
}

function runWindowsNodeTests() {
  runRemotePowerShell(`
$ErrorActionPreference = 'Stop'
$node = '${remoteNode}'
$source = '${remoteSource}'
if (-not (Test-Path $node)) { throw 'Portable Node is missing; bootstrap win11-shenzhou first' }
Set-Location $source
$tests = @('frontend\\desktop\\scripts\\runtime-prune.test.mjs')
$tests += Get-ChildItem 'frontend\\desktop\\src\\main\\*.test.mjs' | ForEach-Object { $_.FullName }
$timer = [Diagnostics.Stopwatch]::StartNew()
& $node --test @tests
if ($LASTEXITCODE -ne 0) { throw ('Desktop node tests failed with exit code ' + $LASTEXITCODE) }
Write-Output ('[windows-test] files=' + $tests.Count + ' seconds=' + [math]::Round($timer.Elapsed.TotalSeconds, 1))
`);
}

async function runWindowsLiveSmoke() {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "retainpdf-win-smoke-"));
  const asarPath = path.join(temporaryRoot, "app.asar");
  try {
    const packed = await packCurrentDesktopAsar(asarPath);
    console.log(
      `[windows-smoke] packed ${(packed.sizeBytes / 1024 / 1024).toFixed(1)} MiB sha256=${packed.sha256}`,
    );
    run("scp", [
      "-q",
      asarPath,
      `${sshHost}:D:/RetainPDF-win-test/incoming-app.asar`,
    ]);
    const keepRunningArgument = keepRunning ? " -KeepRunning" : "";
    runRemotePowerShell(`
$ErrorActionPreference = 'Stop'
& '${remoteSource}\\frontend\\desktop\\scripts\\windows-live-smoke.ps1' -AsarPath 'D:\\RetainPDF-win-test\\incoming-app.asar'${keepRunningArgument}
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
`);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

console.log(`[windows-test] host=${sshHost}`);
run("ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=8", sshHost, "hostname"]);
console.log("[windows-test] syncing current desktop worktree");
await syncDesktopSource();
console.log("[windows-test] running Node tests on Windows");
runWindowsNodeTests();
if (smokeRequested) {
  console.log("[windows-smoke] launching isolated current-ASAR app with installed Windows runtime");
  await runWindowsLiveSmoke();
}
