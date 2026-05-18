#!/usr/bin/env python3
from __future__ import annotations

import ast
from pathlib import Path
import re
import sys


REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPTS_ROOT = REPO_ROOT / "backend" / "scripts"

PIPELINE_ROOT = SCRIPTS_ROOT / "runtime" / "pipeline"
ENTRYPOINTS_ROOT = SCRIPTS_ROOT / "entrypoints"
OCR_PROVIDER_ROOT = SCRIPTS_ROOT / "services" / "ocr_provider"
TRANSLATION_ROOT = SCRIPTS_ROOT / "services" / "translation"
RENDERING_ROOT = SCRIPTS_ROOT / "services" / "rendering"
STAGE_SPEC_CONTRACT_CHECK = SCRIPTS_ROOT / "devtools" / "check_stage_specs_contract.py"

PROVIDER_PRIVATE_IMPORT_PATTERNS = (
    "from services.ocr_provider",
    "import services.ocr_provider",
    "from services.mineru",
    "import services.mineru",
)
PROVIDER_RAW_TOKENS = (
    "layoutParsingResults",
    "prunedResult",
    "content_list",
)
PROVIDER_ADAPTER_IMPORT_PATTERNS = (
    "from services.document_schema.provider_adapters",
    "import services.document_schema.provider_adapters",
)
OCR_PROVIDER_FORBIDDEN_IMPORT_PATTERNS = (
    "from runtime.pipeline",
    "import runtime.pipeline",
    "from services.translation",
    "import services.translation",
    "from services.rendering",
    "import services.rendering",
)
OCR_PROVIDER_STABLE_ENTRYPOINT = SCRIPTS_ROOT / "services" / "ocr_provider" / "provider_pipeline.py"
OCR_PROVIDER_PACKAGE_INIT = SCRIPTS_ROOT / "services" / "ocr_provider" / "__init__.py"
MINERU_PROVIDER_FLOW_IMPORT = "from services.mineru.job_flow import run_mineru_to_job_dir"
OCR_PROVIDER_COMPAT_SYMBOLS = (
    "adapt_path_to_document_v1_with_report",
    "validate_saved_document_path",
    "build_paddle_lines",
    "tighten_paddle_text_bbox",
    "save_normalized_document_for_paddle",
)
TRANSLATE_ONLY_ENTRYPOINT = SCRIPTS_ROOT / "services" / "translation" / "translate_only_pipeline.py"
FROM_OCR_ENTRYPOINT = SCRIPTS_ROOT / "services" / "translation" / "from_ocr_pipeline.py"
TRANSLATION_ALLOWED_ROOT_DIRS = {
    "batching",
    "classification",
    "context",
    "continuation",
    "diagnostics",
    "fast_path",
    "llm",
    "memory",
    "ocr",
    "orchestration",
    "payload",
    "policy",
    "postprocess",
    "results",
    "terms",
    "workflow",
}
TRANSLATION_ALLOWED_ROOT_FILES = {
    "__init__.py",
    "from_ocr_pipeline.py",
    "item_reader.py",
    "README.md",
    "session_context.py",
    "translate_only_pipeline.py",
}
TRANSLATION_LAYER_IMPORT_RULES: dict[str, tuple[str, ...]] = {
    "workflow": (
        "services.translation.workflow",
        "services.translation.batching",
        "services.translation.classification",
        "services.translation.context",
        "services.translation.continuation",
        "services.translation.diagnostics",
        "services.translation.fast_path",
        "services.translation.llm",
        "services.translation.memory",
        "services.translation.ocr",
        "services.translation.orchestration",
        "services.translation.payload",
        "services.translation.policy",
        "services.translation.postprocess",
        "services.translation.results",
        "services.translation.terms",
    ),
    "batching": (
        "services.translation.batching",
        "services.translation.context",
        "services.translation.fast_path",
        "services.translation.llm",
        "services.translation.memory",
        "services.translation.payload",
        "services.translation.results",
        "services.translation.workflow.batch_runner",
        "services.translation.workflow.workers",
    ),
    "results": (
        "services.translation.results",
        "services.translation.memory",
        "services.translation.payload",
        "services.translation.workflow.pages",
    ),
    "fast_path": (
        "services.translation.fast_path",
        "services.translation.item_reader",
        "services.translation.llm",
        "services.translation.policy",
    ),
    "llm": (
        "services.translation.llm",
        "services.translation.context",
        "services.translation.diagnostics",
        "services.translation.memory",
        "services.translation.payload",
        "services.translation.policy",
        "services.translation.terms",
    ),
    "policy": (
        "services.translation.policy",
        # Historical policy modules still inspect OCR contracts and LLM domain hints.
        # T17-T18 will narrow this to decision-only inputs.
        "services.translation.classification",
        "services.translation.context",
        "services.translation.llm.domain_context",
        "services.translation.llm.shared.provider_runtime",
        "services.translation.ocr",
        "services.translation.payload",
    ),
    "payload": (
        "services.translation.payload",
        # Payload still applies historical policy/classification mutations while T23 is pending.
        "services.translation.classification",
        "services.translation.continuation",
        "services.translation.ocr",
        "services.translation.policy",
        "services.translation.terms",
    ),
    "memory": (
        "services.translation.memory",
        "services.translation.terms",
    ),
    "context": (
        "services.translation.context",
        "services.translation.llm.shared.control_context",
        "services.translation.llm.style_hints",
    ),
    "ocr": (
        "services.translation.ocr",
    ),
    "orchestration": (
        "services.translation.orchestration",
        "services.translation.context",
        "services.translation.continuation",
        "services.translation.ocr",
        "services.translation.payload",
    ),
    "continuation": (
        "services.translation.continuation",
        "services.translation.context",
        # Continuation review currently asks LLM for borderline cases.
        "services.translation.llm",
    ),
    "classification": (
        "services.translation.classification",
        "services.translation.context",
        "services.translation.llm",
        "services.translation.ocr",
        "services.translation.policy",
    ),
    "terms": (
        "services.translation.terms",
    ),
    "diagnostics": (
        "services.translation.diagnostics",
        "services.translation.payload",
    ),
    "postprocess": (
        "services.translation.postprocess",
        "services.translation.llm",
    ),
}
TRANSLATION_LAYER_IMPORT_EXCEPTIONS: dict[Path, tuple[str, ...]] = {
    # Transitional orchestration code still constructs concrete payload records.
    Path("orchestration/document_orchestrator.py"): (
        "services.translation.policy",
    ),
    # Current llm orchestration still bridges workflow-ish retry behavior until T04-T10 migrate runtime flow.
    Path("llm/shared/orchestration/fallbacks.py"): (
        "services.translation.postprocess",
    ),
}
TRANSLATION_RENDERING_IMPORT_EXCEPTIONS: dict[Path, tuple[str, ...]] = {
    # Translation can start render-source prewarm in parallel with LLM work, but
    # must not reach into broader rendering internals.
    Path("workflow/execution_runner.py"): (
        "services.rendering.source.prewarm",
    ),
}
TRANSLATION_SHARED_COMPAT_IMPORTS = (
    "services.translation.item_reader",
    "services.translation.session_context",
)
TRANSLATION_STAGE_PIPELINE = PIPELINE_ROOT / "translation_stage.py"
RENDER_STAGE_PIPELINE = PIPELINE_ROOT / "render_stage.py"
RENDER_EXECUTION_PIPELINE = PIPELINE_ROOT / "render_execution.py"
RENDERING_WORKFLOW_ROOT = RENDERING_ROOT / "workflow"
RENDERING_ANALYSIS_ROOT = RENDERING_ROOT / "analysis"
RENDERING_PROFILE_ROOT = RENDERING_ANALYSIS_ROOT / "profile"
RENDERING_ROUTE_ROOT = RENDERING_ANALYSIS_ROOT / "route"
RENDERING_TYPST_ROOT = RENDERING_ROOT / "output" / "typst"
RENDERING_LAYOUT_ROOT = RENDERING_ROOT / "layout"
RENDERING_SOURCE_ROOT = RENDERING_ROOT / "source"
RENDERING_SOURCE_CLEANUP_ROOT = RENDERING_SOURCE_ROOT / "cleanup"
RENDERING_ALLOWED_ROOT_DIRS = {
    "analysis",
    "document",
    "layout",
    "legacy",
    "output",
    "policy",
    "source",
    "workflow",
}
RENDERING_ALLOWED_ROOT_FILES = {
    "__init__.py",
    "README.md",
}
RENDERING_LAYER_IMPORT_RULES: dict[str, tuple[str, ...]] = {
    "workflow": (
        "services.rendering.workflow",
        "services.rendering.analysis",
        "services.rendering.document",
        "services.rendering.policy",
        "services.rendering.source",
        "services.rendering.layout",
        "services.rendering.output",
        "services.rendering.legacy",
    ),
    "analysis": (
        "services.rendering.analysis",
        # Page profiling may inspect source image metadata, but must not execute cleanup/output.
        "services.rendering.source.background.detect",
    ),
    "document": (
        "services.rendering.document",
        "services.rendering.layout.model",
    ),
    "source": (
        "services.rendering.source",
        "services.rendering.document",
        "services.rendering.policy",
        "services.rendering.layout",
        "services.rendering.layout.inline_content",
        # Existing source preparation still reuses the PDF compressor facade and Typst temp-root helper.
        "services.rendering.legacy.pdf_compress",
        "services.rendering.output.typst.shared",
    ),
    "layout": (
        "services.rendering.layout",
        "services.rendering.policy",
    ),
    "output": (
        "services.rendering.output",
        "services.rendering.layout",
        "services.rendering.document",
        "services.rendering.policy",
        # Output owns overlay composition and may sample/rebuild source backgrounds.
        "services.rendering.source.background",
    ),
    "policy": (
        "services.rendering.policy",
    ),
    "legacy": (
        "services.rendering.workflow",
        "services.rendering.analysis",
        "services.rendering.document",
        "services.rendering.source",
        "services.rendering.layout",
        "services.rendering.output",
        "services.rendering.legacy",
    ),
}
RENDERING_LAYER_IMPORT_EXCEPTIONS: dict[Path, tuple[str, ...]] = {
    # Existing source/background overlay code still bridges source cleanup, layout blocks,
    # and overlay diagnostics. Keep this exception narrow so new cross-layer imports fail.
    Path("source/background/page_overlay.py"): (
        "services.rendering.output.typst.overlay_diagnostics",
    ),
    Path("source/background/redaction_plan.py"): (
        "services.rendering.layout.model.block_view",
        "services.rendering.layout.model.models",
    ),
    Path("source/background/redaction_items.py"): (
        "services.rendering.layout.model.block_view",
        "services.rendering.layout.model.models",
    ),
    Path("source/background/stage.py"): (
        "services.rendering.layout.model.models",
    ),
    Path("source/items.py"): (
        "services.rendering.layout.model.render_text",
    ),
}

