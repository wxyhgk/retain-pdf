"""普通翻译引擎的译前准备（整书的一个阶段），执行计划按引擎登记表（`workflow.engines`）调到这里（2026-11-20 拆包第 1 步，
从 `workflow.execution_plan._run_translation_preparation` 挪来，行为不变）。"""

from __future__ import annotations

from retainpdf_translation.artifacts import TranslationRunDiagnostics
from retainpdf_translation.artifacts import translation_run_diagnostics_scope
from retainpdf_translation.services.policy import TranslationPolicyConfig
from retainpdf_translation.services.preparation.runner import TranslationPreparation
from retainpdf_translation.services.preparation.runner import prepare_translation
from retainpdf_translation.services.terms import GlossaryEntry
from retainpdf_translation.workflow.checkpoint.preparation import PrescanCheckpoint
from retainpdf_translation.workflow.checkpoint.preparation import prescan_checkpoint_path


def run_translation_preparation(
    request,
    *,
    mode: str,
    data: dict,
    page_indices: range,
    policy_config: TranslationPolicyConfig,
    glossary_entries: list[GlossaryEntry],
    run_diagnostics: TranslationRunDiagnostics,
) -> TranslationPreparation:
    print(f"translation preparation: mode={mode}", flush=True)
    checkpoint_path = prescan_checkpoint_path(request.output_dir)
    with translation_run_diagnostics_scope(run_diagnostics):
        return prepare_translation(
            mode=mode,
            data=data,
            page_indices=page_indices,
            output_dir=request.output_dir,
            source_json_path=request.source_json_path,
            api_key=request.api_key,
            model=request.model,
            base_url=request.base_url,
            workers=max(1, request.workers),
            domain_context=dict(policy_config.domain_context or {}),
            rule_profile_name=policy_config.rule_profile_name,
            rule_guidance=policy_config.rule_guidance,
            custom_rules_text=policy_config.custom_rules_text,
            user_glossary_entries=glossary_entries,
            batch_store_factory=lambda fingerprint: PrescanCheckpoint(checkpoint_path, fingerprint=fingerprint),
        )


__all__ = ["run_translation_preparation"]
