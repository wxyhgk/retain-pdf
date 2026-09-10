const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

function createPythonRuntime(options = {}) {
  return {
    bundledPythonImportPaths,
    preparePythonRuntime: (pythonRuntime, callbacks = {}) => preparePythonRuntime(pythonRuntime, {
      isPackaged: !!options.isPackaged,
      updateSplashProgress: callbacks.updateSplashProgress,
    }),
    probePythonRuntime,
    resolveBundledPythonHome,
    resolvePythonRuntime: (backendRoot) => resolvePythonRuntime(backendRoot, {
      isPackaged: !!options.isPackaged,
    }),
    resolvePipelineCommand: (backendRoot, resolveOptions = {}) => resolvePipelineCommand(
      backendRoot,
      resolveOptions,
    ),
  };
}

async function preparePythonRuntime(pythonRuntime, options = {}) {
  if (!shouldProbeCurrentPlatform()) {
    return pythonRuntime;
  }
  const platformLabel = currentPlatformLabel();
  let selectedRuntime = pythonRuntime;
  const startupProbe = await probePythonRuntime(selectedRuntime, {
    timeoutMs: options.isPackaged ? 10000 : 8000,
    includeDependencyImports: false,
    inheritHostPythonPath: !options.isPackaged,
  });
  if (!startupProbe.ok && selectedRuntime.bundledHome) {
    if (options.isPackaged) {
      throw new Error(
        [
          `packaged ${platformLabel} bundled python startup probe failed: ${startupProbe.reason}`,
          startupProbe.stderr || startupProbe.stdout || "",
        ].filter(Boolean).join("\n"),
      );
    }
    console.warn(
      `[desktop] bundled ${platformLabel} python startup probe failed, fallback to system python: ${startupProbe.reason}\n${startupProbe.stderr || ""}`.trim(),
    );
    updateSplashProgress(options, 26, "正在检查 Python 运行时", "内置 Python 不可用，正在回退系统 Python");
    const fallbackRuntime = systemPythonRuntime();
    const fallbackProbe = await probePythonRuntime(fallbackRuntime, {
      timeoutMs: 10000,
      includeDependencyImports: false,
      inheritHostPythonPath: true,
    });
    if (fallbackProbe.ok) {
      selectedRuntime = fallbackRuntime;
    } else {
      throw new Error(
        `${platformLabel} Python runtime startup probe failed; bundled=${startupProbe.reason}; fallback=${fallbackProbe.reason}`,
      );
    }
  }

  const dependencyProbe = await probePythonRuntime(selectedRuntime, {
    timeoutMs: options.isPackaged ? 30000 : 8000,
    includeDependencyImports: true,
    inheritHostPythonPath: !options.isPackaged,
  });
  if (!dependencyProbe.ok) {
    if (options.isPackaged && selectedRuntime.bundledHome && dependencyProbe.timedOut) {
      console.warn(
        [
          `[desktop] packaged ${platformLabel} python dependency probe timed out; continuing to backend startup: ${dependencyProbe.reason}`,
          dependencyProbe.stderr || dependencyProbe.stdout || "",
        ].filter(Boolean).join("\n"),
      );
      updateSplashProgress(options, 26, "正在检查 Python 运行时", "内置 Python 启动较慢，继续启动本地服务");
    } else if (selectedRuntime.bundledHome && !options.isPackaged) {
      console.warn(
        `[desktop] bundled ${platformLabel} python dependency probe failed, fallback to system python: ${dependencyProbe.reason}\n${dependencyProbe.stderr || ""}`.trim(),
      );
      updateSplashProgress(options, 26, "正在检查 Python 运行时", "内置 Python 不可用，正在回退系统 Python");
      const fallbackRuntime = systemPythonRuntime();
      const fallbackProbe = await probePythonRuntime(fallbackRuntime, {
        timeoutMs: 10000,
        includeDependencyImports: true,
        inheritHostPythonPath: true,
      });
      if (fallbackProbe.ok) {
        selectedRuntime = fallbackRuntime;
      } else {
        throw new Error(
          `${platformLabel} Python runtime import probe failed; bundled=${dependencyProbe.reason}; fallback=${fallbackProbe.reason}`,
        );
      }
    } else {
      throw new Error(
        [
          `packaged ${platformLabel} bundled python probe failed: ${dependencyProbe.reason}`,
          dependencyProbe.stderr || dependencyProbe.stdout || "",
        ].filter(Boolean).join("\n"),
      );
    }
  }
  return selectedRuntime;
}