ENTRYPOINT_IMPORT_ALLOWLIST: dict[Path, tuple[str, ...]] = {
    Path("build_book.py"): ("from runtime.pipeline.book_pipeline import",),
    Path("build_page.py"): (
        "from services.translation.ocr.json_extractor import",
        "from services.rendering.legacy.pdf_overlay import",
        "from services.rendering.legacy.typst_page_renderer import",
        "from services.translation.payload import",
    ),
    Path("diagnose_failure_with_ai.py"): (
        "from services.translation.llm.shared.provider_runtime import",
        "from services.translation.llm.shared.response_parsing import",
    ),
    Path("run_book.py"): ("from services.translation.from_ocr_pipeline import main",),
    Path("run_document_flow.py"): (
        "from runtime.pipeline.book_pipeline import",
        "from services.translation.llm.shared.provider_runtime import",
    ),
    Path("run_normalize_ocr.py"): ("from services.document_schema.normalize_pipeline import main",),
    Path("run_provider_case.py"): ("from services.ocr_provider.provider_pipeline import main",),
    Path("run_provider_ocr.py"): ("from services.ocr_provider.provider_pipeline import main",),
    Path("run_render_only.py"): ("from services.rendering.workflow.render_only import main",),
    Path("run_translate_from_ocr.py"): ("from services.translation.from_ocr_pipeline import main",),
    Path("run_translate_only.py"): ("from services.translation.translate_only_pipeline import main",),
    Path("translate_book.py"): ("from services.translation.translate_only_pipeline import main",),
    Path("translate_page.py"): (
        "from services.translation.ocr.json_extractor import",
        "from services.translation.llm.shared.provider_runtime import",
        "from services.translation.workflow import",
    ),
    Path("validate_document_schema.py"): ("from services.document_schema import",),
}


