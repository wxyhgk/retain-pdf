"""跟着 OCR 流式翻译（OCR 和翻译并行，2026-10-31）：和整本一次翻出来的东西一样，而且不重翻。

文档用快照守卫里的人造样例 `paddle_vl_english_paper`（3 页两栏英文论文，有跨栏、跨页的段落）。模型是假的：只换
OpenAI 兼容客户端的 HTTP（和 tests/performance 的探针一样），所有翻译阶段都是真的。译文按原文确定地造出来
（公式、占位符原样，其余每个英文词换成"文"），所以两种跑法逐块比得上。
"""

from __future__ import annotations

import json
import re
import threading
from collections import Counter
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, patch

import pytest

from retainpdf_base import paths
from retainpdf_base.ocr_stream import OcrStreamWriter
from retainpdf_base.ocr_stream import read_ocr_stream
from retainpdf_translation.llm.providers.deepseek import client
from retainpdf_translation.workflow import streaming_flow
from retainpdf_translation.workflow.execution import TranslationExecutionRequest
from retainpdf_translation.workflow.execution import execute_translation_request

FIXTURE = (
    Path(__file__).resolve().parents[1]
    / "document_schema"
    / "fixtures"
    / "synthetic"
    / "paddle_vl_english_paper"
    / "expected.document.v1.json"
)
_PROTECTED = re.compile(r"(\$[^$]*\$|<[^>]+>|\[\[[^\]]*\]\]|\{\{[^}]*\}\}|@@[^@]*@@)")
_WORD = re.compile(r"[A-Za-z]+")


def _fake_translation(text: str) -> str:
    parts = _PROTECTED.split(text)
    return "".join(part if index % 2 else _WORD.sub("文", part) for index, part in enumerate(parts))


class FakeModel:
    """回答续接复核、批量、单块三种请求；记下每个块被翻了几次。"""

    def __init__(self) -> None:
        self.translated = Counter()
        self.reviewed_pairs = Counter()
        self.lock = threading.Lock()

    def answer(self, messages: list[dict]) -> str:
        user = messages[-1]["content"]
        try:
            payload = json.loads(user)
        except ValueError:
            payload = None
        if isinstance(payload, dict) and "pairs" in payload:
            with self.lock:
                for pair in payload["pairs"]:
                    self.reviewed_pairs[(pair["prev_item_id"], pair["next_item_id"])] += 1
            # 前一块没以句号收尾就算连着
            return json.dumps(
                {
                    "decisions": [
                        {"pair_id": pair["pair_id"], "decision": "break" if pair["prev_text"].rstrip().endswith(".") else "join"}
                        for pair in payload["pairs"]
                    ]
                }
            )
        members = re.findall(r"^原文 (p\d+-b\d+):\n([^\n]+)", user, re.M)
        if members:
            with self.lock:
                self.translated.update(item_id for item_id, _ in members)
            return "\n".join(f"<<<ITEM item_id={item_id}>>>\n{_fake_translation(text)}\n<<<END>>>" for item_id, text in members)
        if "【当前原文开始】" in user:
            current = user.split("【当前原文开始】", 1)[1].split("【当前原文结束】", 1)[0].strip()
        else:
            current = user.strip()
        with self.lock:
            self.translated[current] += 1
        return _fake_translation(current)


@pytest.fixture
def fake_model(monkeypatch):
    model = FakeModel()

    def post(_url, **kwargs):
        response = Mock(status_code=200)
        response.json.return_value = {"choices": [{"message": {"content": model.answer(kwargs["json"]["messages"])}}]}
        return response

    monkeypatch.setenv("RETAIN_TRANSLATION_TRANSPORT", "legacy")
    monkeypatch.setenv("RETAIN_TRANSLATION_PROMPT_CACHE", "off")
    with patch.object(client, "get_session", return_value=SimpleNamespace(post=post)), patch.object(
        client, "_prewarm_dns"
    ), patch.object(client, "should_use_stream_responses", return_value=False):
        yield model