function shouldProbeCurrentPlatform() {
  return process.platform === "darwin" || process.platform === "win32" || process.platform === "linux";
}

function currentPlatformLabel() {
  if (process.platform === "darwin") {
    return "macOS";
  }
  if (process.platform === "win32") {
    return "Windows";
  }
  return "Linux";
}

function systemPythonRuntime() {
  return {
    command: process.platform === "win32" ? "python" : "python3",
    bundledHome: null,
  };
}

function updateSplashProgress(options, progress, title, detail) {
  if (typeof options.updateSplashProgress === "function") {
    options.updateSplashProgress(progress, title, detail);
  }
}

function resolvePythonRuntime(backendRoot, options = {}) {
  const bundledRoot = path.join(backendRoot, "python");
  const bundledCandidates = process.platform === "win32"
    ? [path.join(bundledRoot, "python.exe")]
    : [
        path.join(bundledRoot, "bin", "python3"),
        path.join(bundledRoot, "bin", "python"),
      ];
  for (const candidate of bundledCandidates) {
    if (fs.existsSync(candidate)) {
      return { command: candidate, bundledHome: bundledRoot };
    }
  }
  if (options.isPackaged) {
    return { command: "", bundledHome: null };
  }
  return { command: "python3", bundledHome: null };
}

function resolvePipelineCommand(backendRoot, options = {}) {
  if (!backendRoot) {
    return null;
  }
  const platform = options.platform || process.platform;
  const candidates = platform === "win32"
    ? [
        path.join(backendRoot, "bin", "retainpdf-pipeline.exe"),
        path.join(backendRoot, "bin", "retainpdf-pipeline.cmd"),
        path.join(backendRoot, "python", "Scripts", "retainpdf-pipeline.exe"),
      ]
    : [
        path.join(backendRoot, "bin", "retainpdf-pipeline"),
        path.join(backendRoot, "python", "bin", "retainpdf-pipeline"),
      ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function resolveBundledPythonHome(bundledHome) {
  if (!bundledHome || !fs.existsSync(bundledHome)) {
    return "";
  }
  if (process.platform === "darwin") {
    const frameworkHome = path.join(
      bundledHome,
      "Frameworks",
      "Python.framework",
      "Versions",
      "Current",
    );
    if (fs.existsSync(frameworkHome)) {
      return frameworkHome;
    }
  }
  if (!fs.existsSync(path.join(bundledHome, "pyvenv.cfg"))) {
    return bundledHome;
  }
  return "";
}

function buildPythonProbeScript(includeDependencyImports) {
  if (!includeDependencyImports) {
    return [
      "import sys",
      "print(sys.executable, flush=True)",
      "print(f'prefix={sys.prefix} exec_prefix={sys.exec_prefix} base_exec_prefix={sys.base_exec_prefix}', flush=True)",
      "print('python_runtime_startup_check=ok', flush=True)",
    ].join("\n");
  }

  return [
    "import importlib",
    "import sys",
    "print(sys.executable, flush=True)",
    "print(f'prefix={sys.prefix} exec_prefix={sys.exec_prefix} base_exec_prefix={sys.base_exec_prefix}', flush=True)",
    "for module_name in ['_socket', 'socket', 'ssl', 'requests', 'fitz', 'pikepdf', 'PIL', 'urllib3']:",
    "    print(f'importing:{module_name}', flush=True)",
    "    importlib.import_module(module_name)",
    "    print(f'imported:{module_name}', flush=True)",
    "print('python_runtime_import_check=ok', flush=True)",
  ].join("\n");
}

function probePythonRuntime(runtime, options = {}) {
  const {
    inheritHostPythonPath = true,
    timeoutMs = 8000,
    includeDependencyImports = true,
  } = options;
  return new Promise((resolve) => {
    if (!runtime || !runtime.command) {
      resolve({ ok: false, reason: "missing_python_command" });
      return;
    }
    const env = {
      ...process.env,
      PYTHONUNBUFFERED: "1",
      PYTHONUTF8: "1",
    };
    const pythonImportPaths = bundledPythonImportPaths(runtime.bundledHome);
    if (pythonImportPaths.length > 0) {
      env.PYTHONPATH = [
        ...pythonImportPaths,
        inheritHostPythonPath ? process.env.PYTHONPATH || "" : "",
      ].filter(Boolean).join(path.delimiter);
    }
    const bundledPythonHome = resolveBundledPythonHome(runtime.bundledHome);
    if (bundledPythonHome) {
      env.PYTHONHOME = bundledPythonHome;
    } else {
      delete env.PYTHONHOME;
    }
    const child = spawn(
      runtime.command,
      [
        "-c",
        buildPythonProbeScript(includeDependencyImports),
      ],
      {
        env,
        windowsHide: process.platform === "win32",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      resolve({
        ok: false,
        timedOut,
        reason: String(error && error.message ? error.message : error),
        stdout,
        stderr,
      });
    });
    child.once("exit", (code, signal) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ ok: true, stdout: stdout.trim(), stderr: stderr.trim() });
        return;
      }
      resolve({
        ok: false,
        timedOut,
        reason: timedOut
          ? `timeout_after_ms=${timeoutMs} exit_code=${code ?? "null"} signal=${signal ?? "null"}`
          : `exit_code=${code ?? "null"} signal=${signal ?? "null"}`,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });
  });
}