def scan_py_files(root: Path) -> list[Path]:
    paths: list[Path] = []
    for path in root.rglob("*.py"):
        if not path.is_file():
            continue
        rel_parts = path.relative_to(root).parts
        if "__pycache__" in rel_parts or ".ipynb_checkpoints" in rel_parts:
            continue
        paths.append(path)
    return sorted(paths)


def rel(path: Path) -> Path:
    return path.relative_to(SCRIPTS_ROOT)


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def imported_modules(path: Path) -> list[str]:
    modules: list[str] = []
    try:
        tree = ast.parse(read_text(path), filename=str(path))
    except SyntaxError:
        return modules
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            modules.extend(alias.name for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            modules.append(node.module)
    return modules


def rendering_layer_for(path: Path) -> str | None:
    try:
        parts = path.relative_to(RENDERING_ROOT).parts
    except ValueError:
        return None
    if not parts:
        return None
    first = parts[0]
    return first if first in RENDERING_ALLOWED_ROOT_DIRS else None


def translation_layer_for(path: Path) -> str | None:
    try:
        parts = path.relative_to(TRANSLATION_ROOT).parts
    except ValueError:
        return None
    if not parts:
        return None
    first = parts[0]
    return first if first in TRANSLATION_ALLOWED_ROOT_DIRS else None


def module_allowed(module: str, allowed_prefixes: tuple[str, ...]) -> bool:
    return any(module == prefix or module.startswith(f"{prefix}.") for prefix in allowed_prefixes)


def check_pipeline_provider_leaks(errors: list[str]) -> None:
    for path in scan_py_files(PIPELINE_ROOT):
        text = read_text(path)
        rel_path = rel(path)
        for pattern in PROVIDER_PRIVATE_IMPORT_PATTERNS:
            if pattern in text:
                errors.append(
                    f"{rel_path}: runtime/pipeline must not import provider-specific services directly"
                )
                break
        for token in PROVIDER_RAW_TOKENS:
            if token in text:
                errors.append(
                    f"{rel_path}: runtime/pipeline must not understand provider raw token '{token}'"
                )
        for pattern in PROVIDER_ADAPTER_IMPORT_PATTERNS:
            if pattern in text:
                errors.append(
                    f"{rel_path}: runtime/pipeline must not depend on document_schema provider adapters directly"
                )
                break


def check_service_provider_raw_leaks(errors: list[str]) -> None:
    guarded_roots = (TRANSLATION_ROOT, RENDERING_ROOT)
    for root in guarded_roots:
        for path in scan_py_files(root):
            text = read_text(path)
            rel_path = rel(path)
            for pattern in PROVIDER_PRIVATE_IMPORT_PATTERNS + PROVIDER_ADAPTER_IMPORT_PATTERNS:
                if pattern in text:
                    errors.append(
                        f"{rel_path}: translation/rendering services must not depend on provider-specific raw adapters"
                    )
                    break
            for token in PROVIDER_RAW_TOKENS:
                if token in text:
                    errors.append(
                        f"{rel_path}: translation/rendering services must not consume provider raw token '{token}'"
                    )


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
            if match.group(1).startswith(("foundation.", "pathlib", "__future__")):
                continue
            if any(stmt.startswith(prefix) for prefix in allowed_prefixes):
                continue
            errors.append(
                f"entrypoints/{rel_name}: entrypoint should import only its stable top-level pipeline/service entry, found '{stmt}'"
            )


def check_ocr_provider_boundaries(errors: list[str]) -> None:
    for path in scan_py_files(OCR_PROVIDER_ROOT):
        text = read_text(path)
        rel_path = rel(path)
        if path != OCR_PROVIDER_STABLE_ENTRYPOINT:
            for pattern in OCR_PROVIDER_FORBIDDEN_IMPORT_PATTERNS:
                if pattern in text:
                    errors.append(
                        f"{rel_path}: provider implementation modules must not depend on runtime/translation/rendering layers"
                    )
                    break

    init_text = read_text(OCR_PROVIDER_PACKAGE_INIT)
    if "from . import provider_pipeline" not in init_text:
        errors.append(
            "services/ocr_provider/__init__.py: package must explicitly re-export provider_pipeline"
        )
    if '__all__ = ["provider_pipeline"]' not in init_text:
        errors.append(
            "services/ocr_provider/__init__.py: package must pin provider_pipeline as explicit public surface"
        )

    entry_text = read_text(OCR_PROVIDER_STABLE_ENTRYPOINT)
    if "from runtime.pipeline.book_pipeline import run_book_pipeline" not in entry_text:
        errors.append(
            "services/ocr_provider/provider_pipeline.py: stable provider entry must own the handoff to run_book_pipeline"
        )
    if MINERU_PROVIDER_FLOW_IMPORT not in entry_text:
        errors.append(
            "services/ocr_provider/provider_pipeline.py: stable provider entry must own MinerU provider handoff"
        )
    for symbol in OCR_PROVIDER_COMPAT_SYMBOLS:
        if f"{symbol}" not in entry_text:
            errors.append(
                f"services/ocr_provider/provider_pipeline.py: stable provider entry must preserve compat symbol '{symbol}'"
            )

    for path in scan_py_files(SCRIPTS_ROOT / "entrypoints"):
        text = read_text(path)
        if MINERU_PROVIDER_FLOW_IMPORT in text:
            errors.append(
                f"{rel(path)}: entrypoints must route MinerU through services/ocr_provider/provider_pipeline.py"
            )


def check_translation_worker_protocol(errors: list[str]) -> None:
    translate_only_text = read_text(TRANSLATE_ONLY_ENTRYPOINT)
    if "PipelineEventWriter(" not in translate_only_text:
        errors.append(
            "services/translation/translate_only_pipeline.py: translate-only worker must initialize PipelineEventWriter"
        )
    if "STDOUT_LABEL_EVENTS_JSONL" not in translate_only_text:
        errors.append(
            "services/translation/translate_only_pipeline.py: translate-only worker must publish pipeline_events.jsonl via stdout contract"
        )
    if 'artifact_key="pipeline_events_jsonl"' not in translate_only_text:
        errors.append(
            "services/translation/translate_only_pipeline.py: translate-only worker must publish pipeline_events_jsonl artifact"
        )
    if 'artifact_key="translation_diagnostics_json"' not in translate_only_text:
        errors.append(
            "services/translation/translate_only_pipeline.py: translate-only worker must publish translation_diagnostics_json artifact"
        )
    if '"translation_diagnostics.json"' not in translate_only_text:
        errors.append(
            "services/translation/translate_only_pipeline.py: translate-only worker must keep translation_diagnostics.json as stable diagnostics output"
        )

    from_ocr_text = read_text(FROM_OCR_ENTRYPOINT)
    if "PipelineEventWriter(" not in from_ocr_text:
        errors.append(
            "services/translation/from_ocr_pipeline.py: translate-from-ocr worker must initialize PipelineEventWriter"
        )
    if "STDOUT_LABEL_EVENTS_JSONL" not in from_ocr_text:
        errors.append(
            "services/translation/from_ocr_pipeline.py: translate-from-ocr worker must publish pipeline_events.jsonl via stdout contract"
        )
    if 'artifact_key="pipeline_events_jsonl"' not in from_ocr_text:
        errors.append(
            "services/translation/from_ocr_pipeline.py: translate-from-ocr worker must publish pipeline_events_jsonl artifact"
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


def check_translation_pipeline_facade_boundary(errors: list[str]) -> None:
    text = read_text(TRANSLATION_STAGE_PIPELINE)
    required = (
        "from services.translation.workflow import TranslationExecutionRequest",
        "from services.translation.workflow import execute_translation_request",
    )
    for item in required:
        if item not in text:
            errors.append(
                f"runtime/pipeline/translation_stage.py: must call translation workflow facade via '{item}'"
            )
    forbidden = (
        "from services.translation.policy import",
        "from services.translation.session_context import",
        "from services.translation.diagnostics import",
        "from runtime.pipeline.book_translation_flow import",
    )
    for item in forbidden:
        if item in text:
            errors.append(
                f"runtime/pipeline/translation_stage.py: must not import workflow internals directly: '{item}'"
            )


def check_render_pipeline_facade_boundary(errors: list[str]) -> None:
    stage_text = read_text(RENDER_STAGE_PIPELINE)
    execution_text = read_text(RENDER_EXECUTION_PIPELINE)
    if "from services.rendering.workflow import execute_render_plan" not in execution_text:
        errors.append(
            "runtime/pipeline/render_execution.py: must delegate to services.rendering.workflow.execute_render_plan"
        )
    forbidden = (
        "import fitz",
        "from services.rendering.source.render_source import",
        "from services.rendering.source.preparation.hidden_text_strip import",
        "from services.rendering.output.typst",
        "from services.rendering.source.cleanup",
        "from services.rendering.layout",
        "from services.rendering.legacy.typst_page_renderer import",
        "from services.rendering.legacy.pdf_overlay import",
        "from services.rendering.legacy.pdf_compress import build_image_compressed_pdf_copy",
        "from services.rendering.legacy.pdf_compress import compress_pdf_images_only",
    )
    for item in forbidden:
        if item in stage_text or item in execution_text:
            errors.append(
                f"runtime/pipeline render facade must not import rendering internals directly: '{item}'"
            )


def check_rendering_internal_boundaries(errors: list[str]) -> None:
    for path in RENDERING_ROOT.iterdir():
        if path.name == "__pycache__":
            continue
        if path.is_dir() and path.name not in RENDERING_ALLOWED_ROOT_DIRS:
            errors.append(
                f"services/rendering/{path.name}: unexpected rendering root directory; use workflow/analysis/document/source/layout/output/legacy"
            )
        if path.is_file() and path.name not in RENDERING_ALLOWED_ROOT_FILES:
            errors.append(
                f"services/rendering/{path.name}: unexpected rendering root file; place entrypoints inside a named layer"
            )

    legacy_rendering_imports = (
        "from services.rendering.core",
        "import services.rendering.core",
        "from services.rendering.orchestrator",
        "import services.rendering.orchestrator",
        "from services.rendering.page_profile",
        "import services.rendering.page_profile",
        "from services.rendering.page_route",
        "import services.rendering.page_route",
        "from services.rendering.page_classifier",
        "import services.rendering.page_classifier",
        "from services.rendering.typst",
        "import services.rendering.typst",
        "from services.rendering.formula",
        "import services.rendering.formula",
        "from services.rendering.preprocess",
        "import services.rendering.preprocess",
        "from services.rendering.redaction",
        "import services.rendering.redaction",
        "from services.rendering.background",
        "import services.rendering.background",
        "from services.rendering.compress",
        "import services.rendering.compress",
        "from services.rendering.source_pdf",
        "import services.rendering.source_pdf",
    )
    legacy_rendering_wrappers = set()
    legacy_rendering_wrappers.update((RENDERING_ROOT / "core").glob("*.py"))
    legacy_rendering_wrappers.update((RENDERING_ROOT / "orchestrator").glob("*.py"))
    legacy_rendering_wrappers.update((RENDERING_ROOT / "page_profile").glob("*.py"))
    legacy_rendering_wrappers.update((RENDERING_ROOT / "page_route").glob("*.py"))
    legacy_rendering_wrappers.update((RENDERING_ROOT / "typst").glob("*.py"))
    legacy_rendering_wrappers.update((RENDERING_ROOT / "formula").glob("*.py"))
    legacy_rendering_wrappers.update((RENDERING_ROOT / "formula" / "core").glob("*.py"))
    legacy_rendering_wrappers.update((RENDERING_ROOT / "formula" / "fallback").glob("*.py"))
    legacy_rendering_wrappers.update((RENDERING_ROOT / "preprocess").glob("*.py"))
    legacy_rendering_wrappers.update((RENDERING_ROOT / "redaction").glob("*.py"))
    legacy_rendering_wrappers.update((RENDERING_ROOT / "background").glob("*.py"))
    legacy_rendering_wrappers.update((RENDERING_ROOT / "compress").glob("*.py"))
    legacy_rendering_wrappers.add(RENDERING_ROOT / "page_classifier.py")
    legacy_rendering_wrappers.add(RENDERING_ROOT / "source_pdf.py")
    for path in scan_py_files(RENDERING_ROOT):
        if path in legacy_rendering_wrappers:
            continue
        text = read_text(path)
        rel_path = rel(path)
        for item in legacy_rendering_imports:
            if item in text:
                errors.append(
                    f"{rel_path}: import new rendering modules directly instead of legacy compatibility wrappers"
                )
                break

    legacy_document_imports = (
        "from services.rendering.page_map",
        "import services.rendering.page_map",
        "from services.rendering.pdf_metadata",
        "import services.rendering.pdf_metadata",
    )
    legacy_document_wrappers = {
        RENDERING_ROOT / "page_map.py",
        RENDERING_ROOT / "pdf_metadata.py",
        RENDERING_ROOT / "source_pdf.py",
    }
    for path in scan_py_files(RENDERING_ROOT):
        if path in legacy_document_wrappers:
            continue
        text = read_text(path)
        rel_path = rel(path)
        for item in legacy_document_imports:
            if item in text:
                errors.append(
                    f"{rel_path}: import document helpers from services.rendering.document.* instead of rendering root wrappers"
                )
                break

    for path in scan_py_files(RENDERING_PROFILE_ROOT):
        text = read_text(path)
        rel_path = rel(path)
        forbidden = (
            "from services.rendering.analysis.route",
            "import services.rendering.analysis.route",
            "from services.rendering.source.cleanup",
            "import services.rendering.source.cleanup",
            "from services.rendering.output.typst",
            "import services.rendering.output.typst",
            "from services.rendering.layout",
            "import services.rendering.layout",
        )
        for item in forbidden:
            if item in text:
                errors.append(
                    f"{rel_path}: page_profile must collect facts only and must not depend on route/redaction/typst/layout"
                )
                break

    for path in scan_py_files(RENDERING_ROUTE_ROOT):
        text = read_text(path)
        rel_path = rel(path)
        forbidden = (
            "import fitz",
            "from services.rendering.source.cleanup",
            "import services.rendering.source.cleanup",
            "from services.rendering.output.typst",
            "import services.rendering.output.typst",
            "from services.rendering.layout",
            "import services.rendering.layout",
        )
        for item in forbidden:
            if item in text:
                errors.append(
                    f"{rel_path}: page_route must decide routes only and must not scan pages or call redaction/typst/layout"
                )
                break

    for path in scan_py_files(RENDERING_TYPST_ROOT):
        text = read_text(path)
        rel_path = rel(path)
        forbidden = (
            "from services.rendering.source.cleanup",
            "import services.rendering.source.cleanup",
        )
        for item in forbidden:
            if item in text:
                errors.append(
                    f"{rel_path}: typst layer must not import redaction directly; route background cleanup through rendering/background or orchestrator"
                )
                break

    for path in scan_py_files(RENDERING_LAYOUT_ROOT):
        text = read_text(path)
        rel_path = rel(path)
        forbidden = (
            "from services.rendering.source.cleanup",
            "import services.rendering.source.cleanup",
            "from services.rendering.output.typst",
            "import services.rendering.output.typst",
            "from services.rendering.source.render_source",
            "import services.rendering.source.render_source",
        )
        for item in forbidden:
            if item in text:
                errors.append(
                    f"{rel_path}: layout layer must not import redaction/typst/source_pdf"
                )
                break

    for path in scan_py_files(RENDERING_SOURCE_CLEANUP_ROOT):
        text = read_text(path)
        rel_path = rel(path)
        forbidden = (
            "from services.rendering.output.typst",
            "import services.rendering.output.typst",
            "import services.rendering.layout",
        )
        for item in forbidden:
            if item in text:
                errors.append(
                    f"{rel_path}: redaction layer must not import typst/layout"
                )
                break

    removed_cleanup_modules = (
        "services.rendering.source.cleanup.analysis",
        "services.rendering.source.cleanup.document_ops",
        "services.rendering.source.cleanup.fill",
        "services.rendering.source.cleanup.geometry",
        "services.rendering.source.cleanup.math_protection",
        "services.rendering.source.cleanup.ops",
        "services.rendering.source.cleanup.plan",
        "services.rendering.source.cleanup.route_selection",
        "services.rendering.source.cleanup.shared",
        "services.rendering.source.cleanup.text_analysis",
        "services.rendering.source.cleanup.text_layer",
        "services.rendering.source.cleanup.text_match",
        "services.rendering.source.cleanup.vector_analysis",
        "services.rendering.source.cleanup.visual_cover",
    )
    for path in scan_py_files(RENDERING_ROOT):
        rel_path = rel(path)
        for module in imported_modules(path):
            if module in removed_cleanup_modules:
                errors.append(
                    f"{rel_path}: cleanup compatibility module '{module}' was removed; import the concrete implementation or source primitive"
                )
                break

    source_background_root = RENDERING_SOURCE_ROOT / "background"
    for path in scan_py_files(source_background_root):
        text = read_text(path)
        rel_path = rel(path)
        forbidden = (
            "from services.rendering.source.cleanup",
            "import services.rendering.source.cleanup",
        )
        for item in forbidden:
            if item in text:
                errors.append(
                    f"{rel_path}: source/background must not import source.cleanup directly; use source-level facades"
                )
                break

    source_preparation_root = RENDERING_SOURCE_ROOT / "preparation"
    preparation_compat_imports = (
        "services.rendering.source.cleanup.analysis",
        "services.rendering.source.cleanup.document_ops",
        "services.rendering.source.cleanup.fill",
        "services.rendering.source.cleanup.geometry",
        "services.rendering.source.cleanup.math_protection",
        "services.rendering.source.cleanup.ops",
        "services.rendering.source.cleanup.plan",
        "services.rendering.source.cleanup.route_selection",
        "services.rendering.source.cleanup.shared",
        "services.rendering.source.cleanup.text_analysis",
        "services.rendering.source.cleanup.text_layer",
        "services.rendering.source.cleanup.text_match",
        "services.rendering.source.cleanup.vector_analysis",
        "services.rendering.source.cleanup.visual_cover",
    )
    for path in scan_py_files(source_preparation_root):
        rel_path = rel(path)
        for module in imported_modules(path):
            if module in preparation_compat_imports:
                errors.append(
                    f"{rel_path}: source/preparation must import source primitives or concrete cleanup modules, not compatibility facade '{module}'"
                )
                break

    dev_overlay_compat_imports = (
        "services.rendering.source.cleanup.builders",
        "services.rendering.source.cleanup.text_draw",
    )
    for path in scan_py_files(RENDERING_ROOT):
        rel_path = rel(path)
        for module in imported_modules(path):
            if module in dev_overlay_compat_imports:
                errors.append(
                    f"{rel_path}: cleanup dev overlay compatibility path was removed; import from services.rendering.source.dev_overlay instead of '{module}'"
                )
                break

    for path in scan_py_files(RENDERING_ROOT):
        layer = rendering_layer_for(path)
        if layer is None:
            continue
        allowed_prefixes = RENDERING_LAYER_IMPORT_RULES[layer]
        exception_prefixes = RENDERING_LAYER_IMPORT_EXCEPTIONS.get(path.relative_to(RENDERING_ROOT), ())
        for module in imported_modules(path):
            if not module.startswith("services.rendering."):
                continue
            if module_allowed(module, allowed_prefixes) or module_allowed(module, exception_prefixes):
                continue
            errors.append(
                f"{rel(path)}: rendering layer '{layer}' must not import '{module}' directly"
            )


def check_translation_rendering_separation(errors: list[str]) -> None:
    for path in scan_py_files(TRANSLATION_ROOT):
        exception_prefixes = TRANSLATION_RENDERING_IMPORT_EXCEPTIONS.get(path.relative_to(TRANSLATION_ROOT), ())
        for module in imported_modules(path):
            if not module.startswith("services.rendering"):
                continue
            if module_allowed(module, exception_prefixes):
                continue
            errors.append(
                f"{rel(path)}: translation layer must not import rendering services directly: '{module}'"
            )
            break


def check_translation_internal_boundaries(errors: list[str]) -> None:
    for path in TRANSLATION_ROOT.iterdir():
        if path.name == "__pycache__":
            continue
        if path.is_dir() and path.name not in TRANSLATION_ALLOWED_ROOT_DIRS:
            errors.append(
                f"services/translation/{path.name}: unexpected translation root directory; update architecture rules or move it into a named layer"
            )
        if path.is_file() and path.name not in TRANSLATION_ALLOWED_ROOT_FILES:
            errors.append(
                f"services/translation/{path.name}: unexpected translation root file; place new code inside workflow/llm/policy/context/memory/payload/etc."
            )

    forbidden_runtime_imports = (
        "from runtime.pipeline",
        "import runtime.pipeline",
    )
    for path in scan_py_files(TRANSLATION_ROOT):
        if path in {TRANSLATE_ONLY_ENTRYPOINT, FROM_OCR_ENTRYPOINT}:
            continue
        if translation_layer_for(path) == "workflow":
            continue
        text = read_text(path)
        rel_path = rel(path)
        for item in forbidden_runtime_imports:
            if item in text:
                errors.append(
                    f"{rel_path}: translation internals must not import runtime.pipeline directly"
                )
                break

    for path in scan_py_files(TRANSLATION_ROOT / "llm" / "providers"):
        text = read_text(path)
        rel_path = rel(path)
        forbidden = (
            "from services.translation.workflow",
            "import services.translation.workflow",
            "from services.translation.policy",
            "import services.translation.policy",
            "from services.rendering",
            "import services.rendering",
            "from runtime.pipeline",
            "import runtime.pipeline",
        )
        for item in forbidden:
            if item in text:
                errors.append(
                    f"{rel_path}: provider modules must stay transport-only and must not import workflow/policy/runtime"
                )
                break

    for path in scan_py_files(TRANSLATION_ROOT / "payload"):
        text = read_text(path)
        rel_path = rel(path)
        forbidden = (
            "from services.translation.llm",
            "import services.translation.llm",
            "from services.translation.workflow",
            "import services.translation.workflow",
            "from services.translation.batching",
            "import services.translation.batching",
            "from services.translation.fast_path",
            "import services.translation.fast_path",
            "from services.translation.results",
            "import services.translation.results",
            "from services.translation.memory",
            "import services.translation.memory",
            "from runtime.pipeline",
            "import runtime.pipeline",
        )
        for item in forbidden:
            if item in text:
                errors.append(
                    f"{rel_path}: payload layer must remain data construction/application only and must not import execution/cache/provider layers"
                )
                break

    for path in scan_py_files(TRANSLATION_ROOT):
        layer = translation_layer_for(path)
        if layer is None:
            continue
        allowed_prefixes = TRANSLATION_LAYER_IMPORT_RULES[layer]
        exception_prefixes = TRANSLATION_LAYER_IMPORT_EXCEPTIONS.get(path.relative_to(TRANSLATION_ROOT), ())
        for module in imported_modules(path):
            if not module.startswith("services.translation."):
                continue
            if module_allowed(module, TRANSLATION_SHARED_COMPAT_IMPORTS):
                continue
            if module_allowed(module, allowed_prefixes) or module_allowed(module, exception_prefixes):
                continue
            errors.append(
                f"{rel(path)}: translation layer '{layer}' must not import '{module}' directly"
            )


def main() -> int:
    errors: list[str] = []
    check_pipeline_provider_leaks(errors)
    check_service_provider_raw_leaks(errors)
    check_entrypoint_stable_imports(errors)
    check_ocr_provider_boundaries(errors)
    check_translation_worker_protocol(errors)
    check_stage_spec_contract_checker(errors)
    check_translation_pipeline_facade_boundary(errors)
    check_render_pipeline_facade_boundary(errors)
    check_rendering_internal_boundaries(errors)
    check_translation_rendering_separation(errors)
    check_translation_internal_boundaries(errors)
    if errors:
        print("pipeline architecture check failed:", file=sys.stderr)
        for item in errors:
            print(f"- {item}", file=sys.stderr)
        return 1
    print("pipeline architecture check passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
