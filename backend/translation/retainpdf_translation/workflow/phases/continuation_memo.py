"""跨栏 / 跨页连续段复核的结论落盘，重试时接着用。

以前结论只在 OCR 和翻译并行那条路线里放在内存（`workflow/streaming_flow.py` 的 `review_memo`），任务一结束就没了：
6574 页的书每次重试都把 92 批复核请求重新发一遍（2026-11-04）。现在写进译文目录的 `continuation-review-memo.json`，
重试时 runner 跟 `domain-context.json` 一起拷进新任务（`translation_checkpoint_resume.rs`）。

每对记下两块原文的摘要，读回来时对不上（OCR 重做过、块号相同内容变了）就不用。
"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path

from retainpdf_translation.services.policy.soft_hints import normalized_source_text

CONTINUATION_REVIEW_MEMO_FILE_NAME = "continuation-review-memo.json"
_SCHEMA = "continuation_review_memo_v1"


def load_continuation_review_memo(output_dir: Path, page_payloads: dict[int, list[dict]]) -> dict[tuple[str, str], bool]:
    """读回能用的结论；文件没有、坏了、或者两块原文对不上的对都跳过。"""
    path = Path(output_dir) / CONTINUATION_REVIEW_MEMO_FILE_NAME
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    if not isinstance(data, dict) or data.get("schema") != _SCHEMA or not isinstance(data.get("pairs"), list):
        return {}
    items = _items_by_id(page_payloads)
    memo: dict[tuple[str, str], bool] = {}
    for entry in data["pairs"]:
        if not isinstance(entry, dict) or not isinstance(entry.get("join"), bool):
            continue
        key = (str(entry.get("prev_item_id", "") or ""), str(entry.get("next_item_id", "") or ""))
        digest = _pair_digest(items, key)
        if digest is not None and digest == entry.get("digest"):
            memo[key] = entry["join"]
    return memo


def save_continuation_review_memo(
    output_dir: Path,
    page_payloads: dict[int, list[dict]],
    memo: dict[tuple[str, str], bool],
) -> None:
    items = _items_by_id(page_payloads)
    pairs = []
    for key, join in sorted(memo.items()):
        digest = _pair_digest(items, key)
        if digest is not None:
            pairs.append({"prev_item_id": key[0], "next_item_id": key[1], "digest": digest, "join": bool(join)})
    path = Path(output_dir) / CONTINUATION_REVIEW_MEMO_FILE_NAME
    temp = path.with_name(f".{path.name}.tmp")
    temp.write_text(json.dumps({"schema": _SCHEMA, "pairs": pairs}, ensure_ascii=False), encoding="utf-8")
    os.replace(temp, path)


def _items_by_id(page_payloads: dict[int, list[dict]]) -> dict[str, dict]:
    return {
        str(item.get("item_id", "") or ""): item
        for page_idx in sorted(page_payloads)
        for item in page_payloads[page_idx]
        if isinstance(item, dict) and item.get("item_id")
    }


def _pair_digest(items: dict[str, dict], key: tuple[str, str]) -> str | None:
    prev, nxt = items.get(key[0]), items.get(key[1])
    if prev is None or nxt is None:
        return None
    # 只看这一块自己的原文：翻译单元、接续组的整段原文在复核前后会变（连上以后成了整段），用它摘要永远对不上
    text = "\x1f".join(normalized_source_text(item) for item in (prev, nxt))
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


__all__ = [
    "CONTINUATION_REVIEW_MEMO_FILE_NAME",
    "load_continuation_review_memo",
    "save_continuation_review_memo",
]
