from __future__ import annotations

import json
import os
import secrets
import subprocess
from pathlib import Path
from typing import Any

from .contracts import LiveE2EError

SCRIPT_DIR = Path(__file__).resolve().parent.parent
PRODUCT_ROOT = Path(__file__).resolve().parents[4]
SERVICES_ROOT = PRODUCT_ROOT / "backend"
DEFAULT_FIXTURE = (
    PRODUCT_ROOT
    / "backend"
    / "packages"
    / "retain-data"
    / "src"
    / "ocr_provider"
    / "paddle"
    / "paddle_ocr_json_split.pdf"
)


def multipart_pdf(path: Path) -> tuple[bytes, str]:
    if not path.is_file() or path.suffix.lower() != ".pdf":
        raise LiveE2EError("fixture must be a readable PDF file")
    boundary = f"retainpdf-live-{secrets.token_hex(16)}"
    prefix = (
        f"--{boundary}\r\n"
        'Content-Disposition: form-data; name="file"; '
        'filename="retainpdf-live-fixture.pdf"\r\n'
        "Content-Type: application/pdf\r\n\r\n"
    ).encode()
    suffix = f"\r\n--{boundary}--\r\n".encode()
    return (
        prefix + path.read_bytes() + suffix,
        f"multipart/form-data; boundary={boundary}",
    )


def operation_id(data_root: Path) -> str:
    operations = data_root / "operations"
    candidates = (
        sorted(
            path.name
            for path in operations.iterdir()
            if path.is_dir() and path.name.startswith("op-")
        )
        if operations.is_dir()
        else []
    )
    if len(candidates) != 1:
        raise LiveE2EError(
            f"expected exactly one durable document operation, found {len(candidates)}"
        )
    return candidates[0]


def verify_candidate(
    data_root: Path,
    operation: dict[str, Any],
    source_pdf: Path = DEFAULT_FIXTURE,
) -> dict[str, Any]:
    if operation.get("status") != "committed":
        raise LiveE2EError(
            f"document operation ended in {operation.get('status') or 'unknown'} instead of committed"
        )
    candidate = operation.get("candidate_version")
    if not isinstance(candidate, dict) or candidate.get("status") != "committed":
        raise LiveE2EError("committed operation has no committed candidate version")
    artifact_key = str(candidate.get("artifact_key") or "")
    candidate_path = (data_root / artifact_key).resolve()
    if not artifact_key or not candidate_path.is_relative_to(data_root.resolve()):
        raise LiveE2EError("candidate artifact escaped the isolated data root")
    if not candidate_path.is_file():
        raise LiveE2EError("candidate PDF is missing")
    python = (
        SERVICES_ROOT
        / ".venv"
        / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    )
    if not python.is_file():
        raise LiveE2EError("backend Python environment is missing")
    script = (
        "import json,pikepdf,sys;"
        "candidate=pikepdf.open(sys.argv[1]);source=pikepdf.open(sys.argv[2]);"
        "shape=lambda pdf:{'pages':len(pdf.pages),'rotations':[int(p.get('/Rotate',0))%360 for p in pdf.pages]};"
        "print(json.dumps({'candidate':shape(candidate),'source':shape(source)}))"
    )
    completed = subprocess.run(
        [str(python), "-c", script, str(candidate_path), str(source_pdf)],
        cwd=PRODUCT_ROOT,
        check=False,
        capture_output=True,
        text=True,
        timeout=30,
    )
    try:
        details = json.loads(completed.stdout)
    except json.JSONDecodeError as exc:
        raise LiveE2EError("candidate PDF verifier returned invalid output") from exc
    source = details.get("source") or {}
    candidate_details = details.get("candidate") or {}
    source_rotations = source.get("rotations") or []
    expected = {
        "pages": int(source.get("pages") or 0) + 1,
        "rotations": (
            [source_rotations[0], (int(source_rotations[0]) + 90) % 360]
            + list(source_rotations[1:])
            if source_rotations
            else []
        ),
    }
    if completed.returncode != 0 or candidate_details != expected:
        raise LiveE2EError("candidate PDF did not match the requested page program")
    return {
        "artifact_key": artifact_key,
        "content_sha256": str(candidate.get("content_sha256") or ""),
        **candidate_details,
    }
