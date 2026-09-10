"""Interpreter for the restricted RetainPDF page program contract.

This module executes trusted operators over untrusted JSON data. It never
imports, evaluates, or executes model-provided code.
"""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Any

import pikepdf

PROGRAM_SCHEMA = "retainpdf_page_program_v1"
RESULT_SCHEMA = "retainpdf_page_program_result_v1"
MAX_STEPS = 32
MAX_PAGE_REFERENCES = 20_000


def canonical_program_bytes(program: dict[str, Any]) -> bytes:
    return json.dumps(
        program,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


def validate_page_program(program: object) -> dict[str, Any]:
    if not isinstance(program, dict):
        raise ValueError("program must be an object")  # noqa: TRY004
    if set(program) != {"schema", "steps"}:
        raise ValueError("program accepts only schema and steps")
    if program.get("schema") != PROGRAM_SCHEMA:
        raise ValueError("unsupported page program schema")
    steps = program.get("steps")
    if not isinstance(steps, list) or not 1 <= len(steps) <= MAX_STEPS:
        raise ValueError(f"steps must contain 1..{MAX_STEPS} items")
    page_references = 0
    for index, step in enumerate(steps):
        if not isinstance(step, dict):
            raise ValueError(f"steps[{index}] must be an object")  # noqa: TRY004
        operation = step.get("op")
        if operation == "select_pages":
            if set(step) != {"op", "pages"}:
                raise ValueError(f"steps[{index}] select_pages has unknown fields")
        elif operation == "rotate_pages":
            if set(step) != {"op", "pages", "degrees"}:
                raise ValueError(f"steps[{index}] rotate_pages has unknown fields")
            if step.get("degrees") not in {90, 180, 270}:
                raise ValueError(f"steps[{index}].degrees must be 90, 180, or 270")
        else:
            raise ValueError(f"steps[{index}].op is unsupported")
        pages = step.get("pages")
        if (
            not isinstance(pages, list)
            or not pages
            or not all(isinstance(page, int) and not isinstance(page, bool) and page > 0 for page in pages)
        ):
            raise ValueError(f"steps[{index}].pages must be non-empty positive integers")
        page_references += len(pages)
        if page_references > MAX_PAGE_REFERENCES:
            raise ValueError("page program contains too many page references")
    return program


def execute_page_program(
    source_path: Path,
    program: dict[str, Any],
    output_path: Path,
) -> dict[str, Any]:
    validate_page_program(program)
    _require_regular_file(source_path, "source PDF")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.is_symlink():
        raise ValueError("candidate output may not be a symlink")

    with pikepdf.open(source_path) as source:
        input_page_count = len(source.pages)
        if input_page_count == 0:
            raise ValueError("source PDF has no pages")
        working = build_page_plan(input_page_count, program)
        candidate = pikepdf.Pdf.new()
        for source_index, rotation in working:
            candidate.pages.append(source.pages[source_index])
            if rotation:
                target = candidate.pages[-1]
                inherited = int(target.obj.get("/Rotate", 0))
                target.obj["/Rotate"] = (inherited + rotation) % 360
        temporary = output_path.with_name(f".{output_path.name}.{os.getpid()}.tmp")
        try:
            candidate.save(temporary)
            os.replace(temporary, output_path)
        finally:
            temporary.unlink(missing_ok=True)

    output_bytes = output_path.stat().st_size
    output_sha256 = _sha256_file(output_path)
    return {
        "schema": RESULT_SCHEMA,
        "status": "completed",
        "input_page_count": input_page_count,
        "output_page_count": len(working),
        "output_bytes": output_bytes,
        "candidate_pdf_sha256": output_sha256,
        "program_sha256": hashlib.sha256(canonical_program_bytes(program)).hexdigest(),
    }


def build_page_plan(
    input_page_count: int,
    program: dict[str, Any],
) -> list[tuple[int, int]]:
    """Return (zero-based source page, added clockwise rotation) per output page."""

    validate_page_program(program)
    if input_page_count <= 0:
        raise ValueError("source PDF has no pages")
    working: list[tuple[int, int]] = [(index, 0) for index in range(input_page_count)]
    for step_index, step in enumerate(program["steps"]):
        pages = step["pages"]
        for page in pages:
            if page > len(working):
                raise ValueError(
                    f"steps[{step_index}] page {page} is out of bounds for {len(working)} pages"
                )
        if step["op"] == "select_pages":
            working = [working[page - 1] for page in pages]
            continue
        degrees = int(step["degrees"])
        selected = set(pages)
        working = [
            (source_index, (rotation + degrees) % 360)
            if position in selected
            else (source_index, rotation)
            for position, (source_index, rotation) in enumerate(working, start=1)
        ]
    if not working:
        raise ValueError("page program produced an empty document")
    return working


def _require_regular_file(path: Path, label: str) -> None:
    if path.is_symlink() or not path.is_file():
        raise ValueError(f"{label} must be a regular non-symlink file")


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()
