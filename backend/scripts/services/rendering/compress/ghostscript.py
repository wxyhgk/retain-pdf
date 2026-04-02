from __future__ import annotations

import shutil
import subprocess
from pathlib import Path


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
        proc = subprocess.run(command, capture_output=True, text=True)
        if proc.returncode != 0 or not temp_path.exists():
            if temp_path.exists():
                temp_path.unlink(missing_ok=True)
            return False
        temp_path.replace(pdf_path)
        return True
    finally:
        if temp_path.exists():
            temp_path.unlink(missing_ok=True)
