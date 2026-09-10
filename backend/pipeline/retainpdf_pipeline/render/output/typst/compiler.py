from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path
from typing import Any

from retainpdf_pipeline.foundation.config import fonts
from retainpdf_pipeline.foundation.config import paths
from retainpdf_pipeline.render.layout.model.models import RenderPageSpec
from retainpdf_pipeline.render.output.typst.emitter import build_typst_source_from_page_specs
from retainpdf_pipeline.render.output.typst.shared import TYPST_BIN
from retainpdf_pipeline.render.output.typst.shared import TYPST_OVERLAY_DIR
from retainpdf_pipeline.render.output.typst.source_builder import build_typst_book_background_source
from retainpdf_pipeline.render.output.typst.source_builder import build_typst_book_overlay_source
from retainpdf_pipeline.render.output.typst.source_builder import build_typst_overlay_source

# Typst compiles can perform network I/O (downloading `@preview/...` packages from
# packages.typst.org) and a large book can legitimately take minutes to typeset, so the
# timeout is generous by default. Override with RETAIN_PDF_TYPST_COMPILE_TIMEOUT_SECONDS
# for environments with slower package mirrors or very large documents.
TYPST_COMPILE_TIMEOUT_SECONDS = float(
    os.environ.get("RETAIN_PDF_TYPST_COMPILE_TIMEOUT_SECONDS", "").strip() or 600
)


class TypstCompileError(RuntimeError):
    def __init__(
        self,
        *,
        phase: str,
        stem: str,
        typ_path: Path,
        pdf_path: Path,
        command: list[str],
        return_code: int,
        stdout: str,
        stderr: str,
        work_dir: Path | None = None,
        extra: dict[str, Any] | None = None,
    ) -> None:
        self.phase = phase
        self.stem = stem
        self.typ_path = Path(typ_path)
        self.pdf_path = Path(pdf_path)
        self.command = list(command)
        self.return_code = int(return_code)
        self.stdout = str(stdout or "")
        self.stderr = str(stderr or "")
        self.work_dir = Path(work_dir) if work_dir is not None else self.typ_path.parent
        self.extra = dict(extra or {})
        super().__init__(self._message())

    def _message(self) -> str:
        detail = (self.stderr or self.stdout).strip()
        prefix = (
            f"Typst compile failed phase={self.phase} stem={self.stem} "
            f"code={self.return_code} typ={self.typ_path}"
        )
        return f"{prefix}\n{detail}" if detail else prefix

    def to_dict(self) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "phase": self.phase,
            "stem": self.stem,
            "typ_path": str(self.typ_path),
            "pdf_path": str(self.pdf_path),
            "work_dir": str(self.work_dir),
            "command": list(self.command),
            "return_code": self.return_code,
            "stdout": self.stdout,
            "stderr": self.stderr,
            "message": str(self),
        }
        if self.extra:
            payload["extra"] = dict(self.extra)
        return payload


def _run_typst_compile(
    *,
    command: list[str],
    typ_path: Path,
    pdf_path: Path,
    phase: str,
    stem: str,
    work_dir: Path | None = None,
    extra: dict[str, Any] | None = None,
) -> None:
    try:
        proc = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=TYPST_COMPILE_TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired as exc:
        raise TypstCompileError(
            phase=phase,
            stem=stem,
            typ_path=typ_path,
            pdf_path=pdf_path,
            command=command,
            return_code=-1,
            stdout=str(exc.stdout or ""),
            stderr=(
                f"Typst compile timed out after {TYPST_COMPILE_TIMEOUT_SECONDS:.0f}s. "
                "This can happen when Typst stalls downloading a @preview package from "
                "packages.typst.org over a slow or stuck connection."
            ),
            work_dir=work_dir,
            extra={
                **(extra or {}),
                "runtime_error_type": type(exc).__name__,
                "timeout_seconds": TYPST_COMPILE_TIMEOUT_SECONDS,
            },
        ) from exc
    except OSError as exc:
        raise TypstCompileError(
            phase=phase,
            stem=stem,
            typ_path=typ_path,
            pdf_path=pdf_path,
            command=command,
            return_code=-1,
            stdout="",
            stderr=f"Typst runtime failed to start: {type(exc).__name__}: {exc}",
            work_dir=work_dir,
            extra={
                **(extra or {}),
                "runtime_error_type": type(exc).__name__,
                "typst_bin": command[0] if command else "",
            },
        ) from exc
    if proc.returncode != 0:
        raise TypstCompileError(
            phase=phase,
            stem=stem,
            typ_path=typ_path,
            pdf_path=pdf_path,
            command=command,
            return_code=proc.returncode,
            stdout=proc.stdout,
            stderr=proc.stderr,
            work_dir=work_dir,
            extra=extra,
        )


