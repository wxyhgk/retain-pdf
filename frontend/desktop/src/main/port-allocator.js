// Dynamic port allocation for the bundled backend.
//
// If a default port (41000/42000/41002/41100) is occupied, the desktop used
// to fail outright. Now it reclaims own residuals first and otherwise falls
// back to the next free port, so any occupant (old installs, Docker, other
// software) no longer blocks startup. The chosen ports flow into the backend
// env (RUST_API_PORT/...) and the frontend apiBase; Rust code is untouched.

const DEFAULT_MAX_OFFSET = 50;

const PORT_ROLES = [
  { key: "apiPort", label: "API", fallback: 41000 },
  { key: "simplePort", label: "multipart 提交", fallback: 42000 },
  { key: "jobsPort", label: "任务服务", fallback: 41002 },
  { key: "aiServicePort", label: "AI 服务", fallback: 41100 },
];

function createPortAllocator(options = {}) {
  const logger = options.logger || console;
  const probeBusy = options.canConnectToPort;
  const reclaimPortIfOwnResidual = options.reclaimPortIfOwnResidual;
  const describeOccupant = options.describeOccupant || (() => "");
  const maxOffset = Number.isFinite(options.maxOffset) ? options.maxOffset : DEFAULT_MAX_OFFSET;
  const exclude = options.exclude instanceof Set ? options.exclude : new Set();

  if (typeof probeBusy !== "function" || typeof reclaimPortIfOwnResidual !== "function") {
    throw new Error("createPortAllocator requires canConnectToPort and reclaimPortIfOwnResidual");
  }

  // Allocate one role. Returns { port, relocatedFrom, occupant }.
  // Throws with occupant detail when the whole range is exhausted.
  async function allocateRole(host, role, fallbackDefault) {
    const start = Number.isFinite(role.defaultPort) ? role.defaultPort : fallbackDefault;
    let defaultOccupant = null;
    for (let offset = 0; offset <= maxOffset; offset += 1) {
      const port = start + offset;
      if (exclude.has(port)) {
        continue;
      }
      let busy = false;
      try {
        busy = await probeBusy(host, port);
      } catch {
        busy = true;
      }
      if (!busy) {
        return { port, relocatedFrom: offset === 0 ? 0 : start, occupant: null };
      }
      const reclaim = await reclaimPortIfOwnResidual(host, port);
      if (reclaim.status === "reclaimed") {
        logger.warn(`[desktop] port ${port} (${role.label}) reclaimed from residual backend`);
        return { port, relocatedFrom: offset === 0 ? 0 : start, occupant: reclaim.occupant };
      }
      if (offset === 0) {
        defaultOccupant = reclaim.occupant;
      }
      logger.warn(
        `[desktop] port ${port} (${role.label}) busy, occupant=${
          reclaim.occupant ? `${reclaim.occupant.image || "<unknown>"}:${reclaim.occupant.pid}` : "<none>"
        }, trying next`,
      );
    }
    const detail = describeOccupant(start, defaultOccupant);
    throw new Error(
      [
        `端口 ${start}（${role.label}）及附近 ${maxOffset} 个端口均被占用，桌面端无法启动。`,
        detail,
      ].filter(Boolean).join("\n"),
    );
  }

  // Allocate all four backend ports. Returns
  // { ports: { apiPort, simplePort, jobsPort, aiServicePort },
  //   relocations: [{ role, from, to }], occupantLines: { key: string } }.
  async function allocateBackendPorts(host, defaults = {}) {
    const ports = {};
    const relocations = [];
    const occupantLines = {};
    for (const role of PORT_ROLES) {
      const fallbackDefault = role.fallback;
      const start = Number.isFinite(defaults[role.key]) ? defaults[role.key] : fallbackDefault;
      const allocated = await allocateRole(host, { ...role, defaultPort: start }, fallbackDefault);
      ports[role.key] = allocated.port;
      if (allocated.relocatedFrom) {
        relocations.push({ role: role.label, from: allocated.relocatedFrom, to: allocated.port });
        logger.warn(`[desktop] ${role.label}端口 ${allocated.relocatedFrom} 被占用，已切换到 ${allocated.port}`);
      }
      if (allocated.occupant) {
        occupantLines[role.key] = describeOccupant(allocated.port, allocated.occupant);
      }
    }
    return { ports, relocations, occupantLines };
  }

  return {
    allocateBackendPorts,
    allocateRole,
  };
}

module.exports = {
  DEFAULT_MAX_OFFSET,
  PORT_ROLES,
  createPortAllocator,
};
