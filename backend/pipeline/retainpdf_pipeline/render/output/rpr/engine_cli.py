"""找到并调用 rpr 排版引擎（retain-pdf-rendering）的 CLI。

引擎以子进程 CLI 运行，输入输出走 JSON 文件（契约见 backend/rendering-engine/README.md）：

    node <engine>/bin/rpr-retain.js --input <in.json> --out-dir <DIR> --output pdf [--font-path <dir>]...

引擎自己写 PDF（不经过 Typst）；``RETAIN_RPR_ENGINE_OUTPUT=typst`` 时改用引擎的 Typst 输出
（对照用，需要 typst）。

退出码 0 = 成功，产物 <DIR>/overlay.pdf 与 <DIR>/report.json；非 0 = 失败，stderr 最后一行
是 ``{"error": "..."}``。

位置解析：
- 引擎目录：``RETAIN_RPR_ENGINE_DIR``（Docker / 桌面端打包时设置，指向含 ``engine/`` 与
  ``node_modules/`` 的目录）→ 仓库检出里的 ``backend/rendering-engine``。
- Node：``RETAINPDF_NODE_BIN``（桌面端指向 Electron 本体，配 ``ELECTRON_RUN_AS_NODE=1``，
  照抄 Word 导出）→ PATH 里的 ``node``。版本必须 ≥ 22.8。

这里的每一种「用不了」都抛 ``RprEngineUnavailable``，引擎跑了但失败抛 ``RprEngineFailed``；
上游据此回退 Typst 路线，任务不失败。
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import time
from dataclasses import dataclass
from dataclasses import field
from pathlib import Path

from retainpdf_pipeline.foundation.config.external_tools import ExternalToolNotFound
from retainpdf_pipeline.foundation.config.external_tools import resolve_typst_bin
from retainpdf_pipeline.render.output.typst.compiler import _resolved_font_paths

ENGINE_DIR_ENV_VAR = "RETAIN_RPR_ENGINE_DIR"
NODE_ENV_VAR = "RETAINPDF_NODE_BIN"
ENGINE_TIMEOUT_ENV_VAR = "RETAIN_RPR_ENGINE_TIMEOUT_SECONDS"
ENGINE_OUTPUT_ENV_VAR = "RETAIN_RPR_ENGINE_OUTPUT"
ENGINE_OUTPUTS = ("pdf", "typst")
MIN_NODE_VERSION = (22, 8, 0)
DEFAULT_TIMEOUT_SECONDS = 1800
ENGINE_ENTRY_RELATIVE = Path("engine") / "bin" / "rpr-retain.js"
ENGINE_PACKAGE_RELATIVE = Path("engine") / "package.json"
# 运行时 npm 依赖（backend/rendering-engine/package.json）：公式与写 PDF 时的字体。
RUNTIME_PACKAGES = ("mathjax-full", "fontkit")

# rpr/ → output/ → render/ → retainpdf_pipeline/ → pipeline/ → backend/
_BACKEND_ROOT = Path(__file__).resolve().parents[5]
_REPO_ENGINE_DIR = _BACKEND_ROOT / "rendering-engine"


class RprEngineUnavailable(RuntimeError):
    """环境里用不了引擎（没装、Node 太旧……）。``code`` 是写进摘要的短原因。"""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


class RprEngineFailed(RuntimeError):
    """引擎跑了但失败（退出码非 0、超时、产物缺失）。"""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class RprEngineRuntime:
    engine_dir: Path
    entry: Path
    node: str
    node_version: str
    electron_as_node: bool
    engine_version: str = ""

    def env(self) -> dict[str, str]:
        env = dict(os.environ)
        if self.electron_as_node:
            env.setdefault("ELECTRON_RUN_AS_NODE", "1")
        return env


@dataclass
class RprEngineRun:
    overlay_pdf: Path
    report: dict
    elapsed_seconds: float
    stderr_tail: str = ""
    command: list[str] = field(default_factory=list)


def resolve_engine_dir() -> Path:
    configured = os.environ.get(ENGINE_DIR_ENV_VAR, "").strip()
    if configured:
        return Path(configured).expanduser()
    return _REPO_ENGINE_DIR


def _parse_version(text: str) -> tuple[int, int, int] | None:
    match = re.search(r"(\d+)\.(\d+)\.(\d+)", str(text or ""))
    if not match:
        return None
    return int(match.group(1)), int(match.group(2)), int(match.group(3))


def _resolve_node() -> tuple[str, bool]:
    configured = os.environ.get(NODE_ENV_VAR, "").strip()
    if configured:
        if not Path(configured).is_file():
            raise RprEngineUnavailable("node_not_found", f"{NODE_ENV_VAR} 指向的文件不存在：{configured}")
        return configured, True
    node = shutil.which("node")
    if not node:
        raise RprEngineUnavailable(
            "node_not_found",
            f"找不到 node（rpr 引擎需要 Node >= 22.8）。打包环境请用 {NODE_ENV_VAR} 指定。",
        )
    return node, False


def _node_version(node: str, *, electron_as_node: bool) -> str:
    env = dict(os.environ)
    if electron_as_node:
        env.setdefault("ELECTRON_RUN_AS_NODE", "1")
    try:
        result = subprocess.run(
            [node, "-p", "process.versions.node"],
            capture_output=True,
            text=True,
            timeout=30,
            env=env,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        raise RprEngineUnavailable("node_not_runnable", f"node 无法运行：{type(exc).__name__}: {exc}") from exc
    if result.returncode != 0:
        raise RprEngineUnavailable("node_not_runnable", f"node 无法运行：{result.stderr.strip()[-500:]}")
    return result.stdout.strip()


def _engine_version(engine_dir: Path) -> str:
    try:
        payload = json.loads((engine_dir / ENGINE_PACKAGE_RELATIVE).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return ""
    version = str(payload.get("version") or "")
    upstream = engine_dir / "UPSTREAM"
    commit = ""
    try:
        for line in upstream.read_text(encoding="utf-8").splitlines():
            key, _, value = line.partition("=")
            if key.strip() == "commit":
                commit = value.strip()[:12]
    except OSError:
        pass
    return f"{version}+{commit}" if version and commit else version


def resolve_engine_runtime(entry_script: str = "rpr-retain.js") -> RprEngineRuntime:
    """entry_script：rpr-retain.js（rpr：retain-pdf 定字号）或 rpr-fit.js（rpr_fit：引擎测量定字号）。"""
    engine_dir = resolve_engine_dir()
    entry = engine_dir / ENGINE_ENTRY_RELATIVE.parent / entry_script
    if not entry.is_file():
        raise RprEngineUnavailable(
            "engine_not_installed",
            f"找不到 rpr 引擎入口 {entry}（{ENGINE_DIR_ENV_VAR} 未设置时用仓库里的 backend/rendering-engine）",
        )
    missing = [name for name in RUNTIME_PACKAGES if not (engine_dir / "node_modules" / name / "package.json").is_file()]
    if missing:
        raise RprEngineUnavailable(
            "engine_dependencies_missing",
            f"rpr 引擎缺运行时依赖 {', '.join(missing)}：在 {engine_dir} 下运行 npm ci --omit=dev",
        )
    node, electron_as_node = _resolve_node()
    version_text = _node_version(node, electron_as_node=electron_as_node)
    version = _parse_version(version_text)
    if version is None:
        raise RprEngineUnavailable("node_version_unknown", f"读不出 node 版本：{version_text!r}")
    if version < MIN_NODE_VERSION:
        raise RprEngineUnavailable(
            "node_too_old",
            f"node {version_text} 太旧，rpr 引擎需要 >= {'.'.join(map(str, MIN_NODE_VERSION))}",
        )
    return RprEngineRuntime(
        engine_dir=engine_dir,
        entry=entry,
        node=node,
        node_version=version_text,
        electron_as_node=electron_as_node,
        engine_version=_engine_version(engine_dir),
    )


def _timeout_seconds() -> int:
    raw = os.environ.get(ENGINE_TIMEOUT_ENV_VAR, "").strip()
    try:
        value = int(raw) if raw else DEFAULT_TIMEOUT_SECONDS
    except ValueError:
        value = DEFAULT_TIMEOUT_SECONDS
    return max(1, value)


def _error_from_stderr(stderr: str) -> str:
    for line in reversed([line.strip() for line in str(stderr or "").splitlines() if line.strip()]):
        if line.startswith("{"):
            try:
                payload = json.loads(line)
            except ValueError:
                continue
            if isinstance(payload, dict) and payload.get("error"):
                return str(payload["error"])
    tail = str(stderr or "").strip()
    return tail[-500:] if tail else "no stderr"


def engine_output() -> str:
    """引擎的输出方式：pdf（默认，引擎自己写 PDF）或 typst（引擎生成 Typst 再编译，对照用）。"""
    value = os.environ.get(ENGINE_OUTPUT_ENV_VAR, "").strip().lower()
    return value if value in ENGINE_OUTPUTS else "pdf"


def run_engine(
    runtime: RprEngineRuntime,
    *,
    input_path: Path,
    out_dir: Path,
    font_paths: list[Path] | None = None,
) -> RprEngineRun:
    out_dir.mkdir(parents=True, exist_ok=True)
    output = engine_output()
    command = [runtime.node, str(runtime.entry), "--input", str(input_path), "--out-dir", str(out_dir), "--output", output]
    if output == "typst":
        try:
            command.extend(["--typst", resolve_typst_bin()])
        except ExternalToolNotFound as exc:
            raise RprEngineUnavailable("typst_not_found", str(exc)) from exc
    for font_path in _resolved_font_paths(font_paths):
        command.extend(["--font-path", str(font_path)])
    started = time.perf_counter()
    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=_timeout_seconds(),
            env=runtime.env(),
            cwd=str(out_dir),
        )
    except subprocess.TimeoutExpired as exc:
        raise RprEngineFailed("engine_timeout", f"rpr 引擎超时（{exc.timeout}s）") from exc
    except OSError as exc:
        raise RprEngineFailed("engine_not_runnable", f"rpr 引擎无法启动：{type(exc).__name__}: {exc}") from exc
    elapsed = time.perf_counter() - started
    if result.returncode != 0:
        raise RprEngineFailed(
            "engine_error",
            f"rpr 引擎失败（退出码 {result.returncode}）：{_error_from_stderr(result.stderr)}",
        )
    overlay_pdf = out_dir / "overlay.pdf"
    report_path = out_dir / "report.json"
    if not overlay_pdf.is_file() or overlay_pdf.stat().st_size <= 0:
        raise RprEngineFailed("engine_output_missing", f"rpr 引擎没有产出 {overlay_pdf}")
    try:
        report = json.loads(report_path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise RprEngineFailed("engine_report_invalid", f"rpr 引擎报告读不了：{type(exc).__name__}: {exc}") from exc
    if not isinstance(report, dict):
        raise RprEngineFailed("engine_report_invalid", "rpr 引擎报告不是 JSON 对象")
    if result.stderr.strip():
        print(f"rpr engine stderr: {result.stderr.strip()[-2000:]}", flush=True)
    return RprEngineRun(
        overlay_pdf=overlay_pdf,
        report=report,
        elapsed_seconds=elapsed,
        stderr_tail=result.stderr.strip()[-2000:],
        command=command,
    )


__all__ = [
    "ENGINE_DIR_ENV_VAR",
    "ENGINE_OUTPUT_ENV_VAR",
    "MIN_NODE_VERSION",
    "NODE_ENV_VAR",
    "RprEngineFailed",
    "RprEngineRun",
    "RprEngineRuntime",
    "RprEngineUnavailable",
    "engine_output",
    "resolve_engine_dir",
    "resolve_engine_runtime",
    "run_engine",
]
