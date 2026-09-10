from __future__ import annotations

import os
import shlex
import subprocess
from pathlib import Path
from types import SimpleNamespace

from retainpdf_pipeline.foundation.shared.job_dirs import job_dirs_from_explicit_args
from retainpdf_pipeline.ocr.document_schema import DOCUMENT_SCHEMA_REPORT_FILE_NAME
from retainpdf_pipeline.ocr.document_schema import adapt_path_to_document_v1_with_report
from retainpdf_pipeline.ocr.document_schema import validate_saved_document_path
from retainpdf_pipeline.ocr.document_schema.providers import PROVIDER_GENERIC_FLAT_OCR
from retainpdf_pipeline.ocr.ocr_provider.types import OcrProviderResult
from retainpdf_pipeline.services.pipeline_shared.events import emit_stage_progress
from retainpdf_pipeline.services.pipeline_shared.io import save_json

LOCAL_OCR_COMMAND_ENV = "RETAIN_LOCAL_OCR_COMMAND"
LOCAL_OCR_RAW_PROVIDER_ENV = "RETAIN_OCR_RAW_PROVIDER"
LOCAL_OCR_COMMAND_TIMEOUT_ENV = "RETAIN_LOCAL_OCR_COMMAND_TIMEOUT_SECONDS"

# A local OCR command can run a full document through a model, which may take a while
# for large/multi-page books; default generously and let deployments override for their
# own hardware/model. Override with RETAIN_LOCAL_OCR_COMMAND_TIMEOUT_SECONDS.
DEFAULT_LOCAL_OCR_COMMAND_TIMEOUT_SECONDS = 1800.0


def run_local_command_ocr_to_job_dir(args: SimpleNamespace) -> OcrProviderResult:
    provider_name = str(getattr(args, "provider", "") or "local").strip().lower() or "local"
    provider_kind = str(getattr(args, "ocr_provider_kind", "") or "").strip().lower()
    command = _configured_text(
        args,
        "local_ocr_command",
        "command",
        env_name=LOCAL_OCR_COMMAND_ENV,
    )
    if not command:
        raise RuntimeError(f"local OCR provider requires {LOCAL_OCR_COMMAND_ENV}")

    source_pdf_path = Path(str(args.file_path or "")).resolve() if str(args.file_path or "").strip() else None
    source_url = str(getattr(args, "file_url", "") or "").strip()
    if source_pdf_path is not None and not source_pdf_path.exists():
        raise RuntimeError(
            f"local OCR provider requires an existing local file_path: {source_pdf_path}"
        )
    if source_pdf_path is None and not source_url:
        raise RuntimeError("command OCR provider requires file_path or file_url")

    job_dirs = job_dirs_from_explicit_args(args)
    provider_result_json_path = job_dirs.ocr_dir / "result.json"
    normalized_json_path = job_dirs.ocr_dir / "normalized" / "document.v1.json"
    normalized_report_json_path = job_dirs.ocr_dir / "normalized" / DOCUMENT_SCHEMA_REPORT_FILE_NAME
    provider_raw_dir = job_dirs.ocr_dir / "local_raw"
    raw_payload_json_path = provider_raw_dir / "payload.json"
    normalized_json_path.parent.mkdir(parents=True, exist_ok=True)
    provider_result_json_path.parent.mkdir(parents=True, exist_ok=True)
    provider_raw_dir.mkdir(parents=True, exist_ok=True)

    env = os.environ.copy()
    raw_provider = _configured_text(
        args,
        "local_ocr_raw_provider",
        "raw_provider",
        env_name=LOCAL_OCR_RAW_PROVIDER_ENV,
        env=env,
    )
    credential = str(getattr(args, "ocr_credential", "") or "").strip()
    env.update(
        {
            "RETAIN_OCR_PROVIDER": provider_name,
            "RETAIN_OCR_PROVIDER_KIND": provider_kind,
            "RETAIN_OCR_CREDENTIAL": credential,
            "RETAIN_OCR_SOURCE_PDF": str(source_pdf_path or ""),
            "RETAIN_OCR_SOURCE_URL": source_url,
            "RETAIN_OCR_JOB_ROOT": str(job_dirs.root),
            "RETAIN_OCR_SOURCE_DIR": str(job_dirs.source_dir),
            "RETAIN_OCR_DIR": str(job_dirs.ocr_dir),
            "RETAIN_OCR_PROVIDER_RESULT_JSON": str(provider_result_json_path),
            "RETAIN_OCR_NORMALIZED_DOCUMENT_JSON": str(normalized_json_path),
            "RETAIN_OCR_NORMALIZATION_REPORT_JSON": str(normalized_report_json_path),
            "RETAIN_OCR_PROVIDER_RAW_DIR": str(provider_raw_dir),
            "RETAIN_OCR_RAW_PAYLOAD_JSON": str(raw_payload_json_path),
            "RETAIN_OCR_RAW_PROVIDER": raw_provider,
        }
    )

    timeout_seconds = _configured_timeout_seconds(args)
    try:
        command_argv = shlex.split(command)
    except ValueError as exc:
        raise RuntimeError(f"local OCR provider command could not be parsed: {exc}") from exc
    if not command_argv:
        raise RuntimeError("local OCR provider command must not be empty")

    emit_stage_progress(
        stage="ocr_processing",
        substage="local_provider",
        message="正在执行本地 OCR provider",
        stage_detail="正在执行本地 OCR provider",
        provider=provider_name,
    )
    try:
        completed = subprocess.run(
            command_argv,
            shell=False,
            cwd=str(job_dirs.root),
            env=env,
            text=True,
            capture_output=True,
            check=False,
            timeout=timeout_seconds,
        )
    except subprocess.TimeoutExpired as exc:
        timeout_stdout = str(exc.stdout or "")
        timeout_stderr = str(exc.stderr or "")
        if timeout_stdout:
            print(timeout_stdout, end="" if timeout_stdout.endswith("\n") else "\n", flush=True)
        if timeout_stderr:
            print(timeout_stderr, end="" if timeout_stderr.endswith("\n") else "\n", flush=True)
        raise RuntimeError(
            f"local OCR provider command timed out after {timeout_seconds:.0f}s"
        ) from exc
    if completed.stdout:
        print(
            completed.stdout,
            end="" if completed.stdout.endswith("\n") else "\n",
            flush=True,
        )
    if completed.stderr:
        print(
            completed.stderr,
            end="" if completed.stderr.endswith("\n") else "\n",
            flush=True,
        )
    if completed.returncode != 0:
        raise RuntimeError(f"local OCR provider command failed with exit code {completed.returncode}")
    source_pdf_path = _resolve_command_source_pdf(source_pdf_path, job_dirs.source_dir)
    if not normalized_json_path.exists():
        _materialize_normalized_document_from_local_raw(
            normalized_json_path=normalized_json_path,
            normalized_report_json_path=normalized_report_json_path,
            raw_payload_json_path=raw_payload_json_path,
            provider_result_json_path=provider_result_json_path,
            raw_provider=raw_provider,
            document_id=job_dirs.root.name,
        )

    validation = validate_saved_document_path(normalized_json_path)
    if not normalized_report_json_path.exists():
        save_json(
            normalized_report_json_path,
            {
                "provider": "local",
                "detected_provider": "local",
                "provider_was_explicit": True,
                "validation": validation,
            },
        )
    if not provider_result_json_path.exists():
        save_json(
            provider_result_json_path,
            {
                "provider": "local",
                "provider_key": provider_name,
                "source_pdf": str(source_pdf_path),
                "normalized_document_json": str(normalized_json_path),
            },
        )

    emit_stage_progress(
        stage="ocr_processing",
        substage="local_provider",
        message="本地 OCR provider 已完成",
        stage_detail="本地 OCR provider 已完成",
        provider=provider_name,
        progress_current=validation.get("page_count"),
        progress_total=validation.get("page_count"),
        payload={"progress_unit": "page"},
    )
    return OcrProviderResult(
        job_dirs=job_dirs,
        source_pdf_path=source_pdf_path,
        provider_result_json_path=provider_result_json_path,
        normalized_json_path=normalized_json_path,
        normalized_report_json_path=normalized_report_json_path,
        provider_raw_dir=provider_raw_dir,
        raw_main_payload_path=raw_payload_json_path if raw_payload_json_path.exists() else provider_result_json_path,
    )