def _resolved_font_paths(font_paths: list[Path] | None = None) -> list[Path]:
    resolved: list[Path] = []
    # Prefer BACKEND_FONTS_DIRS (multiple dirs via RETAIN_PDF_FONTS_DIR), fallback to single BACKEND_FONTS_DIR
    backend_dirs: list[Path] = []
    if hasattr(fonts, "BACKEND_FONTS_DIRS"):
        backend_dirs = list(fonts.BACKEND_FONTS_DIRS)  # type: ignore[attr-defined]
    elif hasattr(fonts, "BACKEND_FONTS_DIR"):
        backend_dirs = [fonts.BACKEND_FONTS_DIR]  # type: ignore[attr-defined]
    for path in backend_dirs:
        if path not in resolved:
            resolved.append(Path(path))
    # RETAIN_PDF_TYPST_FONT_DIRS uses os.pathsep; also accept comma via RETAIN_PDF_FONTS_DIR for symmetry
    for env_name in ("RETAIN_PDF_TYPST_FONT_DIRS", "RETAIN_PDF_FONTS_DIR"):
        raw = os.environ.get(env_name, "").strip()
        if not raw:
            continue
        # Normalize both comma and pathsep to a common separator
        normalized = raw.replace(",", os.pathsep)
        for item in normalized.split(os.pathsep):
            value = item.strip()
            if value:
                path = Path(value)
                if path not in resolved:
                    resolved.append(path)
    for item in font_paths or []:
        if item not in resolved:
            resolved.append(item)
    return resolved


def _typst_compile_command(typ_path: Path, pdf_path: Path, font_paths: list[Path] | None = None) -> list[str]:
    command = [TYPST_BIN, "compile"]
    for font_path in _resolved_font_paths(font_paths):
        command.extend(["--font-path", str(font_path)])
    command.extend([str(typ_path), str(pdf_path)])
    return command


def _resolved_common_root(paths_to_cover: list[Path]) -> Path:
    normalized: list[str] = []
    fallback_root: Path | None = None
    for entry in paths_to_cover:
        path = Path(entry).resolve(strict=False)
        fallback_root = fallback_root or path.parent
        normalized.append(str(path))
    if not normalized:
        raise ValueError("paths_to_cover must not be empty")
    try:
        return Path(os.path.commonpath(normalized))
    except ValueError:
        return fallback_root or paths.ROOT_DIR


def compile_typst_overlay_pdf(
    page_width: float,
    page_height: float,
    translated_items: list[dict],
    stem: str,
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    include_cover_rect: bool = False,
    font_paths: list[Path] | None = None,
    work_dir: Path | None = None,
) -> Path:
    work_dir = work_dir or TYPST_OVERLAY_DIR
    work_dir.mkdir(parents=True, exist_ok=True)
    typ_path = work_dir / f"{stem}.typ"
    pdf_path = work_dir / f"{stem}.pdf"
    typ_path.write_text(
        build_typst_overlay_source(
            page_width,
            page_height,
            translated_items,
            font_family=font_family,
            include_cover_rect=include_cover_rect,
        ),
        encoding="utf-8",
    )
    command = _typst_compile_command(typ_path, pdf_path, font_paths)
    _run_typst_compile(
        command=command,
        typ_path=typ_path,
        pdf_path=pdf_path,
        phase="overlay_page",
        stem=stem,
        work_dir=work_dir,
        extra={"page_width": page_width, "page_height": page_height, "item_count": len(translated_items)},
    )
    return pdf_path


