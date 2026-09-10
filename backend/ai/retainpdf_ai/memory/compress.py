"""抽取式上下文压缩 extractive_v1：不调用 LLM，规则折叠早期轮次。"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

SUMMARY_PREFIX = "【对话摘要】"
CITATION_RE = re.compile(r"\[(\d+)\]")


@dataclass
class CompressResult:
    """压缩结果；summary_message 非空时调用方应持久化并通知前端。"""

    messages: list[dict[str, Any]]
    compressed: bool = False
    summary_message: dict[str, str] | None = None
    event: dict[str, Any] = field(default_factory=dict)


def is_summary_message(message: dict[str, Any]) -> bool:
    content = str(message.get("content") or "").strip()
    return content.startswith(SUMMARY_PREFIX)


def split_transcript(
    messages: list[dict[str, Any]],
) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
    """返回 (最新 summary 消息或 None, 该 summary 之后的 turn 消息)。"""
    last_summary: dict[str, Any] | None = None
    last_summary_idx = -1
    for index, message in enumerate(messages):
        if is_summary_message(message):
            last_summary = message
            last_summary_idx = index
    turns = [
        message
        for message in messages[last_summary_idx + 1 :]
        if str(message.get("role") or "") in {"user", "assistant"}
        and str(message.get("content") or "").strip()
        and not is_summary_message(message)
    ]
    return last_summary, turns


def count_turns(messages: list[dict[str, Any]]) -> int:
    """粗算「轮」：user 条数。"""
    return sum(1 for m in messages if str(m.get("role") or "") == "user")


def _clip(text: str, max_chars: int) -> str:
    normalized = " ".join(str(text or "").split())
    if len(normalized) <= max_chars:
        return normalized
    return f"{normalized[: max_chars - 1].rstrip()}…"


def build_extractive_summary(turns: list[dict[str, Any]], *, max_chars: int = 1800) -> str:
    """从被折叠的 turns 抽出问题 / 带引用结论 / 证据片段。"""
    user_questions: list[str] = []
    cited_lines: list[str] = []
    evidence_lines: list[str] = []

    for message in turns:
        role = str(message.get("role") or "")
        content = str(message.get("content") or "").strip()
        if not content:
            continue
        if role == "user":
            user_questions.append(_clip(content, 120))
            continue
        if role == "assistant":
            for line in content.splitlines():
                line = line.strip()
                if line and CITATION_RE.search(line):
                    cited_lines.append(_clip(line, 160))
            citations_raw = message.get("citations_json") or message.get("citations") or ""
            if isinstance(citations_raw, str) and citations_raw.strip().startswith("["):
                try:
                    import json

                    items = json.loads(citations_raw)
                except Exception:
                    items = []
            elif isinstance(citations_raw, list):
                items = citations_raw
            else:
                items = []
            for item in items[:8]:
                if not isinstance(item, dict):
                    continue
                ref = item.get("ref", "?")
                page = item.get("page_idx")
                if isinstance(page, int) or (isinstance(page, str) and str(page).isdigit()):
                    page_label = f"p.{int(page) + 1}"
                else:
                    page_label = ""
                snippet = _clip(str(item.get("snippet") or ""), 80)
                block = str(item.get("block_id") or "").strip()
                parts = [f"[{ref}]", page_label, block, snippet]
                evidence_lines.append(" ".join(p for p in parts if p))

    lines = [SUMMARY_PREFIX, "- 用户关注："]
    if user_questions:
        for q in user_questions[-8:]:
            lines.append(f"  · {q}")
    else:
        lines.append("  · （无）")

    lines.append("- 已确认结论（含引用）：")
    if cited_lines:
        for line in cited_lines[-10:]:
            lines.append(f"  · {line}")
    else:
        lines.append("  · （早期回答未标注 [n]，仅保留主题）")

    lines.append("- 重要证据：")
    if evidence_lines:
        # 去重保序
        seen: set[str] = set()
        for line in evidence_lines:
            if line in seen:
                continue
            seen.add(line)
            lines.append(f"  · {line}")
            if len(seen) >= 12:
                break
    else:
        lines.append("  · （无结构化 citations）")

    text = "\n".join(lines)
    if len(text) > max_chars:
        text = f"{text[: max_chars - 1].rstrip()}…"
    return text


def maybe_compress_transcript(
    messages: list[dict[str, Any]],
    *,
    window_turns: int = 6,
    compress_after_turns: int = 12,
    force: bool = False,
    summary_max_chars: int = 1800,
) -> CompressResult:
    """
    若 turn 数超过阈值或 force，则把「最新 summary 之后、窗口之外」的早期轮次
    折叠为一条 assistant 摘要消息。

    返回的 messages 是**逻辑 transcript**（内存视图）：
    [可选旧 summary] + [新 summary] + [近期窗口 turns]
    调用方负责把新 summary 写入 Rust。
    """
    normalized = [
        {
            "role": str(m.get("role") or ""),
            "content": str(m.get("content") or ""),
            "citations_json": m.get("citations_json") or m.get("citations") or "[]",
        }
        for m in messages
        if str(m.get("role") or "") in {"user", "assistant"}
        and str(m.get("content") or "").strip()
    ]
    last_summary, turns = split_transcript(normalized)
    turn_count = count_turns(turns)
    window_turns = max(1, int(window_turns))
    compress_after_turns = max(window_turns + 1, int(compress_after_turns))

    if not force and turn_count <= compress_after_turns:
        return CompressResult(messages=normalized, compressed=False)

    # 保留最近 window_turns 个 user 开启的轮次 → 约 2*window 条消息
    keep_n = window_turns * 2
    if len(turns) <= keep_n:
        # 强制压缩但窗口已覆盖全部 → 仍可整段摘要后只留窗口（空折叠）
        if not force:
            return CompressResult(messages=normalized, compressed=False)
        # force: 生成覆盖全部 turns 的摘要，窗口仍保留最近 keep_n
        to_fold = turns[:-keep_n] if len(turns) > keep_n else turns[:]
        kept = turns[-keep_n:] if len(turns) > keep_n else turns[:]
    else:
        to_fold = turns[:-keep_n]
        kept = turns[-keep_n:]

    if not to_fold:
        return CompressResult(messages=normalized, compressed=False)

    summary_text = build_extractive_summary(to_fold, max_chars=summary_max_chars)
    summary_message = {"role": "assistant", "content": summary_text}
    # 新 transcript：丢弃旧 summary 与被折叠 turns，保留新 summary + 窗口
    # （旧 summary 信息已可能融入 to_fold 的早期内容；若 to_fold 不含旧 summary 文本，
    #  把旧 summary 拼进摘要头部以免丢）
    if last_summary and str(last_summary.get("content") or "").strip():
        prior = str(last_summary.get("content") or "").strip()
        if prior not in summary_text:
            summary_text = f"{prior}\n\n——\n\n{summary_text}"
            summary_message["content"] = summary_text

    new_messages = [summary_message, *kept]
    dropped_turns = count_turns(to_fold)
    event = {
        "type": "compress",
        "dropped_turns": dropped_turns,
        "summary_chars": len(summary_text),
        "kept_evidence": summary_text.count("["),
        "policy": "extractive_v1",
        "window_turns": window_turns,
    }
    return CompressResult(
        messages=new_messages,
        compressed=True,
        summary_message=summary_message,
        event=event,
    )