def _request(root: Path, document_path: Path, *, ocr_stream_dir: Path | None = None) -> TranslationExecutionRequest:
    output_dir = root / "translated"
    output_dir.mkdir(parents=True)
    source_pdf = root / "source.pdf"
    source_pdf.write_bytes(b"%PDF-1.4 synthetic\n")
    return TranslationExecutionRequest(
        source_json_path=document_path,
        output_dir=output_dir,
        api_key="test-key",
        workers=2,
        batch_size=4,
        mode="fast",
        model="deepseek-chat",
        base_url="https://api.deepseek.com/v1",
        source_pdf_path=source_pdf,
        ocr_stream_dir=ocr_stream_dir,
    )


def _translations(result: dict) -> dict[str, tuple[str, str]]:
    return {
        item["item_id"]: (item.get("translated_text") or "", str(item.get("continuation_group", "") or ""))
        for items in result["translated_pages_map"].values()
        for item in items
    }


def _one_shot(tmp_path: Path, fake_model, monkeypatch, document: dict) -> tuple[dict, Counter, Path]:
    whole_path = tmp_path / "whole" / "document.v1.json"
    whole_path.parent.mkdir(parents=True)
    whole_path.write_text(json.dumps(document, ensure_ascii=False), encoding="utf-8")
    # 每次跑各用各的译文缓存，不然第二次全从缓存出，数不出模型翻了几次
    monkeypatch.setattr(paths, "TRANSLATION_UNIT_CACHE_DIR", tmp_path / "cache-whole")
    one_shot = execute_translation_request(_request(tmp_path / "whole", whole_path))
    one_shot_counts = Counter(fake_model.translated)
    fake_model.translated.clear()
    fake_model.reviewed_pairs.clear()
    return one_shot, one_shot_counts, whole_path


def test_streaming_translation_matches_the_one_shot_run_without_retranslating(tmp_path: Path, fake_model, monkeypatch) -> None:
    document = json.loads(FIXTURE.read_text(encoding="utf-8"))
    pages = document["pages"]
    one_shot, one_shot_counts, whole_path = _one_shot(tmp_path, fake_model, monkeypatch, document)

    # OCR 一页一页公布：建计划时只有第 1 页；每次翻译等下一版时公布下一页，最后一页标 done
    ocr_dir = tmp_path / "stream" / "ocr"
    writer = OcrStreamWriter(ocr_dir, provider="glm_ocr", total_pages=len(pages))
    writer.publish({**document, "pages": pages[:1]})
    published = [1]
    rounds: list[frozenset[str]] = []
    original_batch_stage = streaming_flow.run_translation_batch_stage

    def recording_batch_stage(**kwargs):
        rounds.append(kwargs["deferred_item_ids"])
        return original_batch_stage(**kwargs)

    def publish_next(ocr_dir_arg: Path, *, after_seq: int):
        count = published[-1] + 1
        writer.publish({**document, "pages": pages[:count]}, done=count == len(pages))
        published.append(count)
        return read_ocr_stream(ocr_dir_arg)

    monkeypatch.setattr(paths, "TRANSLATION_UNIT_CACHE_DIR", tmp_path / "cache-stream")
    monkeypatch.setattr(streaming_flow, "run_translation_batch_stage", recording_batch_stage)
    monkeypatch.setattr(streaming_flow, "wait_for_ocr_stream", publish_next)
    streamed = execute_translation_request(_request(tmp_path / "stream", whole_path.with_name("missing.json"), ocr_stream_dir=ocr_dir))

    assert published == [1, 2, 3]
    assert len(rounds) == 3
    assert rounds[0] and rounds[1], "没做完的轮要扣住最新一页的最后一段"
    assert rounds[-1] == frozenset(), "OCR 做完的那一轮全部翻完"
    assert _translations(streamed) == _translations(one_shot), "跟着 OCR 翻出来的译文、拼接要和整本一次翻的一样"
    assert all(count == 1 for count in fake_model.translated.values()), f"有块翻了不止一次：{fake_model.translated}"
    # 一样多的翻译（批量请求按块号记、单块请求按原文记，同一块两种跑法可能走不同的请求，只比总数）
    assert sum(fake_model.translated.values()) == sum(one_shot_counts.values())
    assert all(count == 1 for count in fake_model.reviewed_pairs.values()), "判过的拼接对不再送模型"


