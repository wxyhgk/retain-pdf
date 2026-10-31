"""Paddle 按片并行提交（paddle_chunked.py）：切片、拼接（全局编号加偏移）、流式公布、防排队卡住再交一次、失败重交、续跑。
接口和时钟都是假的，不花钱。"""

from __future__ import annotations

import json
from pathlib import Path

import fitz
import pytest

from retainpdf_base.ocr_stream import read_ocr_stream
from retainpdf_pipeline.ocr.ocr_provider.paddle_chunked import merge_paddle_chunks
from retainpdf_pipeline.ocr.ocr_provider.paddle_chunked import request_chunks


def _pdf(path: Path, pages: int) -> Path:
    with fitz.open() as document:
        for number in range(pages):
            document.new_page(width=595, height=842).insert_text((72, 100), f"Page {number + 1}")
        document.save(path)
    return path


def _page_payload(page_number: int, group: int) -> dict:
    return {
        "prunedResult": {
            "width": 1190,
            "height": 1684,
            "model_settings": {},
            "parsing_res_list": [
                {"block_label": "text", "block_bbox": [100, 100, 1000, 200], "block_content": f"Page {page_number} text",
                 "block_id": 0, "block_order": 1, "group_id": 0, "global_block_id": group, "global_group_id": group},
            ],
        },
        "markdown": {"text": "", "images": {}},
    }


class FakePaddle:
    """每个任务按脚本走：`plan[片序号]` 是 [(排队几秒, 识别几秒, 结果)]，一次提交用一项；结果 'done' 或 'failed'。"""

    def __init__(self, plan: dict[int, list[tuple[float, float, str]]]) -> None:
        self.plan = plan
        self.now = 0.0
        self.jobs: dict[str, dict] = {}
        self.submits: list[int] = []

    def clock(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        self.now += seconds

    def submit(self, *, token, file_path, model, optional_payload, base_url):
        index = int(Path(file_path).stem.split("-")[1])
        attempt = sum(1 for i in self.submits if i == index)
        self.submits.append(index)
        queue, work, outcome = self.plan.get(index, [(0, 1, "done")])[min(attempt, len(self.plan.get(index, [1])) - 1)]
        with fitz.open(file_path) as document:
            pages = document.page_count
        job_id = f"job-{index}-{attempt}"
        self.jobs[job_id] = {"index": index, "start": self.now + queue, "end": self.now + queue + work, "outcome": outcome, "pages": pages}
        return job_id, ""

    def query(self, *, token, job_id, base_url):
        job = self.jobs[job_id]
        if self.now < job["start"]:
            return {"state": "pending", "extractProgress": {"extractedPages": 0, "totalPages": job["pages"]}}
        if self.now < job["end"]:
            return {"state": "running", "extractProgress": {"extractedPages": 1, "totalPages": job["pages"]}}
        if job["outcome"] == "failed":
            return {"state": "failed", "errorMsg": "boom"}
        return {"state": "done", "resultUrl": {"jsonUrl": job_id}}

    def download(self, *, jsonl_url):
        job = self.jobs[jsonl_url]
        first = job["index"] * 10 + 1
        # 每片的全局编号都从 0 编（和真的 Paddle 一样）
        return {
            "layoutParsingResults": [_page_payload(first + n, n) for n in range(job["pages"])],
            "dataInfo": {"type": "pdf", "numPages": job["pages"], "pages": [{"width": 1190, "height": 1684}] * job["pages"]},
            "_meta": {"source": "paddle_jsonl", "dataInfoComplete": True},
        }


def _run(tmp_path: Path, fake: FakePaddle, pages: int, *, prefixes=None, hedge=20.0, raw="raw"):
    pdf = tmp_path / f"book-{pages}.pdf"
    if not pdf.exists():
        _pdf(pdf, pages)
    return request_chunks(
        pdf,
        tmp_path / raw,
        token="t",
        model="m",
        optional_payload={},
        base_url="https://paddle.test",
        pages_per_chunk=10,
        workers=4,
        hedge_seconds=hedge,
        on_prefix=(lambda payloads: prefixes.append(sum(len(p["layoutParsingResults"]) for p in payloads))) if prefixes is not None else None,
        submit=fake.submit,
        query=fake.query,
        download=fake.download,
        sleep=fake.sleep,
        clock=fake.clock,
    )


def test_chunks_run_in_parallel_and_publish_the_contiguous_prefix(tmp_path: Path) -> None:
    # 第 1 片最慢：它做完之前什么都不公布；做完以后前三片一起公布
    fake = FakePaddle({0: [(0, 8, "done")], 1: [(0, 2, "done")], 2: [(0, 3, "done")], 3: [(0, 1, "done")]})
    prefixes: list[int] = []
    payloads = _run(tmp_path, fake, 34, prefixes=prefixes)
    assert sorted(fake.submits) == [0, 1, 2, 3], "4 片同时交，各交一次"
    assert prefixes == [34]
    assert fake.now < 12, "并行：总时长是最慢那片，不是相加"
    assert [len(p["layoutParsingResults"]) for p in payloads] == [10, 10, 10, 4]


def test_prefix_is_published_as_soon_as_the_first_chunks_are_done(tmp_path: Path) -> None:
    fake = FakePaddle({0: [(0, 1, "done")], 1: [(0, 2, "done")], 2: [(0, 9, "done")]})
    prefixes: list[int] = []
    _run(tmp_path, fake, 30, prefixes=prefixes)
    assert prefixes == [10, 20, 30]


def test_a_chunk_stuck_in_the_queue_is_submitted_again(tmp_path: Path) -> None:
    # 第 2 片第一次交上去排了 300 秒；20 秒还没动就再交一份，第二份马上做完
    fake = FakePaddle({1: [(300, 1, "done"), (0, 1, "done")]})
    _run(tmp_path, fake, 20, hedge=20.0)
    assert fake.submits.count(1) == 2
    assert fake.now < 40, "不该等满第一份的 300 秒"


def test_a_failed_chunk_is_resubmitted_and_gives_up_after_three_tries(tmp_path: Path) -> None:
    fake = FakePaddle({0: [(0, 1, "failed"), (0, 1, "done")]})
    _run(tmp_path, fake, 10)
    assert fake.submits == [0, 0]
    always = FakePaddle({0: [(0, 1, "failed")]})
    with pytest.raises(RuntimeError, match="交了 3 次都失败"):
        _run(tmp_path, always, 10, raw="raw2")


def test_rerun_reuses_finished_chunks(tmp_path: Path) -> None:
    _run(tmp_path, FakePaddle({}), 25)
    (tmp_path / "raw" / "chunk-002-21-25.json").unlink()
    again = FakePaddle({})
    _run(tmp_path, again, 25)
    assert again.submits == [2]


def test_merge_offsets_global_ids_so_chunks_do_not_share_continuation_groups() -> None:
    chunk = lambda index, pages: {
        "layoutParsingResults": [_page_payload(index * 10 + n + 1, n) for n in range(pages)],
        "dataInfo": {"numPages": pages, "pages": [{"width": 1, "height": 1}] * pages},
        "_meta": {"dataInfoComplete": True},
    }
    merged = merge_paddle_chunks([chunk(0, 3), chunk(1, 2)])
    groups = [p["prunedResult"]["parsing_res_list"][0]["global_group_id"] for p in merged["layoutParsingResults"]]
    assert groups == [0, 1, 2, 3, 4]
    assert merged["dataInfo"]["numPages"] == 5 and merged["_meta"]["dataInfoComplete"] is True
