from __future__ import annotations

import argparse
import json
import os
import platform
import shlex
import subprocess
import tempfile
from pathlib import Path


CMARKER_VERSION = "0.1.8"
MITEX_VERSION = "0.2.6"
OUTPUT_LIMIT = 2_000


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate the generated desktop bundle manifest.",
    )
    parser.add_argument(
        "--manifest",
        type=Path,
        required=True,
        help="Path to frontend/desktop/app/backend/bundle-manifest.json",
    )
    parser.add_argument(
        "--min-fonts",
        type=int,
        default=3,
        help="Minimum number of bundled fonts expected in the manifest.",
    )
    return parser.parse_args()


def require(condition: bool, message: str) -> None:
    if not condition:
        raise RuntimeError(message)


def command_text(command: list[str]) -> str:
    return " ".join(shlex.quote(part) for part in command)


def output_summary(value: str) -> str:
    value = value.strip()
    if not value:
        return "<empty>"
    if len(value) <= OUTPUT_LIMIT:
        return value
    return f"{value[:OUTPUT_LIMIT]}... <truncated {len(value) - OUTPUT_LIMIT} chars>"


def run_checked(command: list[str], *, env: dict[str, str], cwd: Path) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        command,
        cwd=cwd,
        env=env,
        text=True,
        encoding="utf-8",
        errors="replace",
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(
            "command failed while validating desktop Typst bundle\n"
            f"command: {command_text(command)}\n"
            f"exit code: {result.returncode}\n"
            f"stdout: {output_summary(result.stdout)}\n"
            f"stderr: {output_summary(result.stderr)}"
        )
    return result


def is_windows_bundle(payload: dict[str, object]) -> bool:
    target = str(payload.get("targetPlatformName") or payload.get("targetPlatform") or "").lower()
    if target:
        return target in {"windows", "win32"}
    return platform.system() == "Windows"


def typst_executable(backend_root: Path, payload: dict[str, object]) -> Path:
    name = "typst.exe" if is_windows_bundle(payload) else "typst"
    candidate = backend_root / "typst" / "bin" / name
    require(candidate.is_file(), f"bundled Typst executable missing: {candidate}")
    return candidate


def validate_backend_binary(
    backend_root: Path,
    payload: dict[str, object],
    *,
    bundled_field: str,
    name_field: str,
    label: str,
) -> None:
    require(payload.get(bundled_field) is True, f"bundle manifest missing {label}")
    name = str(payload.get(name_field) or "").strip()
    require(bool(name) and Path(name).name == name, f"bundle manifest has invalid {label} name")
    binary = backend_root / "bin" / name
    require(binary.is_file(), f"bundled {label} missing: {binary}")
    if not is_windows_bundle(payload):
        require(os.access(binary, os.X_OK), f"bundled {label} is not executable: {binary}")


def validate_pipeline_command(backend_root: Path, payload: dict[str, object]) -> None:
    # Transitional check: a missing wrapper only warns so legacy bundles
    # (script entrypoint fallback) still validate during migration.
    command_rel = str(payload.get("pipelineCommand") or "").strip()
    if not command_rel:
        print("warning: bundle manifest missing pipelineCommand; console mode unavailable (script fallback)")
        return
    command_bin = backend_root / command_rel
    if not command_bin.is_file():
        print(f"warning: bundled pipeline command missing: {command_bin} (script fallback)")
        return
    if not is_windows_bundle(payload) and not os.access(command_bin, os.X_OK):
        print(f"warning: bundled pipeline command is not executable: {command_bin}")
        return
    try:
        if is_windows_bundle(payload) and command_bin.suffix.lower() in {".cmd", ".bat"}:
            probe_cmd = ["cmd", "/c", str(command_bin), "--help"]
        else:
            probe_cmd = [str(command_bin), "--help"]
        result = subprocess.run(
            probe_cmd,
            cwd=backend_root,
            text=True,
            encoding="utf-8",
            errors="replace",
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=60,
            check=False,
        )
    except Exception as exc:  # noqa: BLE001 - warn-only transitional probe
        print(f"warning: bundled pipeline command --help probe failed: {exc} (script fallback)")
        return
    if result.returncode != 0:
        print(
            "warning: bundled pipeline command --help probe failed\n"
            f"exit code: {result.returncode}\n"
            f"stdout: {output_summary(result.stdout)}\n"
            f"stderr: {output_summary(result.stderr)}\n"
            "(script fallback)"
        )
        return
    print(f"pipeline command probe OK: {command_bin}")


