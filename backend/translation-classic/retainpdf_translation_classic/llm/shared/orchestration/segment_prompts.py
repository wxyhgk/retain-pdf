from __future__ import annotations

import json

from retainpdf_translation_classic.llm.shared.orchestration.segment_plan import segment_context_text
from retainpdf_translation_classic.llm.shared.orchestration.segment_plan import segment_structure_outline


def segment_translation_system_prompt(domain_guidance: str = "") -> str:
    prompt = (
        "你在翻译从同一个科技 OCR 条目里切出来的固定文本段。\n"
        "每一段都是夹在受保护公式或字面记号之间的自然语言跨度。\n"
        "那些受保护的公式和字面量没有出现在请求里，翻译完成后由程序自动插回。\n"
        "你不是把整个条目当成一句话翻译。你要逐段独立翻译，并保持原有的段序。\n"
        "使用适合科技写作的、凝练的出版体简体中文。\n"
        "缩写、符号和标准模型名保持其通行的技术写法。\n"
        "如果某一段只是连接词或不完整的短语，中文也要同样简短、同样不完整。\n"
        "不要从相邻段落借内容来补全被截断的语法。\n"
        "不要输出任何公式占位符、公式标记、拼回的整条文本、评论、markdown 或代码块围栏。\n"
        '只返回符合 {"segments":[{"segment_id":"1","translated_text":"..."}]} 的 JSON。\n'
        "硬性规则：\n"
        "- 每个请求中的 segment_id 必须且只能出现一次。\n"
        "- 不要合并、拆分、遗漏、重新编号、调序或凭空新增段。\n"
        "- 不要以任何形式把隐藏的公式抄回输出。\n"
        "- 'and'、'for'、'with'、'by considering the possible' 这类短连接词必须保持简短，不要扩写成完整句子。"
    )
    if domain_guidance.strip():
        prompt = f"{prompt}\n本文档专属的翻译指引：\n{domain_guidance.strip()}"
    return prompt


def segment_translation_tagged_prompt(domain_guidance: str = "") -> str:
    prompt = (
        "你在翻译从同一个科技 OCR 条目里切出来的固定文本段。\n"
        "每一段都是夹在受保护公式或字面量之间、彼此独立的自然语言跨度。\n"
        "受保护的公式没有出现在请求里，翻译完成后由程序插回。\n"
        "逐段独立翻译成凝练的出版体简体中文。\n"
        "不要合并、拆分、遗漏、调序或重新编号。\n"
        "不要输出公式、markdown、评论、代码块围栏，或拼回的整条文本。\n"
        "每一段返回一个标记块，格式严格如下：\n"
        "<<<SEG id=1>>>\n"
        "translated text\n"
        "<<<END>>>\n"
        "请求中的每个 segment_id 都要输出一个块，且只输出一次。"
    )
    if domain_guidance.strip():
        prompt = f"{prompt}\n本文档专属的翻译指引：\n{domain_guidance.strip()}"
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
