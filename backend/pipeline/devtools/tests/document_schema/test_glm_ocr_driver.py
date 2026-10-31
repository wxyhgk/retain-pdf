"""GLM-OCR 驱动：分片请求、断点、选页、拼接、裁图、归一化。接口是假的（按请求的页数造结果），不花钱。"""

from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace

import fitz
import pytest
import requests

from retainpdf_pipeline.ocr.ocr_provider import glm_ocr_api
from retainpdf_pipeline.ocr.ocr_provider.glm_ocr_driver import merge_chunks
from retainpdf_pipeline.ocr.ocr_provider.glm_ocr_driver import parse_page_ranges
from retainpdf_pipeline.ocr.ocr_provider.glm_ocr_driver import run_glm_ocr_to_job_dir

PX_W, PX_H = 1240, 1754  # A4 按 150 dpi 的模型像素


def _pdf(path: Path, pages: int) -> Path:
    with fitz.open() as document:
        for number in range(pages):
            page = document.new_page(width=595, height=842)
            page.insert_text((72, 100), f"Page {number + 1} body text")
            page.draw_rect(fitz.Rect(100, 300, 400, 500), color=(0, 0, 1), fill=(0.8, 0.8, 1))
        document.save(path)
    return path


def _job(tmp_path: Path, pdf: Path, page_ranges: str = "") -> SimpleNamespace:
    root = tmp_path / "job"
    names = ("source", "ocr", "translated", "rendered", "artifacts", "logs")
    for name in names:
        (root / name).mkdir(parents=True, exist_ok=True)
    return SimpleNamespace(
        file_path=str(pdf), page_ranges=page_ranges, ocr_credential="test-key", job_root=str(root),
        **{f"{name}_dir": str(root / name) for name in names},
    )


class FakeGlm:
    """按请求里的页数造结果：每页一个标题、一段正文、一张图；记下每次请求了几页。"""

    def __init__(self) -> None:
        self.calls: list[int] = []

    def __call__(self, pdf_bytes: bytes, *, api_key: str) -> dict:
        assert api_key == "test-key"
        with fitz.open(stream=pdf_bytes, filetype="pdf") as document:
            pages = [document[i].get_text().strip() for i in range(document.page_count)]
        self.calls.append(len(pages))
        image_box = [208, 625, 833, 1042]  # 原文 (100,300)-(400,500) 点 × 150/72
        return {
            "model": "glm-ocr",
            "request_id": f"req-{len(self.calls)}",
            "data_info": {"num_pages": len(pages), "pages": [{"width": PX_W, "height": PX_H}] * len(pages)},
            "layout_details": [
                [
                    {"index": 0, "label": "text", "native_label": "paragraph_title", "bbox_2d": [150, 160, 700, 220], "content": f"## {text.split(' body')[0]}"},
                    {"index": 1, "label": "text", "native_label": "text", "bbox_2d": [150, 240, 1100, 300], "content": f"{text} with $ x^{{2}} $."},
                    {"index": 2, "label": "image", "native_label": "image", "bbox_2d": image_box},
                ]
                for text in pages
            ],
            "md_results": "\n\n".join(f"## {text}\n\n![](page={i},bbox={image_box})" for i, text in enumerate(pages)),
            "usage": {"prompt_tokens": 100 * len(pages), "completion_tokens": 10 * len(pages), "total_tokens": 110 * len(pages)},
        }


def _document(result) -> dict:
    return json.loads(result.normalized_json_path.read_text(encoding="utf-8"))


