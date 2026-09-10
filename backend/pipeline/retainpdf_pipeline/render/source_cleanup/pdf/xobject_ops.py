from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

import fitz
import pikepdf
from pikepdf import Name

from retainpdf_pipeline.render.source_cleanup.pdf.pdf_math import PdfMatrix
from retainpdf_pipeline.render.source_cleanup.pdf.pdf_math import matrix_from_object
from retainpdf_pipeline.render.source_cleanup.pdf.pdf_math import mul_matrix


StreamRewrite = Callable[
    [
        pikepdf.Object,
        list[fitz.Rect],
        pikepdf.Pdf,
        list[fitz.Rect],
        bool,
        PdfMatrix,
        set[tuple[int, int]],
    ],
    tuple[bytes | None, int, int],
]


@dataclass(frozen=True)
class XObjectRewriteResult:
    operands: object
    removed: int = 0
    forms_changed: int = 0


def xobject_dict(container: pikepdf.Page | pikepdf.Object) -> object | None:
    try:
        resources = container.obj.get(Name("/Resources")) if isinstance(container, pikepdf.Page) else container.get(Name("/Resources"))
        if resources is None:
            return None
        return resources.get(Name("/XObject"))
    except Exception:
        return None


def rewrite_xobject_do(
    *,
    operands: object,
    xobjects: object | None,
    rects: list[fitz.Rect],
    pdf: pikepdf.Pdf | None,
    protected_rects: list[fitz.Rect],
    recurse_forms: bool,
    ctm: PdfMatrix,
    visited_forms: set[tuple[int, int]] | None,
    rewrite_stream: StreamRewrite,
) -> XObjectRewriteResult:
    form_context = _form_context(
        operands=operands,
        xobjects=xobjects,
        pdf=pdf,
        recurse_forms=recurse_forms,
        visited_forms=visited_forms,
    )
    if form_context is None:
        return XObjectRewriteResult(operands=operands)

    active_forms = form_context.visited_forms
    active_forms.add(form_context.form_key)
    try:
        return _rewrite_form_context(
            context=form_context,
            operands=operands,
            rects=rects,
            protected_rects=protected_rects,
            recurse_forms=recurse_forms,
            ctm=ctm,
            rewrite_stream=rewrite_stream,
        )
    finally:
        active_forms.remove(form_context.form_key)


@dataclass(frozen=True)
class _FormContext:
    pdf: pikepdf.Pdf
    xobjects: object
    xobject_name: object
    xobject: pikepdf.Object
    form_key: tuple[int, int]
    visited_forms: set[tuple[int, int]]


def _form_context(
    *,
    operands: object,
    xobjects: object | None,
    pdf: pikepdf.Pdf | None,
    recurse_forms: bool,
    visited_forms: set[tuple[int, int]] | None,
) -> _FormContext | None:
    if not recurse_forms or pdf is None or not operands or xobjects is None:
        return None
    xobject_name = operands[0]
    xobject = _lookup_xobject(xobjects, xobject_name)
    if xobject is None or not _is_form_xobject(xobject):
        return None
    form_key = _form_identity(xobject)
    active_forms = visited_forms if visited_forms is not None else set()
    if form_key in active_forms:
        return None
    return _FormContext(
        pdf=pdf,
        xobjects=xobjects,
        xobject_name=xobject_name,
        xobject=xobject,
        form_key=form_key,
        visited_forms=active_forms,
    )


def _rewrite_form_context(
    *,
    context: _FormContext,
    operands: object,
    rects: list[fitz.Rect],
    protected_rects: list[fitz.Rect],
    recurse_forms: bool,
    ctm: PdfMatrix,
    rewrite_stream: StreamRewrite,
) -> XObjectRewriteResult:
    cloned_xobject = _clone_form_xobject(context.pdf, context.xobject)
    form_matrix = matrix_from_object(context.xobject.get(Name("/Matrix"), []))
    form_content, form_removed, nested_forms_changed = rewrite_stream(
        cloned_xobject,
        rects,
        context.pdf,
        protected_rects,
        recurse_forms,
        mul_matrix(ctm, form_matrix),
        context.visited_forms,
    )
    if not form_content or form_removed <= 0:
        return XObjectRewriteResult(
            operands=operands,
            forms_changed=nested_forms_changed,
        )

    cloned_xobject.write(form_content)
    cloned_name = _install_cloned_xobject(
        context.xobjects,
        context.xobject_name,
        cloned_xobject,
    )
    return XObjectRewriteResult(
        operands=[cloned_name],
        removed=form_removed,
        forms_changed=nested_forms_changed + 1,
    )


def _lookup_xobject(xobjects: object, xobject_name: object) -> pikepdf.Object | None:
    try:
        return xobjects.get(xobject_name)
    except Exception:
        return None


def _is_form_xobject(xobject: pikepdf.Object) -> bool:
    try:
        return str(xobject.get(Name("/Subtype"))) == "/Form"
    except Exception:
        return False


def _form_identity(xobject: pikepdf.Object) -> tuple[int, int]:
    objgen = getattr(xobject, "objgen", None)
    return tuple(objgen) if objgen is not None else (id(xobject), 0)


def _clone_form_xobject(pdf: pikepdf.Pdf, xobject: pikepdf.Object) -> pikepdf.Object:
    clone = pdf.make_stream(xobject.read_bytes())
    for key, value in xobject.items():
        if key in {Name("/Length"), Name("/Filter"), Name("/DecodeParms")}:
            continue
        # 值为 PDF null 的键(如出版社图章 form 上的 `/StampId null`)按
        # 规范等同于键不存在;pikepdf 也拒绝把字典键设为 None,直接跳过。
        if value is None:
            continue
        if key == Name("/Resources"):
            clone[key] = _clone_resources(value)
        else:
            clone[key] = value
    return clone


def _clone_resources(resources: object) -> pikepdf.Dictionary:
    cloned = pikepdf.Dictionary()
    try:
        for key, value in resources.items():
            if value is None:
                continue
            if key == Name("/XObject"):
                cloned[key] = pikepdf.Dictionary(value)
            else:
                cloned[key] = value
    except Exception:
        return cloned
    return cloned


def _install_cloned_xobject(xobjects: object, original_name: object, cloned_xobject: pikepdf.Object) -> Name:
    cloned_name = _unique_xobject_name(xobjects, original_name)
    xobjects[cloned_name] = cloned_xobject
    return cloned_name


def _unique_xobject_name(xobjects: object, original_name: object) -> Name:
    base = str(original_name)
    if base.startswith("/"):
        base = base[1:]
    base = f"{base}_sc"
    index = 1
    while True:
        candidate = Name(f"/{base}{index}")
        try:
            if candidate not in xobjects:
                return candidate
        except Exception:
            return candidate
        index += 1
