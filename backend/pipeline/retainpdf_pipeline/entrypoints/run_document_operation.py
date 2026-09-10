"""Execute one backend-prepared restricted page program workspace."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from pathlib import Path

try:  # POSIX resource limits; missing on Windows.
    import resource
except ImportError:  # pragma: no cover - Windows fallback
    resource = None  # type: ignore[assignment]


def _page_program_fns():
    # Lazy: retainpdf_ai lives outside the pipeline package (ai service).
    # Top-level import would break pipeline-only environments (tests, workers
    # without the ai service on PYTHONPATH) and the Windows import fallback.
    from retainpdf_ai.document_operations.page_program import execute_page_program
    from retainpdf_ai.document_operations.visual_validation import validate_page_program_visuals

    return execute_page_program, validate_page_program_visuals


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--program", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--result", required=True)
    parser.add_argument("--visual-validation", required=True)
    parser.add_argument("--limits", required=True)
    return parser


def _load_json(path: Path, label: str) -> dict:
    if path.is_symlink() or not path.is_file():
        raise ValueError(f"{label} must be a regular non-symlink file")
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"{label} must contain an object")  # noqa: TRY004
    return value


def _apply_limits(limits: dict) -> None:
    if resource is None:
        # Windows has no rlimits; run without process caps.
        return
    configured = [
        ("RLIMIT_CPU", int(limits["cpu_time_seconds"])),
        ("RLIMIT_FSIZE", int(limits["output_bytes"])),
        ("RLIMIT_NOFILE", int(limits["file_descriptor_count"])),
    ]
    if sys.platform.startswith("linux"):
        configured.extend(
            [
                ("RLIMIT_AS", int(limits["memory_bytes"])),
                ("RLIMIT_NPROC", int(limits["process_count"])),
            ]
        )
    for name, requested in configured:
        limit_id = getattr(resource, name, None)
        if limit_id is None:
            continue
        _soft, hard = resource.getrlimit(limit_id)
        value = requested if hard == resource.RLIM_INFINITY else min(requested, hard)
        resource.setrlimit(limit_id, (value, value))


def _write_result(path: Path, payload: dict) -> None:
    if path.is_symlink():
        raise ValueError("result path may not be a symlink")
    temporary = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    encoded = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        os.write(descriptor, encoded.encode("utf-8"))
        os.fsync(descriptor)
    finally:
        os.close(descriptor)
    os.replace(temporary, path)


def main() -> int:
    args = _parser().parse_args()
    source = Path(args.source).resolve()
    program_path = Path(args.program).resolve()
    output = Path(args.output).resolve()
    result_path = Path(args.result).resolve()
    visual_validation_path = Path(args.visual_validation).resolve()
    limits_path = Path(args.limits).resolve()
    workspace = source.parent.parent
    for target in (program_path, output, result_path, visual_validation_path, limits_path):
        if not target.is_relative_to(workspace):
            raise ValueError("executor path escaped the operation workspace")
    limits = _load_json(limits_path, "limits")
    _apply_limits(limits)
    try:
        execute_page_program, validate_page_program_visuals = _page_program_fns()
        program = _load_json(program_path, "program")
        report = execute_page_program(source, program, output)
        visual_report = validate_page_program_visuals(source, output, program)
        _write_result(visual_validation_path, visual_report)
        if not visual_report["valid"]:
            raise ValueError("candidate raster output does not match the approved page program")
        report["visual_validation_sha256"] = _sha256_file(visual_validation_path)
    except Exception as exc:  # noqa: BLE001 - terminal result must survive every worker failure
        _write_result(
            result_path,
            {
                "schema": "retainpdf_page_program_result_v1",
                "status": "failed",
                "error_code": "page_program_failed",
                "detail": str(exc)[:2000],
            },
        )
        return 1
    _write_result(result_path, report)
    return 0


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


if __name__ == "__main__":
    raise SystemExit(main())