def test_book_is_sent_in_chunks_and_comes_back_as_one_document(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("RETAIN_GLM_OCR_CHUNK_PAGES", "2")
    fake = FakeGlm()
    result = run_glm_ocr_to_job_dir(_job(tmp_path, _pdf(tmp_path / "book.pdf", 5)), parse=fake)
    assert fake.calls == [2, 2, 1]
    document = _document(result)
    assert [page["blocks"][0]["text"] for page in document["pages"]] == [f"Page {n}" for n in range(1, 6)]
    # 坐标从模型像素缩放到原文的点
    assert document["pages"][0]["width"] == pytest.approx(595)
    payload = json.loads(result.provider_result_json_path.read_text(encoding="utf-8"))
    assert payload["usage"]["total_tokens"] == 550
    assert [(c["start_page"], c["end_page"]) for c in payload["_meta"]["chunks"]] == [(1, 2), (3, 4), (5, 5)]


def test_every_image_is_cropped_from_the_source_and_linked(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("RETAIN_GLM_OCR_CHUNK_PAGES", "2")
    result = run_glm_ocr_to_job_dir(_job(tmp_path, _pdf(tmp_path / "book.pdf", 3)), parse=FakeGlm())
    images = [block for page in _document(result)["pages"] for block in page["blocks"] if block["sub_type"] == "image_body"]
    assert len(images) == 3 and all(block["metadata"]["asset_resolved"] for block in images)
    root = Path(result.job_dirs.root)
    files = sorted(p.relative_to(root / "md" / "images").as_posix() for p in (root / "md" / "images").rglob("*.jpg"))
    # 三页的框一样：按页分开放，不会互相覆盖
    assert files == [f"page-{n}/imgs/img_in_image_box_208_625_833_1042.jpg" for n in (1, 2, 3)]
    # 整份 markdown 里的占位换成本地图片；第二片的片内页号 0 是全书第 3 页
    full_md = (root / "md" / "full.md").read_text(encoding="utf-8")
    assert "](page=" not in full_md
    assert "images/page-3/imgs/img_in_image_box_208_625_833_1042.jpg" in full_md


def test_rerunning_the_job_does_not_pay_for_chunks_already_done(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("RETAIN_GLM_OCR_CHUNK_PAGES", "2")
    job = _job(tmp_path, _pdf(tmp_path / "book.pdf", 5))
    run_glm_ocr_to_job_dir(job, parse=FakeGlm())
    # 中断过：最后一片的结果没了
    raw_dir = Path(job.ocr_dir) / "glm_ocr_raw"
    (raw_dir / "chunk-002-5-5.json").unlink()
    again = FakeGlm()
    run_glm_ocr_to_job_dir(job, parse=again)
    assert again.calls == [1]
    # 换了分片大小：旧片对不上，全部重来
    monkeypatch.setenv("RETAIN_GLM_OCR_CHUNK_PAGES", "3")
    resized = FakeGlm()
    run_glm_ocr_to_job_dir(job, parse=resized)
    assert resized.calls == [3, 2]


def test_selected_pages_become_the_source(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("RETAIN_GLM_OCR_CHUNK_PAGES", "10")
    fake = FakeGlm()
    result = run_glm_ocr_to_job_dir(_job(tmp_path, _pdf(tmp_path / "book.pdf", 6), page_ranges="2-3,5"), parse=fake)
    assert fake.calls == [3]
    assert [page["blocks"][0]["text"] for page in _document(result)["pages"]] == ["Page 2", "Page 3", "Page 5"]
    with fitz.open(result.source_pdf_path) as source:
        assert source.page_count == 3


def test_page_ranges_are_validated() -> None:
    assert parse_page_ranges("", 4) == [0, 1, 2, 3]
    assert parse_page_ranges("all", 2) == [0, 1]
    assert parse_page_ranges("3, 1-2,2", 5) == [0, 1, 2]
    for bad in ("0-2", "3-1", "1-9", "a"):
        with pytest.raises(RuntimeError):
            parse_page_ranges(bad, 5)


def test_a_chunk_with_the_wrong_page_count_fails_instead_of_shifting_pages(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("RETAIN_GLM_OCR_CHUNK_PAGES", "2")
    fake = FakeGlm()

    def short(pdf_bytes: bytes, *, api_key: str) -> dict:
        payload = fake(pdf_bytes, api_key=api_key)
        payload["layout_details"] = payload["layout_details"][:1]
        return payload

    with pytest.raises(RuntimeError, match="页数不对"):
        run_glm_ocr_to_job_dir(_job(tmp_path, _pdf(tmp_path / "book.pdf", 2)), parse=short)


def test_merge_offsets_markdown_image_pages_per_chunk() -> None:
    chunk = {"layout_details": [[], []], "data_info": {"pages": [{}, {}]}, "md_results": "![](page=1,bbox=[1, 2, 3, 4])"}
    merged = merge_chunks([chunk, chunk], chunk_pages=2)
    assert merged["md_results"] == "![](page=1,bbox=[1, 2, 3, 4])\n\n![](page=3,bbox=[1, 2, 3, 4])"


def test_rejected_request_explains_why_without_leaking_the_key(monkeypatch) -> None:
    class Response:
        status_code = 401
        headers: dict = {}

        def json(self) -> dict:
            return {"error": {"code": "1000", "message": "身份验证失败"}}

        def raise_for_status(self) -> None:
            raise requests.HTTPError("401", response=self)

    class Session:
        def request(self, *args, **kwargs):
            return Response()

    with pytest.raises(glm_ocr_api.GlmOcrRequestRejected) as error:
        glm_ocr_api.parse_pdf(b"%PDF", api_key="secret-key-123", session=Session())
    assert "status=401" in str(error.value) and "身份验证失败" in str(error.value)
    assert "secret-key-123" not in str(error.value)
    with pytest.raises(glm_ocr_api.GlmOcrRequestRejected, match="缺少 API key"):
        glm_ocr_api.parse_pdf(b"%PDF", api_key="")


# ---- 流式公布（OCR 和翻译并行，2026-10-31）----

from retainpdf_pipeline.foundation.shared.ocr_stream import read_ocr_stream


def _record_publishes(monkeypatch) -> list[list]:
    """记下每次公布时的整份前缀页（公布在主线程里做，下一片的请求同时在跑，不互相等）。"""
    from retainpdf_pipeline.foundation.shared import ocr_stream

    published: list[list] = []
    original = ocr_stream.OcrStreamWriter.publish

    def recording(self, document: dict, *, done: bool = False) -> None:
        published.append(json.loads(json.dumps(document["pages"])))
        original(self, document, done=done)

    monkeypatch.setattr(ocr_stream.OcrStreamWriter, "publish", recording)
    return published


def test_each_chunk_is_published_as_soon_as_it_arrives(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("RETAIN_GLM_OCR_CHUNK_PAGES", "2")
    published = _record_publishes(monkeypatch)
    job = _job(tmp_path, _pdf(tmp_path / "book.pdf", 5))
    result = run_glm_ocr_to_job_dir(job, parse=FakeGlm())
    # 每片一次（2、4、5 页），最后整份再标一次 done
    assert [len(pages) for pages in published] == [2, 4, 5, 5]
    state = read_ocr_stream(Path(job.ocr_dir))
    assert (state.ready_pages, state.total_pages, state.done, state.failed) == (5, 5, True, False)
    final = _document(result)["pages"]
    assert json.loads(state.document_path.read_text(encoding="utf-8"))["pages"] == final
    for pages in published:
        assert pages == final[: len(pages)], "翻译按前缀页先做，前缀里的页必须和最后整份的同一页一模一样"
    # 前缀里的图片已经裁好挂上
    images = [b for page in published[0] for b in page["blocks"] if b["sub_type"] == "image_body"]
    assert images and all(b["metadata"]["asset_resolved"] for b in images)


def test_resumed_chunks_are_published_at_once_and_failure_is_announced(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("RETAIN_GLM_OCR_CHUNK_PAGES", "2")
    job = _job(tmp_path, _pdf(tmp_path / "book.pdf", 5))
    run_glm_ocr_to_job_dir(job, parse=FakeGlm())
    (Path(job.ocr_dir) / "glm_ocr_raw" / "chunk-002-5-5.json").unlink()

    def broken(pdf_bytes: bytes, *, api_key: str) -> dict:
        # 续跑时断点里的前 4 页在请求之前就公布了
        assert read_ocr_stream(Path(job.ocr_dir)).ready_pages == 4
        raise glm_ocr_api.GlmOcrRequestRejected("GLM-OCR 请求被拒绝 status=401")

    with pytest.raises(glm_ocr_api.GlmOcrRequestRejected):
        run_glm_ocr_to_job_dir(job, parse=broken)
    state = read_ocr_stream(Path(job.ocr_dir))
    assert state.failed and not state.done and state.ready_pages == 4
    assert "status=401" in state.error
