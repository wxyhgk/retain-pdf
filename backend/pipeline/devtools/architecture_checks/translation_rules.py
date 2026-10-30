from __future__ import annotations

from pathlib import Path

from devtools.architecture_checks.common import PACKAGE_ROOT
from devtools.architecture_checks.common import SCRIPTS_ROOT
from devtools.architecture_checks.common import TRANSLATION_PACKAGE_ROOT

PIPELINE_ROOT = PACKAGE_ROOT / "runtime" / "pipeline"
DOCUMENT_SCHEMA_ROOT = PACKAGE_ROOT / "ocr" / "document_schema"
# 翻译库本体：独立包 retainpdf-translation（backend/translation/retainpdf_translation）。
# 只许依赖自己、底座包 retainpdf_base 和公式包 retainpdf_math，不许 import 流水线。
TRANSLATION_ROOT = TRANSLATION_PACKAGE_ROOT
# 流水线里的翻译 worker 外壳：Rust 用 `python -m retainpdf_pipeline.translate` 启动，
# 外壳读 stage spec、建任务目录，再调翻译包的 public 门面。
TRANSLATION_SHELL_ROOT = PACKAGE_ROOT / "translate"
RENDERING_ROOT = PACKAGE_ROOT / "render"
DEVTOOLS_ROOT = SCRIPTS_ROOT / "devtools"
TRANSLATION_STAGE_PIPELINE = TRANSLATION_SHELL_ROOT / "translation_stage.py"