def test_pages_arriving_out_of_order_translate_the_same_as_the_one_shot_run(tmp_path: Path, fake_model, monkeypatch) -> None:
    """Paddle 按片并行时后面的片常先做完：第 3 页先到，再到第 1 页，最后第 2 页。翻出来要和整本一次翻的一样、不重翻：
    挨着没到的页的那一段扣住，跨页拼接只连相邻两页，上下文不跨过没到的页。"""
    document = json.loads(FIXTURE.read_text(encoding="utf-8"))
    pages = document["pages"]
    one_shot, one_shot_counts, whole_path = _one_shot(tmp_path, fake_model, monkeypatch, document)

    def stream_document(ready: list[int]) -> dict:
        return {**document, "pages": [page if index in ready else {**page, "blocks": []} for index, page in enumerate(pages)]}

    order = [[2], [0, 2], [0, 1, 2]]
    ocr_dir = tmp_path / "stream" / "ocr"
    writer = OcrStreamWriter(ocr_dir, provider="paddle", total_pages=len(pages))
    writer.publish(stream_document(order[0]), ready_page_indices=order[0])
    published = [order[0]]
    rounds: list[frozenset[str]] = []
    original_batch_stage = streaming_flow.run_translation_batch_stage

    def recording_batch_stage(**kwargs):
        rounds.append(kwargs["deferred_item_ids"])
        return original_batch_stage(**kwargs)

    def publish_next(ocr_dir_arg: Path, *, after_seq: int):
        ready = order[len(published)]
        done = len(ready) == len(pages)
        writer.publish(document if done else stream_document(ready), done=done, ready_page_indices=ready)
        published.append(ready)
        return read_ocr_stream(ocr_dir_arg)

    monkeypatch.setattr(paths, "TRANSLATION_UNIT_CACHE_DIR", tmp_path / "cache-stream")
    monkeypatch.setattr(streaming_flow, "run_translation_batch_stage", recording_batch_stage)
    monkeypatch.setattr(streaming_flow, "wait_for_ocr_stream", publish_next)
    streamed = execute_translation_request(_request(tmp_path / "stream", whole_path.with_name("missing.json"), ocr_stream_dir=ocr_dir))

    assert published == order
    assert len(rounds) == 3
    assert all(item_id.startswith("p003-") for item_id in rounds[0]) and rounds[0], "只有第 3 页时扣住它页首能接上一页的那段"
    assert rounds[-1] == frozenset()
    assert _translations(streamed) == _translations(one_shot), "乱序到的页翻出来的译文、拼接要和整本一次翻的一样"
    assert all(count == 1 for count in fake_model.translated.values()), f"有块翻了不止一次：{fake_model.translated}"
    assert sum(fake_model.translated.values()) == sum(one_shot_counts.values())
    assert all(count == 1 for count in fake_model.reviewed_pairs.values()), "判过的拼接对不再送模型"


def test_held_back_items_are_the_last_joinable_block_and_its_group() -> None:
    page_payloads = {
        0: [{"item_id": "a", "block_type": "text", "protected_source_text": "first", "continuation_group": "cg-1"}],
        1: [
            {"item_id": "b", "block_type": "text", "protected_source_text": "second", "continuation_group": "cg-1"},
            {"item_id": "c", "block_type": "text", "protected_source_text": "Figure 3. A caption"},
        ],
    }
    held = streaming_flow.held_back_item_ids(page_payloads, page_indices=range(3))
    # c 像图注，不会接下一页；b 是最后一个能接的，它的组连着第 1 页的 a
    assert held == frozenset({"a", "b"})


