from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import time

import pikepdf
from pikepdf import Name


@dataclass(frozen=True)
class XObjectSanitizeResult:
    changed: bool = False
    output_pdf_path: Path | None = None
    invalid_image_xobjects: int = 0
    pages_changed: int = 0
    elapsed_seconds: float = 0.0


def build_invalid_xobject_sanitized_pdf_copy(
    *,
    source_pdf_path: Path,
    output_pdf_path: Path,
) -> XObjectSanitizeResult:
    started = time.perf_counter()
    output_pdf_path.parent.mkdir(parents=True, exist_ok=True)
    pages_changed: set[int] = set()
    invalid_total = 0

    with pikepdf.Pdf.open(source_pdf_path) as pdf:
        empty_form = _make_empty_form_xobject(pdf)
        for page_idx, page in enumerate(pdf.pages):
            invalid_total += _sanitize_container_xobjects(
                pdf=pdf,
                container=page.obj,
                replacement=empty_form,
                page_idx=page_idx,
                pages_changed=pages_changed,
                seen=set(),
            )

        if invalid_total <= 0:
            output_pdf_path.unlink(missing_ok=True)
            return XObjectSanitizeResult(elapsed_seconds=time.perf_counter() - started)

        pdf.save(
            output_pdf_path,
            object_stream_mode=pikepdf.ObjectStreamMode.generate,
            compress_streams=True,
            recompress_flate=False,
        )

    elapsed = time.perf_counter() - started
    print(
        f"invalid xobject sanitize: replaced_images={invalid_total} pages={len(pages_changed)} "
        f"elapsed={elapsed:.2f}s output={output_pdf_path}",
        flush=True,
    )
    return XObjectSanitizeResult(
        changed=True,
        output_pdf_path=output_pdf_path,
        invalid_image_xobjects=invalid_total,
        pages_changed=len(pages_changed),
        elapsed_seconds=elapsed,
    )


def _make_empty_form_xobject(pdf: pikepdf.Pdf) -> pikepdf.Object:
    form = pdf.make_stream(b"")
    form[Name("/Type")] = Name("/XObject")
    form[Name("/Subtype")] = Name("/Form")
    form[Name("/BBox")] = pikepdf.Array([0, 0, 0, 0])
    return form


def _sanitize_container_xobjects(
    *,
    pdf: pikepdf.Pdf,
    container: pikepdf.Object,
    replacement: pikepdf.Object,
    page_idx: int,
    pages_changed: set[int],
    seen: set[tuple[int, int]],
) -> int:
    resources = _dict_get(container, Name("/Resources"))
    if resources is None:
        return 0
    xobjects = _dict_get(resources, Name("/XObject"))
    if xobjects is None:
        return 0

    invalid_total = 0
    for key, xobject in list(xobjects.items()):
        resolved = _resolve_object(xobject)
        if resolved is None:
            continue
        identity = _object_identity(resolved)
        if identity is not None:
            if identity in seen:
                continue
            seen.add(identity)

        subtype = _dict_get(resolved, Name("/Subtype"))
        if subtype == Name("/Image") and _invalid_image_xobject(resolved):
            xobjects[key] = replacement
            pages_changed.add(page_idx)
            invalid_total += 1
            continue

        if subtype == Name("/Form"):
            invalid_total += _sanitize_container_xobjects(
                pdf=pdf,
                container=resolved,
                replacement=replacement,
                page_idx=page_idx,
                pages_changed=pages_changed,
                seen=seen,
            )
    return invalid_total


def _invalid_image_xobject(xobject: pikepdf.Object) -> bool:
    width = _int_or_none(_dict_get(xobject, Name("/Width")))
    height = _int_or_none(_dict_get(xobject, Name("/Height")))
    return width is None or height is None or width <= 0 or height <= 0


def _dict_get(obj: object, key: pikepdf.Name) -> object | None:
    try:
        if hasattr(obj, "get"):
            return obj.get(key)
    except Exception:
        return None
    return None


def _resolve_object(obj: object) -> pikepdf.Object | None:
    try:
        if hasattr(obj, "get_object"):
            return obj.get_object()
        return obj  # type: ignore[return-value]
    except Exception:
        return None


def _object_identity(obj: object) -> tuple[int, int] | None:
    try:
        objgen = getattr(obj, "objgen")
        return int(objgen[0]), int(objgen[1])
    except Exception:
        return None


def _int_or_none(value: object) -> int | None:
    try:
        return int(value)  # type: ignore[arg-type]
    except Exception:
        return None


__all__ = [
    "XObjectSanitizeResult",
    "build_invalid_xobject_sanitized_pdf_copy",
]
