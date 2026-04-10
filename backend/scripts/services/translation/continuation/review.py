from __future__ import annotations

import json

from foundation.shared.prompt_loader import load_prompt
from ..llm.deepseek_client import request_chat_content
from ..llm.structured_models import CONTINUATION_REVIEW_RESPONSE_SCHEMA
from ..llm.structured_parsers import parse_continuation_review_response


def _build_messages(pairs: list[dict]) -> list[dict[str, str]]:
    payload = {
        "task": load_prompt("continuation_review_task.txt"),
        "pairs": pairs,
    }
    return [
        {"role": "system", "content": load_prompt("continuation_review_system.txt")},
        {"role": "user", "content": json.dumps(payload, ensure_ascii=False)},
    ]


def review_candidate_pairs(
    pairs: list[dict],
    *,
    api_key: str,
    model: str,
    base_url: str,
    request_label: str = "",
) -> dict[str, str]:
    if not pairs:
        return {}
    content = request_chat_content(
        _build_messages(pairs),
        api_key=api_key,
        model=model,
        base_url=base_url,
        temperature=0.0,
        response_format=CONTINUATION_REVIEW_RESPONSE_SCHEMA,
        timeout=120,
        request_label=request_label,
    )
    return parse_continuation_review_response(content)
