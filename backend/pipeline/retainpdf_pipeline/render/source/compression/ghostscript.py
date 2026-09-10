from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path


# Ghostscript recompressing a large scanned/image-heavy PDF can legitimately take a
# while, so give it a generous timeout rather than letting a hung process block the job
# forever. Override with RETAIN_PDF_GHOSTSCRIPT_TIMEOUT_SECONDS if needed.
GHOSTSCRIPT_TIMEOUT_SECONDS = float(
    os.environ.get("RETAIN_PDF_GHOSTSCRIPT_TIMEOUT_SECONDS", "").strip() or 300
)


def compress_pdf_with_ghostscript_file(
    pdf_path: Path,
    *,
    dpi: int = 200,
) -> bool:
    if dpi <= 0:
        return False
    gs_bin = shutil.which("gs")
    if not gs_bin:
        return False
    if not pdf_path.exists():
        return False

    temp_path = pdf_path.with_name(f"{pdf_path.stem}.tmp-compressed.pdf")
    command = [
        gs_bin,
        "-sDEVICE=pdfwrite",
        "-dCompatibilityLevel=1.6",
        "-dNOPAUSE",
        "-dQUIET",
        "-dBATCH",
        "-dDetectDuplicateImages=true",
        "-dCompressFonts=true",
        "-dDownsampleColorImages=true",
        f"-dColorImageResolution={dpi}",
        "-dDownsampleGrayImages=true",
        f"-dGrayImageResolution={dpi}",
        "-dDownsampleMonoImages=false",
        f"-sOutputFile={temp_path}",
        str(pdf_path),
    ]
    try:
        try:
            proc = subprocess.run(
                command,
                capture_output=True,
                text=True,
                timeout=GHOSTSCRIPT_TIMEOUT_SECONDS,
            )
        except subprocess.TimeoutExpired:
            return False
        if proc.returncode != 0 or not temp_path.exists():
            if temp_path.exists():
                temp_path.unlink(missing_ok=True)
            return False
        temp_path.replace(pdf_path)
        return True
    finally:
        if temp_path.exists():
            temp_path.unlink(missing_ok=True)
