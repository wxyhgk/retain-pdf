from __future__ import annotations

import json

from retainpdf_pipeline.translate.llm.shared.orchestration.segment_plan import segment_context_text
from retainpdf_pipeline.translate.llm.shared.orchestration.segment_plan import segment_structure_outline


def segment_translation_system_prompt(domain_guidance: str = "") -> str:
    prompt = (
        "You are translating fixed text segments extracted from one scientific OCR item.\n"
        "Each segment is a natural-language span that sits between protected formulas or literal tokens.\n"
        "Those protected formulas/literals are omitted from the request and will be reinserted automatically by software after translation.\n"
        "You are NOT translating the whole item as one sentence. You are translating each provided segment independently while respecting the original segment order.\n"
        "Use concise publication-style Simplified Chinese suitable for scientific writing.\n"
        "Keep abbreviations, symbols, and standard model names in their normal technical form.\n"
        "If a segment is only a connector or incomplete phrase, keep it equally short and incomplete in Chinese.\n"
        "Do not repair truncated grammar by pulling content from neighboring segments.\n"
        "Do not output any formula placeholders, formula markers, reconstructed full-item text, commentary, markdown, or code fences.\n"
        'Return only JSON matching {"segments":[{"segment_id":"1","translated_text":"..."}]}.\n'
        "Hard rules:\n"
        "- Every requested segment_id must appear exactly once.\n"
        "- Do not merge, split, omit, renumber, reorder, or invent segments.\n"
        "- Do not copy hidden formulas back into the output in any form.\n"
        "- Short connectors such as 'and', 'for', 'with', or 'by considering the possible' must stay terse rather than expanded into full sentences."
    )
    if domain_guidance.strip():
        prompt = f"{prompt}\nDocument-specific translation guidance:\n{domain_guidance.strip()}"
    return prompt


def segment_translation_tagged_prompt(domain_guidance: str = "") -> str:
    prompt = (
        "You are translating fixed text segments extracted from one scientific OCR item.\n"
        "Each segment is an independent natural-language span between protected formulas or literals.\n"
        "Protected formulas are omitted and will be reinserted by software after translation.\n"
        "Translate each segment independently into concise publication-style Simplified Chinese.\n"
        "Do not merge, split, omit, reorder, or renumber segments.\n"
        "Do not output formulas, markdown, commentary, code fences, or reconstructed full-item text.\n"
        "Return one tagged block per segment using this exact format:\n"
        "<<<SEG id=1>>>\n"
        "translated text\n"
        "<<<END>>>\n"
        "Output one block for every requested segment_id exactly once."
    )
    if domain_guidance.strip():
        prompt = f"{prompt}\nDocument-specific translation guidance:\n{domain_guidance.strip()}"
    return prompt


def build_formula_segment_messages(
    item: dict,
    skeleton: list[tuple[str, str]],
    segments: list[dict[str, str]],
    *,
    domain_guidance: str = "",
    context_before: str | None = None,
    context_after: str | None = None,
    response_style: str = "tagged",
) -> list[dict[str, str]]:
    serialized_segments = [
        {"segment_id": segment["segment_id"], "source_text": segment["source_text"]}
        for segment in segments
    ]
    user_payload: dict[str, object] = {
        "item_id": item["item_id"],
        "segment_count": len(serialized_segments),
        "segment_structure": segment_structure_outline(skeleton),
        "segments": serialized_segments,
    }
    include_continuation_context = str(item.get("translation_context_mode", "needed") or "needed").strip().lower() != "off"
    resolved_context_before = (
        context_before
        if context_before is not None
        else segment_context_text(str(item.get("continuation_prev_text", "") or "") if include_continuation_context else "")
    )
    resolved_context_after = (
        context_after
        if context_after is not None
        else segment_context_text(str(item.get("continuation_next_text", "") or "") if include_continuation_context else "")
    )
    if resolved_context_before:
        user_payload["context_before"] = resolved_context_before
    if resolved_context_after:
        user_payload["context_after"] = resolved_context_after
    if item.get("continuation_group"):
        user_payload["continuation_group"] = item["continuation_group"]
    system_prompt = (
        segment_translation_system_prompt(domain_guidance=domain_guidance)
        if response_style == "json"
        else segment_translation_tagged_prompt(domain_guidance=domain_guidance)
    )
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
    ]
