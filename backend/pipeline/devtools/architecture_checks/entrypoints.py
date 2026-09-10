from __future__ import annotations

from pathlib import Path
import re

from devtools.architecture_checks.common import PACKAGE_ROOT
from devtools.architecture_checks.common import SCRIPTS_ROOT
from devtools.architecture_checks.common import read_text
from devtools.architecture_checks.common import scan_py_files


ENTRYPOINTS_ROOT = PACKAGE_ROOT / "entrypoints"
STAGE_SPEC_CONTRACT_CHECK = SCRIPTS_ROOT / "devtools" / "check_stage_specs_contract.py"

ENTRYPOINT_IMPORT_ALLOWLIST: dict[Path, tuple[str, ...]] = {
    Path("__init__.py"): (),
    Path("console.py"): (
        "from collections.abc import",
        "from retainpdf_pipeline.entrypoints.run_document_operation import",
        "from retainpdf_pipeline.foundation.shared.structured_errors import",
        "from retainpdf_pipeline.ocr.document_schema.normalize_pipeline import",
        "from retainpdf_pipeline.ocr.ocr_provider.provider_pipeline import",
        "from retainpdf_pipeline.render.workflow.render_only import",
        "from retainpdf_pipeline.translate.entrypoints.from_ocr_pipeline import",
        "from retainpdf_pipeline.translate.entrypoints.translate_only_pipeline import",
    ),
    Path("diagnose_failure_with_ai.py"): (
        "from retainpdf_pipeline.translate.public import",
    ),
    Path("run_document_operation.py"): (
        "from retainpdf_ai.document_operations.page_program import",
        "from retainpdf_ai.document_operations.visual_validation import",
    ),
    Path("run_normalize_ocr.py"): ("from retainpdf_pipeline.ocr.document_schema.normalize_pipeline import main",),
    Path("run_provider_case.py"): ("from retainpdf_pipeline.ocr.ocr_provider.provider_pipeline import main",),
    Path("run_provider_ocr.py"): ("from retainpdf_pipeline.ocr.ocr_provider.provider_pipeline import main",),
    Path("run_render_only.py"): ("from retainpdf_pipeline.render.workflow.render_only import main",),
    Path("run_translate_only.py"): ("from retainpdf_pipeline.translate.entrypoints.translate_only_pipeline import main",),
}


def check_entrypoint_stable_imports(errors: list[str]) -> None:
    import_pattern = re.compile(r"^from\s+([A-Za-z0-9_\.]+)\s+import\s+(.+)$", re.MULTILINE)
    for path in scan_py_files(ENTRYPOINTS_ROOT):
        rel_name = path.relative_to(ENTRYPOINTS_ROOT)
        allowed_prefixes = ENTRYPOINT_IMPORT_ALLOWLIST.get(rel_name)
        if allowed_prefixes is None:
            errors.append(f"entrypoints/{rel_name}: missing explicit import allowlist entry in check_pipeline_architecture.py")
            continue
        text = read_text(path)
        for match in import_pattern.finditer(text):
            stmt = f"from {match.group(1)} import {match.group(2)}"
            if match.group(1).startswith(("retainpdf_pipeline.foundation.", "pathlib", "__future__")):
                continue
            if any(stmt.startswith(prefix) for prefix in allowed_prefixes):
                continue
            errors.append(
                f"entrypoints/{rel_name}: entrypoint should import only its stable top-level pipeline/service entry, found '{stmt}'"
            )


def check_stage_spec_contract_checker(errors: list[str]) -> None:
    if not STAGE_SPEC_CONTRACT_CHECK.exists():
        errors.append(
            "devtools/check_stage_specs_contract.py: Rust/Python stage spec contract checker is missing"
        )
        return
    text = read_text(STAGE_SPEC_CONTRACT_CHECK)
    for loader_name in (
        "BookStageSpec",
        "NormalizeStageSpec",
        "ProviderStageSpec",
        "RenderStageSpec",
        "TranslateStageSpec",
    ):
        if loader_name not in text:
            errors.append(
                f"devtools/check_stage_specs_contract.py: missing Python loader coverage for {loader_name}"
            )
    if "stage_spec_contract=ok" not in text:
        errors.append(
            "devtools/check_stage_specs_contract.py: checker must emit a stable success marker"
        )


__all__ = [
    "check_entrypoint_stable_imports",
    "check_stage_spec_contract_checker",
    "check_top_level_shim_freeze",
]


# Top-level backend/pipeline/entrypoints/*.py script-mode compatibility shims
# were removed: production workers run as `python -m retainpdf_pipeline.<stage>`
# and aux tools run via the `retainpdf-pipeline` console binary. The directory
# must stay shim-free: new worker entry goes to retainpdf_pipeline console
# subcommands or stage __main__ modules instead.
TOP_LEVEL_SHIMS_ROOT = SCRIPTS_ROOT / "entrypoints"
TOP_LEVEL_SHIM_ALLOWLIST = frozenset()

# Pre-migration ghosts: top-level services/foundation/runtime must never hold
# source again. All pipeline code lives under retainpdf_pipeline/.
LEGACY_TOP_LEVEL_PACKAGE_DIRS = ("services", "foundation", "runtime")


def check_top_level_shim_freeze(errors: list[str]) -> None:
    if TOP_LEVEL_SHIMS_ROOT.is_dir():
        for path in sorted(TOP_LEVEL_SHIMS_ROOT.glob("*.py")):
            if path.name not in TOP_LEVEL_SHIM_ALLOWLIST:
                errors.append(
                    f"entrypoints/{path.name}: new top-level shims are frozen; "
                    "add a retainpdf-pipeline console subcommand instead "
                    "(script-mode is desktop-only)"
                )
    for dirname in LEGACY_TOP_LEVEL_PACKAGE_DIRS:
        legacy = SCRIPTS_ROOT / dirname
        if not legacy.exists():
            continue
        stray = [
            path
            for path in legacy.rglob("*.py")
            if "__pycache__" not in path.parts and ".ipynb_checkpoints" not in path.parts
        ]
        if stray:
            errors.append(
                f"{dirname}/: legacy top-level package dir must stay source-free; "
                f"move {stray[0].name} under retainpdf_pipeline/ "
                f"({len(stray)} stray file(s))"
            )