def _configured_text(
    args: SimpleNamespace,
    *names: str,
    env_name: str,
    env: dict[str, str] | None = None,
) -> str:
    for name in names:
        value = str(getattr(args, name, "") or "").strip()
        if value:
            return value
    source_env = env if env is not None else os.environ
    return str(source_env.get(env_name, "") or "").strip()


def _configured_timeout_seconds(args: SimpleNamespace) -> float:
    raw = _configured_text(
        args,
        "local_ocr_command_timeout_seconds",
        env_name=LOCAL_OCR_COMMAND_TIMEOUT_ENV,
    )
    if not raw:
        return DEFAULT_LOCAL_OCR_COMMAND_TIMEOUT_SECONDS
    try:
        value = float(raw)
    except ValueError:
        return DEFAULT_LOCAL_OCR_COMMAND_TIMEOUT_SECONDS
    return value if value > 0 else DEFAULT_LOCAL_OCR_COMMAND_TIMEOUT_SECONDS


def _resolve_command_source_pdf(source_pdf_path: Path | None, source_dir: Path) -> Path:
    if source_pdf_path is not None:
        return source_pdf_path
    candidates = sorted(
        (path for path in source_dir.glob("*.pdf") if path.is_file()),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    if candidates:
        return candidates[0].resolve()
    raise RuntimeError(
        "remote command OCR provider must materialize a source PDF under "
        f"{source_dir} when source.file_url is used"
    )


def _materialize_normalized_document_from_local_raw(
    *,
    normalized_json_path: Path,
    normalized_report_json_path: Path,
    raw_payload_json_path: Path,
    provider_result_json_path: Path,
    raw_provider: str,
    document_id: str,
) -> None:
    source_json_path = raw_payload_json_path if raw_payload_json_path.exists() else provider_result_json_path
    if not source_json_path.exists():
        raise RuntimeError(
            "local OCR provider must write either normalized document or raw payload: "
            f"{normalized_json_path} / {raw_payload_json_path}"
        )
    provider = raw_provider or PROVIDER_GENERIC_FLAT_OCR
    document, report = adapt_path_to_document_v1_with_report(
        source_json_path=source_json_path,
        document_id=document_id,
        provider=provider,
        provider_version="local",
        allow_provider_mismatch=True,
    )
    save_json(normalized_json_path, document)
    save_json(normalized_report_json_path, report)
    if not provider_result_json_path.exists() and source_json_path != provider_result_json_path:
        save_json(
            provider_result_json_path,
            {
                "provider": "local",
                "raw_provider": provider,
                "raw_payload_json": str(source_json_path),
                "normalized_document_json": str(normalized_json_path),
            },
        )


__all__ = [
    "LOCAL_OCR_COMMAND_ENV",
    "LOCAL_OCR_RAW_PROVIDER_ENV",
    "run_local_command_ocr_to_job_dir",
]