def test_held_back_items_at_a_gap_are_the_tail_before_it_and_the_head_after_it() -> None:
    text = lambda item_id: {"item_id": item_id, "block_type": "text", "protected_source_text": f"body {item_id}"}
    page_payloads = {0: [text("a0"), text("a1")], 3: [text("d0"), text("d1")], 4: [text("e0"), text("e1")]}
    # 第 2、3 页（下标 1、2）没到：第 1 页的页末、第 4 页的页首扣住；第 4、5 页连着，中间不扣；页范围外的不管
    assert streaming_flow.held_back_item_ids(page_payloads, page_indices=range(5)) == frozenset({"a1", "d0"})


def test_ocr_failure_stops_the_waiting_translation(tmp_path: Path) -> None:
    from retainpdf_base.ocr_stream import OcrStreamFailed
    from retainpdf_base.ocr_stream import wait_for_ocr_stream

    writer = OcrStreamWriter(tmp_path, provider="glm_ocr", total_pages=10)
    writer.publish({"pages": [{}, {}]})
    writer.fail("GlmOcrRequestRejected: GLM-OCR 请求被拒绝 status=401")
    with pytest.raises(OcrStreamFailed, match="2/10 pages: GlmOcrRequestRejected"):
        wait_for_ocr_stream(tmp_path, after_seq=1, sleep=lambda _s: pytest.fail("失败了不该再等"))


def test_agent_engine_waits_for_the_whole_document(tmp_path: Path) -> None:
    """agent 要先通读全书：跟着 OCR 的请求等到 done，再按整本翻（换成流里的整份文档）。"""
    from dataclasses import replace

    from retainpdf_translation.workflow.execution import _wait_for_whole_document_if_needed

    ocr_dir = tmp_path / "ocr"
    writer = OcrStreamWriter(ocr_dir, provider="glm_ocr", total_pages=2)
    writer.publish({"pages": [{}]})
    calls = []

    def finish_ocr():
        calls.append(1)
        writer.publish({"pages": [{}, {}]}, done=True)

    request = _request(tmp_path, tmp_path / "final.json", ocr_stream_dir=ocr_dir)
    agent = replace(request, engine="agent")
    timer = threading.Timer(0.3, finish_ocr)
    timer.start()
    try:
        resolved = _wait_for_whole_document_if_needed(agent)
    finally:
        timer.cancel()
    assert calls, "要等到 OCR 做完"
    assert resolved.ocr_stream_dir is None
    assert resolved.source_json_path == read_ocr_stream(ocr_dir).document_path
    # legacy、不做译前准备的照旧跟着 OCR 翻
    assert _wait_for_whole_document_if_needed(request) is request


def test_translate_stage_spec_accepts_a_missing_final_document_when_following_ocr(tmp_path: Path) -> None:
    from retainpdf_pipeline.foundation.shared.stage_specs import TranslateStageSpec
    from retainpdf_pipeline.foundation.shared.stage_specs import TRANSLATE_STAGE_SCHEMA_VERSION

    (tmp_path / "source.pdf").write_bytes(b"%PDF-1.4\n")
    spec = {
        "schema_version": TRANSLATE_STAGE_SCHEMA_VERSION,
        "stage": "translate",
        "job": {"job_id": "job-1", "job_root": str(tmp_path), "workflow": "book"},
        "inputs": {
            "source_json": str(tmp_path / "ocr" / "normalized" / "document.v1.json"),
            "source_pdf": str(tmp_path / "source.pdf"),
            "ocr_stream_dir": str(tmp_path / "ocr"),
        },
        "params": {"model": "m", "base_url": "https://api.deepseek.com/v1", "credential_ref": ""},
    }
    path = tmp_path / "translate.spec.json"
    path.write_text(json.dumps(spec), encoding="utf-8")
    loaded = TranslateStageSpec.load(path)
    assert loaded.inputs.ocr_stream_dir == (tmp_path / "ocr").resolve()
    spec["inputs"].pop("ocr_stream_dir")
    path.write_text(json.dumps(spec), encoding="utf-8")
    with pytest.raises(RuntimeError, match="source json not found"):
        TranslateStageSpec.load(path)
