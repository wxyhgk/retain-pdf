const { execFile, execFileSync } = require("child_process");
const http = require("http");

// Images owned by the RetainPDF backend. Only these are ever auto-reclaimed:
// anything else (Docker, dev servers, system services) keeps the current
// fail-with-a-clear-error behavior. python.exe is deliberately excluded —
// the name is too generic to attribute safely.
const OWN_BACKEND_IMAGES = new Set([
  "rust_api.exe",
  "rust_api",
  "retain-jobsd.exe",
  "retain-jobsd",
]);

const RECLAIM_SETTLE_MS = 1200;
const COMMAND_TIMEOUT_MS = 5000;

function defaultRunCommand(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: COMMAND_TIMEOUT_MS, windowsHide: true }, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(String(stdout || ""));
    });
  });
}

function defaultRunCommandSync(command, args) {
  execFileSync(command, args, { timeout: COMMAND_TIMEOUT_MS, windowsHide: true });
  return "";
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function createPortOccupant(options = {}) {
  const logger = options.logger || console;
  const probeBusy = typeof options.canConnectToPort === "function"
    ? options.canConnectToPort
    : async () => false;
  const runCommand = typeof options.runCommand === "function" ? options.runCommand : defaultRunCommand;
  const runCommandSync = typeof options.runCommandSync === "function" ? options.runCommandSync : defaultRunCommandSync;
  const platform = options.platform || process.platform;

  function isOwnResidualBackend(image) {
    return OWN_BACKEND_IMAGES.has(String(image || "").toLowerCase());
  }

  async function getWindowsOccupant(host, port) {
    const output = await runCommand("netstat", ["-ano", "-p", "TCP"]);
    const wanted = `${host}:${port}`.toLowerCase();
    let pid = "";
    for (const line of output.split(/\r?\n/)) {
      const parts = line.trim().split(/\s+/);
      // TCP    127.0.0.1:41000    0.0.0.0:0    LISTENING    1234
      // Columns: proto, local, foreign, state, pid.
      if (parts.length < 5 || parts[0].toUpperCase() !== "TCP") {
        continue;
      }
      if (parts[1].toLowerCase() !== wanted || !/^LISTENING$/i.test(parts[3])) {
        continue;
      }
      pid = parts[parts.length - 1];
      break;
    }
    if (!pid || !/^\d+$/.test(pid)) {
      return null;
    }
    try {
      const taskOutput = await runCommand("tasklist", ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"]);
      const image = parseTasklistImage(taskOutput);
      if (image) {
        return { pid, image };
      }
    } catch {
      // Fall through to one retry below.
    }
    // The listener may have just exited (netstat/tasklist race), or tasklist
    // spoke a localized "no such process" line. Retry once before giving up.
    await sleep(400);
    try {
      const taskOutput = await runCommand("tasklist", ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"]);
      const image = parseTasklistImage(taskOutput);
      return { pid, image: image || "" };
    } catch {
      return { pid, image: "" };
    }
  }

  // tasklist /FO CSV /NH prints `"image.exe","pid",...` on hit, or an
  // info line ("INFO: ..." / localized "信息: ...") on miss.
  function parseTasklistImage(taskOutput) {
    const firstLine = String(taskOutput || "")
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .find(Boolean) || "";
    const match = firstLine.match(/^"([^"]+)"/);
    if (!match) {
      return "";
    }
    return match[1];
  }

  async function getPosixOccupant(host, port) {
    let pid = "";
    try {
      const output = await runCommand("lsof", ["-tiTCP@" + host + ":" + port, "-sTCP:LISTEN"]);
      pid = (output.split(/\s+/).map((entry) => entry.trim()).find(Boolean) || "").trim();
    } catch {
      return null;
    }
    if (!/^\d+$/.test(pid)) {
      return null;
    }
    try {
      const output = await runCommand("ps", ["-o", "comm=", "-p", pid]);
      const image = (output.split(/\r?\n/).map((entry) => entry.trim()).find(Boolean) || "").split("/").pop();
      return { pid, image: image || "" };
    } catch {
      return { pid, image: "" };
    }
  }

  // Returns { pid, image } | null (nobody listening). Throws on lookup
  // failure so callers can distinguish "free" from "unknown".
  async function getPortOccupant(host, port) {
    if (platform === "win32") {
      return await getWindowsOccupant(host, port);
    }
    return await getPosixOccupant(host, port);
  }

  // Synchronous variant for before-quit: Electron cannot await async work
  // there, and plain ChildProcess.kill() leaves supervised grandchildren
  // (jobsd, ai service, workers) orphaned holding ports. Only kills the
  // given PID tree; callers must not pass foreign PIDs.
  function killProcessTreeSync(pid) {
    try {
      if (platform === "win32") {
        runCommandSync("taskkill", ["/PID", String(pid), "/T", "/F"]);
        return true;
      }
      process.kill(Number(pid), "SIGKILL");
      return true;
    } catch (error) {
      logger.warn(`[desktop] failed to terminate process tree ${pid}: ${error?.message || error}`);
      return false;
    }
  }

  async function killProcessTree(pid) {
    try {
      if (platform === "win32") {
        // SIGTERM does not terminate trees on Windows; taskkill /T /F does.
        await runCommand("taskkill", ["/PID", String(pid), "/T", "/F"]);
        return true;
      }
      process.kill(Number(pid), "SIGKILL");
      return true;
    } catch (error) {
      logger.warn(`[desktop] failed to terminate residual process ${pid}: ${error?.message || error}`);
      return false;
    }
  }

  // Best-effort check whether the listener is a RetainPDF backend, used
  // only when the process image could not be identified. Never throws.
  async function identifyBackendViaHttp(host, port) {
    return new Promise((resolve) => {
      const request = http.get(
        `http://${host}:${port}/health`,
        { timeout: 2000 },
        (response) => {
          let body = "";
          response.setEncoding("utf8");
          response.on("data", (chunk) => {
            body += chunk;
          });
          response.on("end", () => {
            try {
              const payload = JSON.parse(body);
              resolve(Boolean(payload && payload.data && payload.data.status === "up"));
            } catch {
              resolve(false);
            }
          });
        },
      );
      request.on("timeout", () => {
        request.destroy();
        resolve(false);
      });
      request.on("error", () => resolve(false));
    });
  }

  // If the port is held by our own residual backend binary, terminate its
  // tree and re-probe. Returns { status, occupant } where status is one of
  // "free" | "reclaimed" | "busy". Never throws: lookup failures degrade to
  // "busy" with a null occupant so callers keep the historical behavior.
  async function reclaimPortIfOwnResidual(host, port) {
    let occupant = null;
    try {
      occupant = await getPortOccupant(host, port);
    } catch (error) {
      logger.warn(`[desktop] port occupant lookup failed for ${host}:${port}: ${error?.message || error}`);
      return { status: "busy", occupant: null };
    }
    if (!occupant) {
      return { status: "free", occupant: null };
    }
    if (!isOwnResidualBackend(occupant.image)) {
      // Image unidentified (localized tasklist, exited listener, missing
      // rights): ask the port itself. A RetainPDF /health signature means a
      // residual backend of ours, which the packaged policy allows reclaiming
      // (killing, never silently reusing).
      if (!occupant.image) {
        let identified = false;
        try {
          identified = await identifyBackendViaHttp(host, port);
        } catch {
          identified = false;
        }
        if (identified) {
          occupant.image = "RetainPDF 后端残留";
          occupant.identifiedViaApi = true;
        } else {
          return { status: "busy", occupant };
        }
      } else {
        return { status: "busy", occupant };
      }
    }
    logger.warn(
      `[desktop] port ${port} is held by residual backend ${occupant.image} (PID ${occupant.pid}); terminating its process tree`,
    );
    const killed = await killProcessTree(occupant.pid);
    if (!killed) {
      return { status: "busy", occupant };
    }
    await sleep(RECLAIM_SETTLE_MS);
    const stillBusy = await probeBusy(host, port);
    if (stillBusy) {
      return { status: "busy", occupant };
    }
    logger.warn(`[desktop] reclaimed port ${port} from residual ${occupant.image} (PID ${occupant.pid})`);
    return { status: "reclaimed", occupant };
  }

  function describeOccupant(port, occupant) {
    if (!occupant || !occupant.pid) {
      return "";
    }
    const killHint = platform === "win32"
      ? `可手动执行 taskkill /PID ${occupant.pid} /F 后重试。`
      : `可手动执行 kill -9 ${occupant.pid} 后重试。`;
    if (occupant.image) {
      return `占用进程：${occupant.image}（PID ${occupant.pid}）。${killHint}`;
    }
    return `占用进程 PID ${occupant.pid}（进程名未能识别）。${killHint}`;
  }

  return {
    describeOccupant,
    getPortOccupant,
    isOwnResidualBackend,
    killProcessTree,
    killProcessTreeSync,
    reclaimPortIfOwnResidual,
  };
}

module.exports = {
  createPortOccupant,
};
