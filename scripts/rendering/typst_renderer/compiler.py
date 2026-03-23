from __future__ import annotations

import subprocess
from pathlib import Path

from common.config import ROOT_DIR, TYPST_DEFAULT_FONT_FAMILY
from rendering.typst_renderer.shared import TYPST_BIN
from rendering.typst_renderer.shared import TYPST_OVERLAY_DIR
from rendering.typst_renderer.source_builder import build_typst_book_background_source
from rendering.typst_renderer.source_builder import build_typst_book_overlay_source
from rendering.typst_renderer.source_builder import build_typst_overlay_source


def _typst_compile_command(typ_path: Path, pdf_path: Path, font_paths: list[Path] | None = None) -> list[str]:
    command = [TYPST_BIN, "compile"]
    for font_path in font_paths or []:
        command.extend(["--font-path", str(font_path)])
    command.extend([str(typ_path), str(pdf_path)])
    return command


def compile_typst_overlay_pdf(
    page_width: float,
    page_height: float,
    translated_items: list[dict],
    stem: str,
    font_family: str = TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
    work_dir: Path | None = None,
) -> Path:
    work_dir = work_dir or TYPST_OVERLAY_DIR
    work_dir.mkdir(parents=True, exist_ok=True)
    typ_path = work_dir / f"{stem}.typ"
    pdf_path = work_dir / f"{stem}.pdf"
    typ_path.write_text(
        build_typst_overlay_source(page_width, page_height, translated_items, font_family=font_family),
        encoding="utf-8",
    )
    proc = subprocess.run(_typst_compile_command(typ_path, pdf_path, font_paths), capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError((proc.stderr or proc.stdout).strip())
    return pdf_path


def compile_typst_book_overlay_pdf(
    page_specs: list[tuple[float, float, list[dict]]],
    stem: str,
    font_family: str = TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
    work_dir: Path | None = None,
) -> Path:
    work_dir = work_dir or TYPST_OVERLAY_DIR
    work_dir.mkdir(parents=True, exist_ok=True)
    typ_path = work_dir / f"{stem}.typ"
    pdf_path = work_dir / f"{stem}.pdf"
    typ_path.write_text(build_typst_book_overlay_source(page_specs, font_family=font_family), encoding="utf-8")
    proc = subprocess.run(_typst_compile_command(typ_path, pdf_path, font_paths), capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError((proc.stderr or proc.stdout).strip())
    return pdf_path


def compile_typst_book_background_pdf(
    source_pdf_path: Path,
    page_specs: list[tuple[int, float, float, list[dict]]],
    stem: str,
    font_family: str = TYPST_DEFAULT_FONT_FAMILY,
    font_paths: list[Path] | None = None,
    work_dir: Path | None = None,
) -> Path:
    work_dir = work_dir or TYPST_OVERLAY_DIR
    work_dir.mkdir(parents=True, exist_ok=True)
    typ_path = work_dir / f"{stem}.typ"
    pdf_path = work_dir / f"{stem}.pdf"
    typ_path.write_text(
        build_typst_book_background_source(source_pdf_path, page_specs, work_dir, font_family=font_family),
        encoding="utf-8",
    )
    command = [TYPST_BIN, "compile", "--root", str(ROOT_DIR)]
    for font_path in font_paths or []:
        command.extend(["--font-path", str(font_path)])
    command.extend([str(typ_path), str(pdf_path)])
    proc = subprocess.run(command, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError((proc.stderr or proc.stdout).strip())
    return pdf_path