TRANSLATE_ONLY_ENTRYPOINT = TRANSLATION_SHELL_ROOT / "entrypoints" / "translate_only_pipeline.py"
FROM_OCR_ENTRYPOINT = TRANSLATION_SHELL_ROOT / "entrypoints" / "from_ocr_pipeline.py"
TRANSLATION_ALLOWED_ROOT_DIRS = {
    "artifacts",
    "core",
    "llm",
    "prompts",
    "public",
    "services",
    "workflow",
}
TRANSLATION_ALLOWED_ROOT_FILES = {
    "__init__.py",
    "prompt_loader.py",
}
TRANSLATION_SHELL_ALLOWED_DIRS = {
    "entrypoints",
}
TRANSLATION_SHELL_ALLOWED_FILES = {
    "__init__.py",
    "__main__.py",
    "README.md",
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
    # 翻译引擎 agent 的整书流程（translation.engine=agent），和 book_flow.py 同一层
    "agent_flow.py",
    "batch_plan.py",
    "batch_runner.py",
    "book_flow.py",
    "editorial.py",
    "execution.py",
    "execution_plan.py",
    "execution_runner.py",
    "page_policies.py",
    "page_range.py",
    "pages.py",
    "recovery.py",
    "refine.py",
    "revision.py",
    "stages.py",
    "translation_workflow.py",
    "workers.py",
}
TRANSLATION_WORKFLOW_SUBPACKAGE_RULES: dict[str, tuple[str, ...]] = {
    "checkpoint": (
        "retainpdf_translation.workflow.checkpoint",
        "retainpdf_translation.workflow.execution",
        "retainpdf_translation.workflow.execution_plan",
        "retainpdf_translation.core.engine_identity",
        "retainpdf_translation.core.payload.parts.fingerprints",
        "retainpdf_translation.core.payload.parts.units",
        # 「这个块算不算跑完、跑完了阻不阻断导出」的唯一真相源。提交门禁必须和
        # 导出门禁用同一套口径,否则会出现 blocking_after=0 放行了导出、
        # pending_item_count 却不为零把 validating 崩掉。方向是 workflow -> artifacts,
        # 与 phases 层已有的那条一致。
        "retainpdf_translation.artifacts",
    ),
    "phases": (
        "retainpdf_translation.workflow.phases",
        "retainpdf_translation.workflow.batching.pending_units",
        "retainpdf_translation.workflow.pages",
        "retainpdf_translation.workflow.page_policies",
        "retainpdf_translation.artifacts",
        # provider 身份判定的唯一真相源;阶段代码只准读它,不准自己嗅 base_url/model。
        "retainpdf_translation.core.provider_identity",
        "retainpdf_translation.llm.shared.control_context",
        "retainpdf_translation.llm.shared.provider_runtime",
        "retainpdf_translation.services.agents",
        "retainpdf_translation.services.finalization",
        "retainpdf_translation.services.policy",
        "retainpdf_translation.services.postprocess",
        "retainpdf_base.events",
    ),
    "scheduling": (
        "retainpdf_translation.workflow.scheduling",
        "retainpdf_translation.llm.shared.control_context",
        "retainpdf_translation.llm.shared.orchestration.batched_plain_single",
        "retainpdf_translation.llm.shared.orchestration.terminal_payloads",
        "retainpdf_translation.llm.shared.tail_retry_queue",
        "retainpdf_translation.services.results.applier",
        "retainpdf_translation.services.results.flush",
    ),
    "batching": (
        "retainpdf_translation.workflow.batching",
        "retainpdf_translation.workflow.batch_runner",
        "retainpdf_translation.workflow.scheduling",
        "retainpdf_translation.core",
        "retainpdf_translation.llm",
        "retainpdf_translation.services.context",
        "retainpdf_translation.services.fast_path",
        "retainpdf_translation.services.memory",
        "retainpdf_translation.services.results",
    ),
    "legacy": (
        "retainpdf_translation.workflow.legacy",
        "retainpdf_translation.core.payload",
        "retainpdf_translation.llm.shared.orchestration",
        "retainpdf_translation.llm.shared.provider_runtime",
        "retainpdf_translation.services.continuation",
        "retainpdf_translation.services.policy",
    ),
}
TRANSLATION_WORKFLOW_PRIVATE_IMPORT_EXCEPTIONS: dict[Path, tuple[str, ...]] = {
    # Compatibility facades intentionally re-export old private names while callers migrate.
    Path("workflow/stages.py"): (
        "retainpdf_translation.workflow.phases.repair._agent_repair_limit_from_env",
    ),
    Path("workflow/workers.py"): (
        "retainpdf_translation.workflow.scheduling.allocation._",
    ),
    Path("workflow/batch_plan.py"): (
        "retainpdf_translation.workflow.scheduling.allocation._",
    ),
    Path("workflow/batch_runner.py"): (
        "retainpdf_translation.workflow.batching.executor._translate_batch_or_keep_origin",
        "retainpdf_translation.workflow.scheduling.failures._failed_results_for_unhandled_batch_exception",
        "retainpdf_translation.workflow.scheduling.tail_retry._",
    ),
    Path("workflow/batch_plan.py"): (
        "retainpdf_translation.workflow.batching.plan._",
        "retainpdf_translation.workflow.scheduling.allocation._",
    ),
    Path("workflow/execution_plan.py"): (
        "retainpdf_translation.workflow.scheduling.allocation._adaptive_floor_limit",
        "retainpdf_translation.workflow.scheduling.allocation._adaptive_initial_limit",
    ),
    Path("workflow/batching/plan.py"): (
        "retainpdf_translation.workflow.batching.batching._",
        "retainpdf_translation.workflow.batching.dedupe._",
        "retainpdf_translation.workflow.scheduling.allocation._",
    ),
    Path("workflow/batching/pending_units.py"): (
        "retainpdf_translation.workflow.batching.executor._",
        "retainpdf_translation.workflow.batching.plan._",
        "retainpdf_translation.workflow.scheduling.allocation._",
    ),
    Path("workflow/scheduling/tail_retry.py"): (
        "retainpdf_translation.workflow.scheduling.failures._failed_results_for_unhandled_batch_exception",
    ),
}
TRANSLATION_LAYER_IMPORT_RULES: dict[str, tuple[str, ...]] = {
    "entrypoints": (
        "retainpdf_pipeline.translate.entrypoints",
        "retainpdf_translation.artifacts",
        "retainpdf_translation.llm",
        "retainpdf_translation.services.terms",
        "retainpdf_translation.workflow",
        "retainpdf_pipeline.translate.translation_stage",
    ),
    "core": (
        "retainpdf_translation.core",
        "retainpdf_translation.prompt_loader",
    ),
    "workflow": (
        "retainpdf_translation.workflow",
        "retainpdf_translation.workflow.batching",
        "retainpdf_translation.workflow.legacy",
        "retainpdf_translation.workflow.phases",
        "retainpdf_translation.workflow.scheduling",
        "retainpdf_translation.services.classification",
        "retainpdf_translation.core",
        "retainpdf_translation.services.context",
        "retainpdf_translation.services.continuation",
        "retainpdf_translation.artifacts",
        "retainpdf_translation.services.fast_path",
        "retainpdf_translation.services.finalization",
        "retainpdf_translation.llm",
        "retainpdf_translation.services.memory",
        "retainpdf_translation.core.ocr",
        "retainpdf_translation.core.orchestration",
        "retainpdf_translation.core.payload",
        "retainpdf_translation.services.agents",
        "retainpdf_translation.services.policy",
        "retainpdf_translation.services.postprocess",
        # 译前准备（术语预扫 / 风格指南）在建执行计划时跑一次，产物冻结后注入上下文。
        "retainpdf_translation.services.preparation",
        "retainpdf_translation.services.results",
        "retainpdf_translation.services.terms",
        # 翻译收尾生成确定性 QA 报告（translation_qa.v1.json），只读 payload、只写报告。
        "retainpdf_translation.services.quality.qa",
        # 译后精修（workflow/refine.py）：挑错 / 定点修改的纯逻辑，写回仍走 workflow/revision.py。
        "retainpdf_translation.services.refine",
        # 编辑部（workflow/editorial.py）：台账、主编规则框、整块重写的纯逻辑；写回同样走 revision.py。
        "retainpdf_translation.services.editorial",
    ),
    "llm": (
        "retainpdf_translation.llm",
        "retainpdf_translation.core",
        "retainpdf_translation.artifacts",
        "retainpdf_translation.core.payload",
        "retainpdf_translation.prompt_loader",
    ),
    "services": (
        "retainpdf_translation.services",
        "retainpdf_translation.core",
        "retainpdf_translation.core.item_reader",
        "retainpdf_translation.llm",
        "retainpdf_translation.artifacts",
        "retainpdf_translation.prompt_loader",
    ),
    "artifacts": (
        "retainpdf_translation.artifacts",
        "retainpdf_translation.core",
        "retainpdf_translation.core.payload",
    ),
    "prompts": (
        "retainpdf_translation.prompts",
    ),
    "public": (
        "retainpdf_translation.public",
        "retainpdf_translation.artifacts",
        "retainpdf_translation.core",
        "retainpdf_translation.core.payload",
        "retainpdf_translation.core.terms",
        "retainpdf_translation.llm.shared.provider_runtime",
        "retainpdf_translation.workflow",
    ),
    "policy": (
        "retainpdf_translation.services.policy",
        "retainpdf_translation.prompt_loader",
        # Historical policy modules still inspect OCR contracts and LLM domain hints.
        # T17-T18 will narrow this to decision-only inputs.
        "retainpdf_translation.services.classification",
        "retainpdf_translation.core",
        "retainpdf_translation.services.context",
        "retainpdf_translation.llm.domain_context",
        "retainpdf_translation.llm.shared.provider_runtime",
        "retainpdf_translation.core.ocr",
        "retainpdf_translation.core.payload",
    ),
    "payload": (
        "retainpdf_translation.core.payload",
        "retainpdf_translation.core",
        "retainpdf_translation.core.ocr",
    ),
    "memory": (
        "retainpdf_translation.services.memory",
        "retainpdf_translation.services.terms",
    ),
    "context": (
        "retainpdf_translation.services.context",
        "retainpdf_translation.core.context",
        "retainpdf_translation.llm.shared.control_context",
        "retainpdf_translation.llm.style_hints",
        "retainpdf_translation.services.policy",
        "retainpdf_translation.services.terms",
    ),
    "ocr": (
        "retainpdf_translation.core.ocr",
        "retainpdf_translation.core.continuation_hints",
        "retainpdf_translation.core.legacy_compat",
        "retainpdf_translation.core.classification",
        "retainpdf_translation.core.text_flow",
    ),
    "orchestration": (
        "retainpdf_translation.core.orchestration",
        "retainpdf_translation.core",
        "retainpdf_translation.services.context",
        "retainpdf_translation.services.continuation",
        "retainpdf_translation.core.ocr",
        "retainpdf_translation.core.payload",
    ),
    "continuation": (
        "retainpdf_translation.services.continuation",
        "retainpdf_translation.prompt_loader",
        "retainpdf_translation.services.context",
        # Continuation review currently asks LLM for borderline cases.
        "retainpdf_translation.llm",
    ),
    "classification": (
        "retainpdf_translation.services.classification",
        "retainpdf_translation.prompt_loader",
        "retainpdf_translation.core",
        "retainpdf_translation.services.context",
        "retainpdf_translation.llm",
        "retainpdf_translation.core.ocr",
        "retainpdf_translation.services.policy",
    ),
    "terms": (
        "retainpdf_translation.services.terms",
        "retainpdf_translation.core.terms",
    ),
    "diagnostics": (
        "retainpdf_translation.artifacts",
        "retainpdf_translation.services.agents",
        "retainpdf_translation.core",
        "retainpdf_translation.llm.shared.control_context",
        "retainpdf_translation.core.payload",
    ),
    "agents": (
        "retainpdf_translation.services.agents",
        "retainpdf_translation.llm",
        "retainpdf_translation.services.quality",
        "retainpdf_translation.services.terms",
    ),
    "quality": (
        "retainpdf_translation.core",
        "retainpdf_translation.core.item_reader",
        "retainpdf_translation.llm",
        "retainpdf_translation.services.quality",
        "retainpdf_translation.services.terms",
    ),
    "postprocess": (
        "retainpdf_translation.services.postprocess",
        "retainpdf_translation.llm",
    ),
}
TRANSLATION_LAYER_IMPORT_EXCEPTIONS: dict[Path, tuple[str, ...]] = {
    # Current llm orchestration still bridges workflow-ish retry behavior until T04-T10 migrate runtime flow.
    Path("llm/shared/orchestration/fallbacks.py"): (
        "retainpdf_translation.services.postprocess",
    ),
}
# Frozen migration debt: exact importing file AND exact imported module only.
# These are existing orchestration/validation bridges, not permission for a
# whole package to depend on another layer. Remove each edge as owners converge.
TRANSLATION_LAYER_FROZEN_IMPORTS: dict[Path, frozenset[str]] = {
    Path("services/agents/repair_pipeline.py"): frozenset({
        "retainpdf_translation.artifacts.status",
        "retainpdf_translation.core.payload",
        "retainpdf_translation.core.payload.parts.diagnostics",
        "retainpdf_translation.services.policy",
    }),
    Path("services/agents/review_artifact.py"): frozenset({
        "retainpdf_translation.artifacts.review",
    }),
    Path("services/continuation/orchestrator.py"): frozenset({
        "retainpdf_translation.core.orchestration.units",
        "retainpdf_translation.core.orchestration.zones",
    }),
    Path("services/postprocess/garbled_reconstruction.py"): frozenset({
        "retainpdf_translation.artifacts.status",
        "retainpdf_translation.core.payload.formula_protection",
        "retainpdf_translation.core.payload.parts.apply",
        "retainpdf_translation.core.payload.parts.common",
        "retainpdf_translation.core.payload.parts.diagnostics",
        "retainpdf_translation.core.payload.parts.final_status",
        "retainpdf_translation.core.payload.parts.policy_state",
        "retainpdf_translation.core.payload.parts.result_entries",
        "retainpdf_translation.core.payload.parts.units",
        "retainpdf_translation.services.policy",
        "retainpdf_translation.services.quality",
    }),
}
# 以前 workflow/execution_runner.py 能启动渲染预热（retainpdf_pipeline.render.source.prewarm），
# 那处 import 早已不在；翻译拆成独立包以后也不可能再 import 渲染（流水线依赖翻译包，反过来成环）。
TRANSLATION_RENDERING_IMPORT_EXCEPTIONS: dict[Path, tuple[str, ...]] = {}
TRANSLATION_SHARED_COMPAT_IMPORTS = (
    "retainpdf_translation.core.item_reader",
    "retainpdf_translation.services.context.session_context",
)
TRANSLATION_REMOVED_COMPAT_IMPORTS = (
    "retainpdf_pipeline.translate.from_ocr_pipeline",
    "retainpdf_pipeline.translate.translate_only_pipeline",
    "retainpdf_pipeline.translate.item_reader",
    "retainpdf_pipeline.translate.session_context",
    "retainpdf_translation.services.context.models",
    "retainpdf_translation.services.context.unit_context",
    "retainpdf_translation.services.terms.glossary",
    "retainpdf_translation.services.terms.abbreviations",
    "retainpdf_translation.services.terms.injection",
    "retainpdf_translation.services.quality.checks",
)
DEVTOOLS_TRANSLATION_INTERNAL_IMPORT_ALLOWLIST = {
    Path("inspect_translation_repair_candidates.py"),
    Path("job_debug_runner.py"),
    Path("replay_translation_item.py"),
    Path("run_translation_qa.py"),
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
        shell_parts = path.relative_to(TRANSLATION_SHELL_ROOT).parts
    except ValueError:
        shell_parts = ()
    if shell_parts:
        return "entrypoints" if shell_parts[0] == "entrypoints" else None
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
