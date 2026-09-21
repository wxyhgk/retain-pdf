from __future__ import annotations

from pathlib import Path

from devtools.architecture_checks.common import PACKAGE_ROOT
from devtools.architecture_checks.common import SCRIPTS_ROOT

PIPELINE_ROOT = PACKAGE_ROOT / "runtime" / "pipeline"
DOCUMENT_SCHEMA_ROOT = PACKAGE_ROOT / "ocr" / "document_schema"
TRANSLATION_ROOT = PACKAGE_ROOT / "translate"
RENDERING_ROOT = PACKAGE_ROOT / "render"
DEVTOOLS_ROOT = SCRIPTS_ROOT / "devtools"
TRANSLATION_STAGE_PIPELINE = TRANSLATION_ROOT / "translation_stage.py"

TRANSLATE_ONLY_ENTRYPOINT = PACKAGE_ROOT / "translate" / "entrypoints" / "translate_only_pipeline.py"
FROM_OCR_ENTRYPOINT = PACKAGE_ROOT / "translate" / "entrypoints" / "from_ocr_pipeline.py"
TRANSLATION_ALLOWED_ROOT_DIRS = {
    "artifacts",
    "core",
    "entrypoints",
    "llm",
    "prompts",
    "public",
    "services",
    "workflow",
}
TRANSLATION_ALLOWED_ROOT_FILES = {
    "__init__.py",
    "__main__.py",
    "README.md",
    "prompt_loader.py",
    "translation_stage.py",
}
TRANSLATION_WORKFLOW_ALLOWED_DIRS = {
    "__pycache__",
    ".ipynb_checkpoints",
    "batching",
    "checkpoint",
    "legacy",
    "phases",
    "scheduling",
}
TRANSLATION_WORKFLOW_ALLOWED_FILES = {
    "__init__.py",
    "README.md",
    "batch_plan.py",
    "batch_runner.py",
    "book_flow.py",
    "execution.py",
    "execution_plan.py",
    "execution_runner.py",
    "page_policies.py",
    "page_range.py",
    "pages.py",
    "recovery.py",
    "stages.py",
    "translation_workflow.py",
    "workers.py",
}
TRANSLATION_WORKFLOW_SUBPACKAGE_RULES: dict[str, tuple[str, ...]] = {
    "checkpoint": (
        "retainpdf_pipeline.translate.workflow.checkpoint",
        "retainpdf_pipeline.translate.workflow.execution",
        "retainpdf_pipeline.translate.workflow.execution_plan",
        "retainpdf_pipeline.translate.core.engine_identity",
        "retainpdf_pipeline.translate.core.payload.parts.fingerprints",
        "retainpdf_pipeline.translate.core.payload.parts.units",
        # 「这个块算不算跑完、跑完了阻不阻断导出」的唯一真相源。提交门禁必须和
        # 导出门禁用同一套口径,否则会出现 blocking_after=0 放行了导出、
        # pending_item_count 却不为零把 validating 崩掉。方向是 workflow -> artifacts,
        # 与 phases 层已有的那条一致。
        "retainpdf_pipeline.translate.artifacts",
    ),
    "phases": (
        "retainpdf_pipeline.translate.workflow.phases",
        "retainpdf_pipeline.translate.workflow.batching.pending_units",
        "retainpdf_pipeline.translate.workflow.pages",
        "retainpdf_pipeline.translate.workflow.page_policies",
        "retainpdf_pipeline.translate.artifacts",
        # provider 身份判定的唯一真相源;阶段代码只准读它,不准自己嗅 base_url/model。
        "retainpdf_pipeline.translate.core.provider_identity",
        "retainpdf_pipeline.translate.llm.shared.control_context",
        "retainpdf_pipeline.translate.llm.shared.provider_runtime",
        "retainpdf_pipeline.translate.services.agents",
        "retainpdf_pipeline.translate.services.finalization",
        "retainpdf_pipeline.translate.services.policy",
        "retainpdf_pipeline.translate.services.postprocess",
        "retainpdf_pipeline.services.pipeline_shared.events",
    ),
    "scheduling": (
        "retainpdf_pipeline.translate.workflow.scheduling",
        "retainpdf_pipeline.translate.llm.shared.control_context",
        "retainpdf_pipeline.translate.llm.shared.orchestration.batched_plain_single",
        "retainpdf_pipeline.translate.llm.shared.orchestration.terminal_payloads",
        "retainpdf_pipeline.translate.llm.shared.tail_retry_queue",
        "retainpdf_pipeline.translate.services.results.applier",
        "retainpdf_pipeline.translate.services.results.flush",
    ),
    "batching": (
        "retainpdf_pipeline.translate.workflow.batching",
        "retainpdf_pipeline.translate.workflow.batch_runner",
        "retainpdf_pipeline.translate.workflow.scheduling",
        "retainpdf_pipeline.translate.core",
        "retainpdf_pipeline.translate.llm",
        "retainpdf_pipeline.translate.services.context",
        "retainpdf_pipeline.translate.services.fast_path",
        "retainpdf_pipeline.translate.services.memory",
        "retainpdf_pipeline.translate.services.results",
    ),
    "legacy": (
        "retainpdf_pipeline.translate.workflow.legacy",
        "retainpdf_pipeline.translate.core.payload",
        "retainpdf_pipeline.translate.llm.shared.orchestration",
        "retainpdf_pipeline.translate.llm.shared.provider_runtime",
        "retainpdf_pipeline.translate.services.continuation",
        "retainpdf_pipeline.translate.services.policy",
    ),
}
TRANSLATION_WORKFLOW_PRIVATE_IMPORT_EXCEPTIONS: dict[Path, tuple[str, ...]] = {
    # Compatibility facades intentionally re-export old private names while callers migrate.
    Path("workflow/stages.py"): (
        "retainpdf_pipeline.translate.workflow.phases.repair._agent_repair_limit_from_env",
    ),
    Path("workflow/workers.py"): (
        "retainpdf_pipeline.translate.workflow.scheduling.allocation._",
    ),
    Path("workflow/batch_plan.py"): (
        "retainpdf_pipeline.translate.workflow.scheduling.allocation._",
    ),
    Path("workflow/batch_runner.py"): (
        "retainpdf_pipeline.translate.workflow.batching.executor._translate_batch_or_keep_origin",
        "retainpdf_pipeline.translate.workflow.scheduling.failures._failed_results_for_unhandled_batch_exception",
        "retainpdf_pipeline.translate.workflow.scheduling.tail_retry._",
    ),
    Path("workflow/batch_plan.py"): (
        "retainpdf_pipeline.translate.workflow.batching.plan._",
        "retainpdf_pipeline.translate.workflow.scheduling.allocation._",
    ),
    Path("workflow/execution_plan.py"): (
        "retainpdf_pipeline.translate.workflow.scheduling.allocation._adaptive_floor_limit",
        "retainpdf_pipeline.translate.workflow.scheduling.allocation._adaptive_initial_limit",
    ),
    Path("workflow/batching/plan.py"): (
        "retainpdf_pipeline.translate.workflow.batching.batching._",
        "retainpdf_pipeline.translate.workflow.batching.dedupe._",
        "retainpdf_pipeline.translate.workflow.scheduling.allocation._",
    ),
    Path("workflow/batching/pending_units.py"): (
        "retainpdf_pipeline.translate.workflow.batching.executor._",
        "retainpdf_pipeline.translate.workflow.batching.plan._",
        "retainpdf_pipeline.translate.workflow.scheduling.allocation._",
    ),
    Path("workflow/scheduling/tail_retry.py"): (
        "retainpdf_pipeline.translate.workflow.scheduling.failures._failed_results_for_unhandled_batch_exception",
    ),
}
TRANSLATION_LAYER_IMPORT_RULES: dict[str, tuple[str, ...]] = {
    "entrypoints": (
        "retainpdf_pipeline.translate.entrypoints",
        "retainpdf_pipeline.translate.artifacts",
        "retainpdf_pipeline.translate.llm",
        "retainpdf_pipeline.translate.services.terms",
        "retainpdf_pipeline.translate.workflow",
        "retainpdf_pipeline.translate.translation_stage",
    ),
    "core": (
        "retainpdf_pipeline.translate.core",
        "retainpdf_pipeline.translate.prompt_loader",
    ),
    "workflow": (
        "retainpdf_pipeline.translate.workflow",
        "retainpdf_pipeline.translate.workflow.batching",
        "retainpdf_pipeline.translate.workflow.legacy",
        "retainpdf_pipeline.translate.workflow.phases",
        "retainpdf_pipeline.translate.workflow.scheduling",
        "retainpdf_pipeline.translate.services.classification",
        "retainpdf_pipeline.translate.core",
        "retainpdf_pipeline.translate.services.context",
        "retainpdf_pipeline.translate.services.continuation",
        "retainpdf_pipeline.translate.artifacts",
        "retainpdf_pipeline.translate.services.fast_path",
        "retainpdf_pipeline.translate.services.finalization",
        "retainpdf_pipeline.translate.llm",
        "retainpdf_pipeline.translate.services.memory",
        "retainpdf_pipeline.translate.core.ocr",
        "retainpdf_pipeline.translate.core.orchestration",
        "retainpdf_pipeline.translate.core.payload",
        "retainpdf_pipeline.translate.services.agents",
        "retainpdf_pipeline.translate.services.policy",
        "retainpdf_pipeline.translate.services.postprocess",
        "retainpdf_pipeline.translate.services.results",
        "retainpdf_pipeline.translate.services.terms",
    ),
    "llm": (
        "retainpdf_pipeline.translate.llm",
        "retainpdf_pipeline.translate.core",
        "retainpdf_pipeline.translate.artifacts",
        "retainpdf_pipeline.translate.core.payload",
        "retainpdf_pipeline.translate.prompt_loader",
    ),
    "services": (
        "retainpdf_pipeline.translate.services",
        "retainpdf_pipeline.translate.core",
        "retainpdf_pipeline.translate.core.item_reader",
        "retainpdf_pipeline.translate.llm",
        "retainpdf_pipeline.translate.artifacts",
        "retainpdf_pipeline.translate.prompt_loader",
    ),
    "artifacts": (
        "retainpdf_pipeline.translate.artifacts",
        "retainpdf_pipeline.translate.core",
        "retainpdf_pipeline.translate.core.payload",
    ),
    "prompts": (
        "retainpdf_pipeline.translate.prompts",
    ),
    "public": (
        "retainpdf_pipeline.translate.public",
        "retainpdf_pipeline.translate.artifacts",
        "retainpdf_pipeline.translate.core",
        "retainpdf_pipeline.translate.core.payload",
        "retainpdf_pipeline.translate.core.terms",
        "retainpdf_pipeline.translate.llm.shared.provider_runtime",
        "retainpdf_pipeline.translate.workflow",
    ),
    "policy": (
        "retainpdf_pipeline.translate.services.policy",
        "retainpdf_pipeline.translate.prompt_loader",
        # Historical policy modules still inspect OCR contracts and LLM domain hints.
        # T17-T18 will narrow this to decision-only inputs.
        "retainpdf_pipeline.translate.services.classification",
        "retainpdf_pipeline.translate.core",
        "retainpdf_pipeline.translate.services.context",
        "retainpdf_pipeline.translate.llm.domain_context",
        "retainpdf_pipeline.translate.llm.shared.provider_runtime",
        "retainpdf_pipeline.translate.core.ocr",
        "retainpdf_pipeline.translate.core.payload",
    ),
    "payload": (
        "retainpdf_pipeline.translate.core.payload",
        "retainpdf_pipeline.translate.core",
        "retainpdf_pipeline.translate.core.ocr",
    ),
    "memory": (
        "retainpdf_pipeline.translate.services.memory",
        "retainpdf_pipeline.translate.services.terms",
    ),
    "context": (
        "retainpdf_pipeline.translate.services.context",
        "retainpdf_pipeline.translate.core.context",
        "retainpdf_pipeline.translate.llm.shared.control_context",
        "retainpdf_pipeline.translate.llm.style_hints",
        "retainpdf_pipeline.translate.services.policy",
        "retainpdf_pipeline.translate.services.terms",
    ),
    "ocr": (
        "retainpdf_pipeline.translate.core.ocr",
        "retainpdf_pipeline.translate.core.continuation_hints",
        "retainpdf_pipeline.translate.core.legacy_compat",
        "retainpdf_pipeline.translate.core.classification",
        "retainpdf_pipeline.translate.core.text_flow",
    ),
    "orchestration": (
        "retainpdf_pipeline.translate.core.orchestration",
        "retainpdf_pipeline.translate.core",
        "retainpdf_pipeline.translate.services.context",
        "retainpdf_pipeline.translate.services.continuation",
        "retainpdf_pipeline.translate.core.ocr",
        "retainpdf_pipeline.translate.core.payload",
    ),
    "continuation": (
        "retainpdf_pipeline.translate.services.continuation",
        "retainpdf_pipeline.translate.prompt_loader",
        "retainpdf_pipeline.translate.services.context",
        # Continuation review currently asks LLM for borderline cases.
        "retainpdf_pipeline.translate.llm",
    ),
    "classification": (
        "retainpdf_pipeline.translate.services.classification",
        "retainpdf_pipeline.translate.prompt_loader",
        "retainpdf_pipeline.translate.core",
        "retainpdf_pipeline.translate.services.context",
        "retainpdf_pipeline.translate.llm",
        "retainpdf_pipeline.translate.core.ocr",
        "retainpdf_pipeline.translate.services.policy",
    ),
    "terms": (
        "retainpdf_pipeline.translate.services.terms",
        "retainpdf_pipeline.translate.core.terms",
    ),
    "diagnostics": (
        "retainpdf_pipeline.translate.artifacts",
        "retainpdf_pipeline.translate.services.agents",
        "retainpdf_pipeline.translate.core",
        "retainpdf_pipeline.translate.llm.shared.control_context",
        "retainpdf_pipeline.translate.core.payload",
    ),
    "agents": (
        "retainpdf_pipeline.translate.services.agents",
        "retainpdf_pipeline.translate.llm",
        "retainpdf_pipeline.translate.services.quality",
        "retainpdf_pipeline.translate.services.terms",
    ),
    "quality": (
        "retainpdf_pipeline.translate.core",
        "retainpdf_pipeline.translate.core.item_reader",
        "retainpdf_pipeline.translate.llm",
        "retainpdf_pipeline.translate.services.quality",
        "retainpdf_pipeline.translate.services.terms",
    ),
    "postprocess": (
        "retainpdf_pipeline.translate.services.postprocess",
        "retainpdf_pipeline.translate.llm",
    ),
}
TRANSLATION_LAYER_IMPORT_EXCEPTIONS: dict[Path, tuple[str, ...]] = {
    # Current llm orchestration still bridges workflow-ish retry behavior until T04-T10 migrate runtime flow.
    Path("llm/shared/orchestration/fallbacks.py"): (
        "retainpdf_pipeline.translate.services.postprocess",
    ),
}
# Frozen migration debt: exact importing file AND exact imported module only.
# These are existing orchestration/validation bridges, not permission for a
# whole package to depend on another layer. Remove each edge as owners converge.
TRANSLATION_LAYER_FROZEN_IMPORTS: dict[Path, frozenset[str]] = {
    Path("services/agents/repair_pipeline.py"): frozenset({
        "retainpdf_pipeline.translate.artifacts.status",
        "retainpdf_pipeline.translate.core.payload",
        "retainpdf_pipeline.translate.core.payload.parts.diagnostics",
        "retainpdf_pipeline.translate.services.policy",
    }),
    Path("services/agents/review_artifact.py"): frozenset({
        "retainpdf_pipeline.translate.artifacts.review",
    }),
    Path("services/continuation/orchestrator.py"): frozenset({
        "retainpdf_pipeline.translate.core.orchestration.units",
        "retainpdf_pipeline.translate.core.orchestration.zones",
    }),
    Path("services/postprocess/garbled_reconstruction.py"): frozenset({
        "retainpdf_pipeline.translate.artifacts.status",
        "retainpdf_pipeline.translate.core.payload.formula_protection",
        "retainpdf_pipeline.translate.core.payload.parts.apply",
        "retainpdf_pipeline.translate.core.payload.parts.common",
        "retainpdf_pipeline.translate.core.payload.parts.diagnostics",
        "retainpdf_pipeline.translate.core.payload.parts.final_status",
        "retainpdf_pipeline.translate.core.payload.parts.policy_state",
        "retainpdf_pipeline.translate.core.payload.parts.result_entries",
        "retainpdf_pipeline.translate.core.payload.parts.units",
        "retainpdf_pipeline.translate.services.policy",
        "retainpdf_pipeline.translate.services.quality",
    }),
}
TRANSLATION_RENDERING_IMPORT_EXCEPTIONS: dict[Path, tuple[str, ...]] = {
    # Translation can start render-source prewarm in parallel with LLM work, but
    # must not reach into broader rendering internals.
    Path("workflow/execution_runner.py"): (
        "retainpdf_pipeline.render.source.prewarm",
    ),
}
TRANSLATION_SHARED_COMPAT_IMPORTS = (
    "retainpdf_pipeline.translate.core.item_reader",
    "retainpdf_pipeline.translate.services.context.session_context",
)
TRANSLATION_REMOVED_COMPAT_IMPORTS = (
    "retainpdf_pipeline.translate.from_ocr_pipeline",
    "retainpdf_pipeline.translate.translate_only_pipeline",
    "retainpdf_pipeline.translate.item_reader",
    "retainpdf_pipeline.translate.session_context",
    "retainpdf_pipeline.translate.services.context.models",
    "retainpdf_pipeline.translate.services.context.unit_context",
    "retainpdf_pipeline.translate.services.terms.glossary",
    "retainpdf_pipeline.translate.services.terms.abbreviations",
    "retainpdf_pipeline.translate.services.terms.injection",
    "retainpdf_pipeline.translate.services.quality.checks",
)
DEVTOOLS_TRANSLATION_INTERNAL_IMPORT_ALLOWLIST = {
    Path("inspect_translation_repair_candidates.py"),
    Path("job_debug_runner.py"),
    Path("replay_translation_item.py"),
    Path("run_golden_flow.py"),
    Path("translation_repair_runner.py"),
}
DEVTOOLS_TRANSLATION_INTERNAL_DIR_ALLOWLIST = {
    "experiments",
    "promptfoo",
    "tests",
}


def translation_layer_for(path: Path) -> str | None:
    try:
        parts = path.relative_to(TRANSLATION_ROOT).parts
    except ValueError:
        return None
    if not parts:
        return None
    first = parts[0]
    if len(parts) > 2 and (first == "services" or
                           (first == "core" and parts[1] in {"payload", "ocr", "orchestration"})):
        specific = parts[1]
        if specific in TRANSLATION_LAYER_IMPORT_RULES:
            return specific
    return first if first in TRANSLATION_ALLOWED_ROOT_DIRS else None
