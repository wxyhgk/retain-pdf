from __future__ import annotations
import random
import string
from argparse import ArgumentParser
from argparse import Namespace
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from foundation.config.output_layout import ARTIFACTS_DIR_NAME
from foundation.config.output_layout import LOGS_DIR_NAME
from foundation.config.output_layout import OCR_DIR_NAME
from foundation.config.output_layout import RENDERED_DIR_NAME
from foundation.config.output_layout import SOURCE_DIR_NAME
from foundation.config.output_layout import TRANSLATED_DIR_NAME
from foundation.config.output_layout import TYPST_DIR_NAME


def build_job_id(now: datetime | None = None, random_length: int = 6) -> str:
    current = now or datetime.now()
    stamp = current.strftime("%Y%m%d%H%M%S")
    alphabet = string.ascii_lowercase + string.digits
    suffix = "".join(random.choice(alphabet) for _ in range(max(4, random_length)))
    return f"{stamp}-{suffix}"


@dataclass(frozen=True)
class JobDirs:
    root: Path
    source_dir: Path
    ocr_dir: Path
    translated_dir: Path
    rendered_dir: Path
    artifacts_dir: Path
    logs_dir: Path

    @property
    def origin_pdf_dir(self) -> Path:
        return self.source_dir

    @property
    def json_pdf_dir(self) -> Path:
        return self.ocr_dir

    @property
    def trans_pdf_dir(self) -> Path:
        return self.translated_dir

    @property
    def typst_dir(self) -> Path:
        return self.rendered_dir / TYPST_DIR_NAME


def resolve_job_dirs(root: Path) -> JobDirs:
    resolved_root = root.resolve()
    return JobDirs(
        root=resolved_root,
        source_dir=resolved_root / SOURCE_DIR_NAME,
        ocr_dir=resolved_root / OCR_DIR_NAME,
        translated_dir=resolved_root / TRANSLATED_DIR_NAME,
        rendered_dir=resolved_root / RENDERED_DIR_NAME,
        artifacts_dir=resolved_root / ARTIFACTS_DIR_NAME,
        logs_dir=resolved_root / LOGS_DIR_NAME,
    )


def locate_source_dir(root: Path) -> Path:
    return resolve_job_dirs(root).source_dir


def locate_ocr_dir(root: Path) -> Path:
    return resolve_job_dirs(root).ocr_dir


def locate_translated_dir(root: Path) -> Path:
    return resolve_job_dirs(root).translated_dir


def locate_rendered_dir(root: Path) -> Path:
    return resolve_job_dirs(root).rendered_dir


def locate_artifacts_dir(root: Path) -> Path:
    return resolve_job_dirs(root).artifacts_dir


def locate_logs_dir(root: Path) -> Path:
    return resolve_job_dirs(root).logs_dir


def locate_typst_dir(root: Path) -> Path:
    return resolve_job_dirs(root).typst_dir


def ensure_job_dirs(job_dirs: JobDirs) -> JobDirs:
    for path in (
        job_dirs.root,
        job_dirs.source_dir,
        job_dirs.ocr_dir,
        job_dirs.translated_dir,
        job_dirs.rendered_dir,
        job_dirs.artifacts_dir,
        job_dirs.logs_dir,
        job_dirs.typst_dir,
    ):
        path.mkdir(parents=True, exist_ok=True)
    return job_dirs


def create_job_dirs(output_root: Path, job_id: str | None = None) -> JobDirs:
    root = output_root / (job_id or build_job_id())
    return ensure_job_dirs(resolve_job_dirs(root))


def add_explicit_job_dir_args(parser: ArgumentParser, *, required: bool = True) -> None:
    parser.add_argument("--job-root", type=str, required=required, help="Absolute job root directory.")
    parser.add_argument("--source-dir", type=str, required=required, help="Absolute source directory under the job root.")
    parser.add_argument("--ocr-dir", type=str, required=required, help="Absolute OCR directory under the job root.")
    parser.add_argument(
        "--translated-dir",
        type=str,
        required=required,
        help="Absolute translated artifact directory under the job root.",
    )
    parser.add_argument(
        "--rendered-dir",
        type=str,
        required=required,
        help="Absolute rendered artifact directory under the job root.",
    )
    parser.add_argument(
        "--artifacts-dir",
        type=str,
        required=required,
        help="Absolute downloadable artifacts directory under the job root.",
    )
    parser.add_argument("--logs-dir", type=str, required=required, help="Absolute logs directory under the job root.")


def job_dirs_from_explicit_args(args: Namespace, *, require_existing: bool = True) -> JobDirs:
    expected = resolve_job_dirs(Path(args.job_root))
    provided = JobDirs(
        root=Path(args.job_root).resolve(),
        source_dir=Path(args.source_dir).resolve(),
        ocr_dir=Path(args.ocr_dir).resolve(),
        translated_dir=Path(args.translated_dir).resolve(),
        rendered_dir=Path(args.rendered_dir).resolve(),
        artifacts_dir=Path(args.artifacts_dir).resolve(),
        logs_dir=Path(args.logs_dir).resolve(),
    )
    if provided != expected:
        raise RuntimeError(
            "invalid job directory contract: expected "
            f"{expected} but received {provided}"
        )
    if require_existing:
        for path in (
            provided.root,
            provided.source_dir,
            provided.ocr_dir,
            provided.translated_dir,
            provided.rendered_dir,
            provided.artifacts_dir,
            provided.logs_dir,
        ):
            if not path.exists():
                raise RuntimeError(f"job directory does not exist: {path}")
    return provided