def compile_typst_book_overlay_pdf(
    page_specs: list[tuple[float, float, list[dict]]],
    stem: str,
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    include_cover_rect: bool = False,
    font_paths: list[Path] | None = None,
    work_dir: Path | None = None,
    prebuilt_source_path: Path | None = None,
) -> Path:
    work_dir = work_dir or TYPST_OVERLAY_DIR
    work_dir.mkdir(parents=True, exist_ok=True)
    typ_path = work_dir / f"{stem}.typ"
    pdf_path = work_dir / f"{stem}.pdf"
    if prebuilt_source_path is not None and Path(prebuilt_source_path).exists():
        # Byte-for-byte copy — no need to decode/re-encode a multi-MB source file.
        shutil.copyfile(prebuilt_source_path, typ_path)
    else:
        typ_path.write_text(
            build_typst_book_overlay_source(
                page_specs,
                font_family=font_family,
                include_cover_rect=include_cover_rect,
            ),
            encoding="utf-8",
        )
    command = _typst_compile_command(typ_path, pdf_path, font_paths)
    _run_typst_compile(
        command=command,
        typ_path=typ_path,
        pdf_path=pdf_path,
        phase="overlay_book",
        stem=stem,
        work_dir=work_dir,
        extra={"page_count": len(page_specs)},
    )
    return pdf_path


def compile_typst_book_background_pdf(
    source_pdf_path: Path,
    page_specs: list[tuple[int, float, float, list[dict]]],
    stem: str,
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
    work_dir: Path | None = None,
    prebuilt_source_path: Path | None = None,
) -> Path:
    work_dir = work_dir or TYPST_OVERLAY_DIR
    work_dir.mkdir(parents=True, exist_ok=True)
    typ_path = work_dir / f"{stem}.typ"
    pdf_path = work_dir / f"{stem}.pdf"
    if prebuilt_source_path is not None:
        typ_path.write_text(Path(prebuilt_source_path).read_text(encoding="utf-8"), encoding="utf-8")
    else:
        typ_path.write_text(
            build_typst_book_background_source(source_pdf_path, page_specs, work_dir, font_family=font_family),
            encoding="utf-8",
        )
    project_root = _resolved_common_root([typ_path, pdf_path, source_pdf_path])
    command = [TYPST_BIN, "compile", "--root", str(project_root)]
    for font_path in _resolved_font_paths(font_paths):
        command.extend(["--font-path", str(font_path)])
    command.extend([str(typ_path), str(pdf_path)])
    _run_typst_compile(
        command=command,
        typ_path=typ_path,
        pdf_path=pdf_path,
        phase="background_book",
        stem=stem,
        work_dir=work_dir,
        extra={
            "page_count": len(page_specs),
            "source_pdf_path": str(source_pdf_path),
            "project_root": str(project_root),
        },
    )
    return pdf_path


def compile_typst_render_pages_pdf(
    *,
    background_pdf_path: Path,
    page_specs: list[RenderPageSpec],
    stem: str,
    font_family: str = fonts.TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
    work_dir: Path | None = None,
    prebuilt_source_path: Path | None = None,
) -> Path:
    work_dir = work_dir or TYPST_OVERLAY_DIR
    work_dir.mkdir(parents=True, exist_ok=True)
    typ_path = work_dir / f"{stem}.typ"
    pdf_path = work_dir / f"{stem}.pdf"
    if prebuilt_source_path is not None:
        typ_path.write_text(Path(prebuilt_source_path).read_text(encoding="utf-8"), encoding="utf-8")
    else:
        typ_path.write_text(
            build_typst_source_from_page_specs(
                background_pdf_path=background_pdf_path,
                page_specs=page_specs,
                work_dir=work_dir,
                font_family=font_family,
            ),
            encoding="utf-8",
        )
    project_root = _resolved_common_root([typ_path, pdf_path, background_pdf_path])
    command = [TYPST_BIN, "compile", "--root", str(project_root)]
    for font_path in _resolved_font_paths(font_paths):
        command.extend(["--font-path", str(font_path)])
    command.extend([str(typ_path), str(pdf_path)])
    _run_typst_compile(
        command=command,
        typ_path=typ_path,
        pdf_path=pdf_path,
        phase="render_pages",
        stem=stem,
        work_dir=work_dir,
        extra={
            "page_count": len(page_specs),
            "background_pdf_path": str(background_pdf_path),
            "project_root": str(project_root),
        },
    )
    return pdf_path
