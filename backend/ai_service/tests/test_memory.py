"""B2 memory: nén kiểu trích xuất + dựng cửa sổ ngữ cảnh."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from retainpdf_ai.memory.assemble import assemble_history, estimate_tokens
from retainpdf_ai.memory.compress import (
    SUMMARY_PREFIX,
    build_extractive_summary,
    maybe_compress_transcript,
)


def _turns(n_user: int) -> list[dict]:
    messages = []
    for i in range(n_user):
        messages.append({"role": "user", "content": f"Câu hỏi {i + 1} về trao đổi lithium halogen"})
        messages.append(
            {
                "role": "assistant",
                "content": f"Câu trả lời {i + 1}: Tính chọn lọc đáng kể [1].",
                "citations_json": (
                    '[{"ref":1,"page_idx":2,"block_id":"p003-b0001","snippet":"Đoạn văn về tính chọn lọc"}]'
                ),
            }
        )
    return messages


def test_estimate_tokens_positive():
    assert estimate_tokens("") == 0
    assert estimate_tokens("xin chào world") >= 1


def test_build_extractive_summary_contains_questions_and_citations():
    text = build_extractive_summary(_turns(3))
    assert text.startswith(SUMMARY_PREFIX)
    assert "Câu hỏi 1" in text or "Câu hỏi 3" in text
    assert "[1]" in text
    assert "tính chọn lọc" in text or "tr.3" in text


def test_maybe_compress_when_over_threshold():
    messages = _turns(15)  # 15 lượt > mặc định 12
    result = maybe_compress_transcript(
        messages,
        window_turns=6,
        compress_after_turns=12,
    )
    assert result.compressed is True
    assert result.summary_message is not None
    assert result.summary_message["content"].startswith(SUMMARY_PREFIX)
    assert result.event["type"] == "compress"
    assert result.event["dropped_turns"] >= 1
    # Transcript mới: 1 summary + tối đa 12 tin nhắn trong cửa sổ
    assert len(result.messages) <= 1 + 12
    assert result.messages[0]["content"].startswith(SUMMARY_PREFIX)


def test_maybe_compress_noop_when_short():
    messages = _turns(3)
    result = maybe_compress_transcript(
        messages,
        window_turns=6,
        compress_after_turns=12,
    )
    assert result.compressed is False
    assert result.summary_message is None
    assert len(result.messages) == 6


def test_force_compress_short_history():
    messages = _turns(4)
    result = maybe_compress_transcript(
        messages,
        window_turns=2,
        compress_after_turns=12,
        force=True,
    )
    # 4 lượt > cửa sổ 2 → gộp 2 lượt đầu
    assert result.compressed is True
    assert result.event["dropped_turns"] == 2


def test_assemble_history_injects_summary_prefix():
    compressed = maybe_compress_transcript(
        _turns(14),
        window_turns=4,
        compress_after_turns=8,
    )
    assembled = assemble_history(compressed.messages, window_turns=4)
    assert assembled.debug["had_summary"] is True
    assert assembled.history[0]["role"] == "user"
    assert "summary of the earlier conversation" in assembled.history[0]["content"]
    assert assembled.history[1]["role"] == "assistant"
    # Phía sau phải có nội dung của cửa sổ
    assert any(m["role"] == "user" and "Câu hỏi" in m["content"] for m in assembled.history[2:])


def test_assemble_clips_long_content():
    long = "x" * 5000
    messages = [
        {"role": "user", "content": long},
        {"role": "assistant", "content": long},
    ]
    assembled = assemble_history(messages, window_turns=6)
    assert len(assembled.history[0]["content"]) <= 2000
    assert len(assembled.history[1]["content"]) <= 3000
