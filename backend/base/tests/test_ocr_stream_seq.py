"""流式清单的 seq 接着旧清单数、旧的失败清单开跑时清掉（2026-11-26，状态管理 Z5 / S46、附录 A-N3）。"""

from __future__ import annotations

import json
from pathlib import Path

from retainpdf_base.ocr_stream import OcrStreamWriter
from retainpdf_base.ocr_stream import manifest_path
from retainpdf_base.ocr_stream import read_ocr_stream
from retainpdf_base.ocr_stream import wait_for_ocr_stream


def _write_manifest(ocr_dir: Path, **fields: object) -> None:
    path = manifest_path(ocr_dir)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "schema": "ocr_stream_v1",
        "provider": "glm_ocr",
        "ready_pages": 2,
        "ready_page_indices": [0, 1],
        "total_pages": 3,
        "done": False,
        "failed": False,
        "error": "",
        **fields,
    }
    path.write_text(json.dumps(payload), encoding="utf-8")


def _no_wait(_seconds: float) -> None:
    raise AssertionError("读的一方不该再等")


def test_stream_writer_continues_the_seq_of_an_unfinished_old_manifest(tmp_path: Path) -> None:
    """旧清单停在 seq=4（进程被杀，没写 done/failed），读的一方已经读过它；新一轮全命中缓存直接写 done。
    修之前新清单的 seq 是 1，读的一方一直等比 4 新的那一版。"""
    _write_manifest(tmp_path, seq=4)
    writer = OcrStreamWriter(tmp_path, provider="glm_ocr", total_pages=3)
    writer.publish({"pages": [{}, {}, {}]}, done=True)
    state = wait_for_ocr_stream(tmp_path, after_seq=4, sleep=_no_wait)
    assert state.seq == 5 and state.done


def test_stream_writer_clears_an_old_failed_manifest_when_it_starts(tmp_path: Path) -> None:
    """旧清单是 failed：新一轮还没公布第一版，读的一方读到旧的失败会立刻退出。开跑时清掉。"""
    _write_manifest(tmp_path, seq=3, failed=True, error="old run failed")
    writer = OcrStreamWriter(tmp_path, provider="glm_ocr", total_pages=3)
    assert read_ocr_stream(tmp_path) is None
    writer.publish({"pages": [{}, {}, {}]}, ready_page_indices=[0])
    state = read_ocr_stream(tmp_path)
    assert state is not None and state.seq == 4 and not state.failed
