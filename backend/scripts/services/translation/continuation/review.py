from __future__ import annotations

import json

from foundation.shared.prompt_loader import load_prompt
from ..llm.deepseek_client import extract_json_text
from ..llm.deepseek_client import request_chat_content


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
        response_format={"type": "json_object"},
        timeout=120,
        request_label=request_label,
    )
    payload = json.loads(extract_json_text(content))
    decisions = payload.get("decisions", [])
    result: dict[str, str] = {}
    for item in decisions:
        pair_id = str(item.get("pair_id", "") or "").strip()
        decision = str(item.get("decision", "") or "").strip().lower()
        if not pair_id:
            continue
        result[pair_id] = "join" if decision == "join" else "break"
    return result