function bundledPythonSitePackages(bundledHome) {
  if (!bundledHome || !fs.existsSync(bundledHome)) {
    return [];
  }
  if (process.platform === "win32") {
    const windowsSitePackages = path.join(bundledHome, "Lib", "site-packages");
    return fs.existsSync(windowsSitePackages) ? [windowsSitePackages] : [];
  }

  const libRoot = path.join(bundledHome, "lib");
  if (!fs.existsSync(libRoot)) {
    return [];
  }

  const matches = [];
  for (const entry of fs.readdirSync(libRoot)) {
    if (!/^python\d+\.\d+$/.test(entry)) {
      continue;
    }
    const sitePackages = path.join(libRoot, entry, "site-packages");
    if (fs.existsSync(sitePackages)) {
      matches.push(sitePackages);
    }
  }
  return matches;
}

function bundledPythonLibDynload(bundledHome) {
  if (!bundledHome || !fs.existsSync(bundledHome) || process.platform !== "darwin") {
    return [];
  }
  const pythonHome = resolveBundledPythonHome(bundledHome);
  const libRoot = pythonHome ? path.join(pythonHome, "lib") : "";
  if (!libRoot || !fs.existsSync(libRoot)) {
    return [];
  }

  const matches = [];
  for (const entry of fs.readdirSync(libRoot)) {
    if (!/^python\d+\.\d+$/.test(entry)) {
      continue;
    }
    const libDynload = path.join(libRoot, entry, "lib-dynload");
    if (fs.existsSync(libDynload)) {
      matches.push(libDynload);
    }
  }
  return matches;
}

function bundledPythonImportPaths(bundledHome) {
  return [
    ...bundledPythonSitePackages(bundledHome),
    ...bundledPythonLibDynload(bundledHome),
  ];
}

module.exports = {
  createPythonRuntime,
  resolvePipelineCommand,
};
