from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path


PROMPTFOO_DIR = Path(__file__).resolve().parent
if str(PROMPTFOO_DIR) not in sys.path:
    sys.path.insert(0, str(PROMPTFOO_DIR))

from common import read_fixture_rows


def _parse_node_version(raw: str) -> tuple[int, int, int]:
    text = str(raw or "").strip().lstrip("v")
    parts = [int(part) for part in text.split(".")[:3]]
    while len(parts) < 3:
        parts.append(0)
    return tuple(parts[:3])


def _slugify_runtime_label(value: str) -> str:
    text = str(value or "").strip().lower()
    safe = "".join(ch if ch.isalnum() else "-" for ch in text)
    while "--" in safe:
        safe = safe.replace("--", "-")
    return safe.strip("-") or "unknown-node"


def _is_supported_promptfoo_node(version: tuple[int, int, int]) -> bool:
    major, minor, patch = version
    if major == 20:
        return (minor, patch) >= (20, 0)
    if major == 22:
        return (minor, patch) >= (22, 0)
    return major > 22


def _find_compatible_nvm_node() -> tuple[Path, Path, str] | None:
    nvm_versions_dir = Path.home() / ".nvm" / "versions" / "node"
    if not nvm_versions_dir.exists():
        return None
    candidates: list[tuple[tuple[int, int, int], Path, Path, str]] = []
    for version_dir in nvm_versions_dir.iterdir():
        if not version_dir.is_dir():
            continue
        raw_name = version_dir.name
        try:
            version = _parse_node_version(raw_name)
        except ValueError:
            continue
        if not _is_supported_promptfoo_node(version):
            continue
        node_bin = version_dir / "bin" / "node"
        npx_bin = version_dir / "bin" / "npx"
        if not node_bin.exists() or not npx_bin.exists():
            continue
        candidates.append((version, node_bin, npx_bin, raw_name))
    if not candidates:
        return None
    candidates.sort(reverse=True)
    _, node_bin, npx_bin, label = candidates[0]
    return node_bin, npx_bin, label


def ensure_node_runtime() -> tuple[Path, Path, str]:
    node_override = os.environ.get("PROMPTFOO_NODE_BIN", "").strip()
    npx_override = os.environ.get("PROMPTFOO_NPX_BIN", "").strip()
    if node_override and npx_override:
        return Path(node_override), Path(npx_override), "env override"
    try:
        completed = subprocess.run(
            ["node", "--version"],
            check=True,
            capture_output=True,
            text=True,
        )
    except FileNotFoundError as exc:
        fallback = _find_compatible_nvm_node()
        if fallback is not None:
            return fallback
        raise RuntimeError("Node.js not found. promptfoo currently requires Node 20.20+ or 22.22+.") from exc
    except subprocess.CalledProcessError as exc:
        raise RuntimeError(f"failed to query Node.js version: {exc}") from exc

    version = _parse_node_version(completed.stdout)
    if _is_supported_promptfoo_node(version):
        # Keep subprocesses on the same PATH-selected Node toolchain.
        return Path("node"), Path("npx"), completed.stdout.strip() or str(version)
    fallback = _find_compatible_nvm_node()
    if fallback is not None:
        return fallback
    raise RuntimeError(
        "Unsupported Node.js version for promptfoo. "
        f"Detected {completed.stdout.strip() or version}, require 20.20+ or 22.22+."
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run promptfoo evaluation for translation replay fixtures.")
    parser.add_argument("--compare", action="store_true", help="Use compare config with saved-artifact baseline.")
    parser.add_argument("--saved-only", action="store_true", help="Use saved-artifact-only config without replaying the model.")
    parser.add_argument(
        "--fixtures",
        type=str,
        default="",
        help="Override fixture CSV path. Defaults to promptfoo/fixtures/cases.csv",
    )
    parser.add_argument(
        "promptfoo_args",
        nargs=argparse.REMAINDER,
        help="Additional args passed to `promptfoo eval` after `--`.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    fixtures_path = (
        Path(args.fixtures).expanduser().resolve()
        if args.fixtures.strip()
        else (PROMPTFOO_DIR / "fixtures" / "cases.csv").resolve()
    )
    enabled_rows = [row for row in read_fixture_rows(fixtures_path) if row.get("enabled", True)]
    if not enabled_rows:
        print(
            "No enabled promptfoo fixtures found. Add one with "
            f"`python {PROMPTFOO_DIR / 'capture_case.py'} --job-root <job_id> --item-id <item_id> --description <label>`.",
            file=sys.stderr,
        )
        return 1
    try:
        node_bin, npx_bin, runtime_label = ensure_node_runtime()
    except RuntimeError as exc:
        print(str(exc), file=sys.stderr)
        return 1

    if args.compare and args.saved_only:
        print("`--compare` and `--saved-only` cannot be used together.", file=sys.stderr)
        return 1
    if args.saved_only:
        config_name = "promptfooconfig.saved.yaml"
    elif args.compare:
        config_name = "promptfooconfig.compare.yaml"
    else:
        config_name = "promptfooconfig.yaml"
    config_path = PROMPTFOO_DIR / config_name
    env = dict(os.environ)
    env.setdefault("PROMPTFOO_PYTHON", sys.executable)
    env["PROMPTFOO_TRANSLATION_FIXTURES"] = str(fixtures_path)
    promptfoo_package = env.get("PROMPTFOO_NPX_PACKAGE", "promptfoo@latest").strip() or "promptfoo@latest"
    if npx_bin.is_absolute():
        env["PATH"] = f"{npx_bin.parent}:{env.get('PATH', '')}"
    npm_cache_dir = PROMPTFOO_DIR / ".npm-cache" / _slugify_runtime_label(runtime_label)
    npm_cache_dir.mkdir(parents=True, exist_ok=True)
    env["npm_config_cache"] = str(npm_cache_dir)
    print(f"Using Node runtime: {runtime_label}", file=sys.stderr)

    extra_args = list(args.promptfoo_args)
    if extra_args and extra_args[0] == "--":
        extra_args = extra_args[1:]

    command = [str(npx_bin), promptfoo_package, "eval", "-c", str(config_path), *extra_args]
    return subprocess.call(command, cwd=str(PROMPTFOO_DIR), env=env)


if __name__ == "__main__":
    raise SystemExit(main())