def validate_typst_bundle(backend_root: Path, payload: dict[str, object]) -> None:
    typst_bin = typst_executable(backend_root, payload)
    fonts_root = backend_root / "fonts"
    packages_root = backend_root / "typst-packages"
    require(fonts_root.is_dir(), f"bundled fonts directory missing: {fonts_root}")
    require(
        (fonts_root / "LICENSE-OFL-1.1.txt").is_file(),
        "bundled Source Han Serif license missing",
    )
    require(packages_root.is_dir(), f"bundled Typst packages directory missing: {packages_root}")

    env = os.environ.copy()
    env["TYPST_PACKAGE_PATH"] = str(packages_root)

    run_checked([str(typst_bin), "--version"], env=env, cwd=backend_root)

    source = f"""#import "@preview/cmarker:{CMARKER_VERSION}"
#import "@preview/mitex:{MITEX_VERSION}": mitex
#set text(font: "Source Han Serif SC", lang: "zh")

= RetainPDF Typst smoke

中文字体校验：你好，世界。

内置数学公式：$ integral_0^1 x^2 dif x = 1/3 $

#cmarker.render("**Markdown** package smoke with math: $E = mc^2 + \\\\frac{{a}}{{b}}$", math: mitex)
"""

    with tempfile.TemporaryDirectory(prefix="retainpdf-typst-smoke-") as tmp:
        tmp_root = Path(tmp)
        input_path = tmp_root / "smoke.typ"
        output_path = tmp_root / "smoke.pdf"
        input_path.write_text(source, encoding="utf-8")
        command = [
            str(typst_bin),
            "compile",
            "--font-path",
            str(fonts_root),
            str(input_path),
            str(output_path),
        ]
        run_checked(command, env=env, cwd=backend_root)
        require(output_path.is_file() and output_path.stat().st_size > 0, f"Typst smoke output missing: {output_path}")


def main() -> None:
    args = parse_args()
    manifest_path = args.manifest.resolve()
    backend_root = manifest_path.parent
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))

    validate_backend_binary(
        backend_root,
        payload,
        bundled_field="rustApiBinaryBundled",
        name_field="rustApiBinaryName",
        label="Rust API binary",
    )
    validate_backend_binary(
        backend_root,
        payload,
        bundled_field="jobsdBinaryBundled",
        name_field="jobsdBinaryName",
        label="jobsd binary",
    )
    validate_backend_binary(
        backend_root,
        payload,
        bundled_field="agentBinaryBundled",
        name_field="agentBinaryName",
        label="agent binary",
    )
    require(payload.get("providerConfigBundled") is True, "bundle manifest missing provider config")
    require(
        bool(str(payload.get("servicesSourceRevision") or "").strip()),
        "bundle manifest missing backend source revision",
    )
    require(
        (backend_root / "config" / "ocr_providers.json").is_file(),
        "bundled provider config missing",
    )
    require(payload.get("pythonBundled") is True, "bundle manifest missing bundled Python runtime")
    require(payload.get("typstBundled") is True, "bundle manifest missing Typst runtime")
    require(payload.get("typstPackagesBundled") is True, "bundle manifest missing Typst packages")
    require(bool(payload.get("bundledPythonImportCheck")), "bundle manifest missing Python import check result")
    if payload.get("targetPlatformName") == "mac":
        require(bool(payload.get("bundledPythonHome")), "mac bundle manifest missing Python framework home")

    bundled_fonts = payload.get("bundledFonts") or []
    require(
        isinstance(bundled_fonts, list) and len(bundled_fonts) >= args.min_fonts,
        "bundle manifest missing bundled fonts",
    )

    validate_pipeline_command(backend_root, payload)
    validate_typst_bundle(backend_root, payload)

    print(f"desktop bundle manifest OK: {manifest_path}")


if __name__ == "__main__":
    main()
