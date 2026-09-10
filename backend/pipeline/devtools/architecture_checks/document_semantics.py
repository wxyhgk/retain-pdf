from __future__ import annotations

import ast
from pathlib import Path

from devtools.architecture_checks.common import PACKAGE_ROOT
from devtools.architecture_checks.common import imported_modules
from devtools.architecture_checks.common import module_allowed
from devtools.architecture_checks.common import parse_python_file
from devtools.architecture_checks.common import display_path
from devtools.architecture_checks.common import scan_py_files


TRANSLATION_ROOT = PACKAGE_ROOT / "translate"
RENDERING_ROOT = PACKAGE_ROOT / "render"

LEGACY_SEMANTICS_FACADE = "retainpdf_pipeline.ocr.document_schema.semantics"
LEGACY_COMPAT_MODULE = "retainpdf_pipeline.ocr.document_schema.legacy_compat"
DECISION_DIFF_MODULE = "retainpdf_pipeline.ocr.document_schema.decision_diff"

LEGACY_COMPAT_IMPORTERS = {
    TRANSLATION_ROOT / "core" / "item_reader.py",
    TRANSLATION_ROOT / "core" / "ocr" / "json_extractor.py",
    RENDERING_ROOT / "semantics" / "legacy_compat.py",
}
LEGACY_FIELD_NAMES = frozenset(
    {
        "derived",
        "normalized_sub_type",
        "raw_block_type",
        "raw_label",
        "sub_type",
        "tags",
    }
)
LEGACY_FIELD_READERS = {
    TRANSLATION_ROOT / "core" / "item_reader.py",
    TRANSLATION_ROOT / "core" / "payload" / "parts" / "units.py",
    TRANSLATION_ROOT / "core" / "payload" / "template_records.py",
    TRANSLATION_ROOT / "services" / "agents" / "review_artifact.py",
    # Verbatim local copies of ocr readers (stage decoupling): same fields,
    # same boundaries, no new semantics.
    TRANSLATION_ROOT / "core" / "legacy_compat.py",
    TRANSLATION_ROOT / "core" / "ocr" / "normalized_reader.py",
    RENDERING_ROOT / "semantics" / "legacy_compat.py",
    RENDERING_ROOT / "source" / "prewarm_fingerprint.py",
    RENDERING_ROOT / "semantics" / "document_reader.py",
    RENDERING_ROOT / "semantics" / "legacy_aliases.py",
    RENDERING_ROOT / "workflow" / "item_reader.py",
    RENDERING_ROOT / "workflow" / "translation_records.py",
}


def _constant_string(node: ast.AST | None) -> str:
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    return ""


def _legacy_field_reads(path: Path) -> set[str]:
    fields: set[str] = set()
    for node in ast.walk(parse_python_file(path)):
        if isinstance(node, ast.Call):
            if (
                isinstance(node.func, ast.Attribute)
                and node.func.attr == "get"
                and node.args
            ):
                field = _constant_string(node.args[0])
                if field in LEGACY_FIELD_NAMES:
                    fields.add(field)
            elif (
                isinstance(node.func, ast.Name)
                and node.func.id == "getattr"
                and len(node.args) >= 2
            ):
                field = _constant_string(node.args[1])
                if field in LEGACY_FIELD_NAMES:
                    fields.add(field)
        elif isinstance(node, ast.Subscript):
            field = _constant_string(node.slice)
            if field in LEGACY_FIELD_NAMES:
                fields.add(field)
    return fields


def check_document_semantic_boundaries(errors: list[str]) -> None:
    """Keep canonical document decisions separate from legacy projections."""

    for root in (TRANSLATION_ROOT, RENDERING_ROOT):
        for path in scan_py_files(root):
            modules = imported_modules(path)
            if any(module_allowed(module, (LEGACY_SEMANTICS_FACADE,)) for module in modules):
                errors.append(
                    f"{display_path(path)}: production consumers must use canonical_semantics or an explicit compatibility boundary, not document_schema.semantics"
                )
            if path not in LEGACY_COMPAT_IMPORTERS and any(
                module_allowed(module, (LEGACY_COMPAT_MODULE,)) for module in modules
            ):
                errors.append(
                    f"{display_path(path)}: legacy document fields may only be resolved at the translation/rendering compatibility boundary"
                )
            if path not in LEGACY_FIELD_READERS:
                fields = sorted(_legacy_field_reads(path))
                if fields:
                    errors.append(
                        f"{display_path(path)}: direct legacy document field reads are restricted to compatibility, persistence, provenance, and fingerprint boundaries: {', '.join(fields)}"
                    )

    for path in scan_py_files(PACKAGE_ROOT):
        if any(
            module_allowed(module, (DECISION_DIFF_MODULE,))
            for module in imported_modules(path)
        ):
            errors.append(
                f"{display_path(path)}: decision_diff is a migration audit helper and must not be imported by production code"
            )


__all__ = ["check_document_semantic_boundaries"]
