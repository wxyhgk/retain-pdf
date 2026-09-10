from __future__ import annotations

import hashlib

from retainpdf_pipeline.translate.prompt_loader import load_prompt


_PROMPT_HASHES: dict[str, str] = {}
FORMULA_SEGMENT_STRATEGY_VERSION = "formula_segments_v2"
PLAIN_TEXT_STRATEGY_VERSION = "plain_text_v2"
TRANSLATION_PROTOCOL_VERSION = "translation_control_v8_compact_prompt"
TRANSLATION_POLICY_VERSION = "policy_hints_v2_memory_context_v1"
TRANSLATION_PROMPT_FILES = (
    "translation_system.txt",
    "translation_system_plain_text.txt",
    "translation_task.txt",
    "translation_task_plain_text.txt",
    "translation_direct_typst_guidance.txt",
    "translation_output_json.txt",
    "translation_output_plain_text.txt",
    "translation_output_single_json.txt",
    "translation_output_tagged.txt",
)


def translation_engine_identity(*, mode: str = "fast") -> dict[str, str]:
    """Return the prompt/protocol identity that makes output reusable."""
    identity = {
        "prompt_hash": _prompt_hash(mode=mode),
        "translation_protocol_version": TRANSLATION_PROTOCOL_VERSION,
        "translation_policy_version": TRANSLATION_POLICY_VERSION,
        "formula_segment_strategy_version": FORMULA_SEGMENT_STRATEGY_VERSION,
        "plain_text_strategy_version": PLAIN_TEXT_STRATEGY_VERSION,
    }
    from retainpdf_pipeline.translate.core.execution_policy import execution_enabled, strategy
    if execution_enabled():
        import os
        identity["model_transport"] = "rust_executor_v1"
        identity["scheduler"] = "shared_page_order_v1"
        identity["optimization"] = strategy()
        identity["connection_fingerprint"] = os.environ.get("RETAIN_MODEL_CONNECTION_FINGERPRINT", "")
    return identity


def _prompt_hash(mode: str = "fast") -> str:
    cache_key = mode.strip() or "fast"
    cached = _PROMPT_HASHES.get(cache_key)
    if cached:
        return cached
    digest = hashlib.sha256()
    for prompt_name in TRANSLATION_PROMPT_FILES:
        digest.update(f"\n--- {prompt_name} ---\n".encode("utf-8"))
        digest.update(load_prompt(prompt_name).encode("utf-8"))
    if cache_key == "sci":
        digest.update(b"\n---\n")
        digest.update(b"SCI_LOCAL_DECISION_PLAIN_TEXT_V1")
    result = digest.hexdigest()
    _PROMPT_HASHES[cache_key] = result
    return result


__all__ = [
    "FORMULA_SEGMENT_STRATEGY_VERSION",
    "PLAIN_TEXT_STRATEGY_VERSION",
    "TRANSLATION_POLICY_VERSION",
    "TRANSLATION_PROMPT_FILES",
    "TRANSLATION_PROTOCOL_VERSION",
    "translation_engine_identity",
]
