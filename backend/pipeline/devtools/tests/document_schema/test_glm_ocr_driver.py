"""GLM-OCR 驱动：分片请求、断点、选页、拼接、裁图、归一化。接口是假的（按请求的页数造结果），不花钱。"""

from __future__ import annotations

import json
from pathlib import Path
from types import SimpleNamespace

import fitz
import pytest
import requests

from retainpdf_pipeline.ocr.ocr_provider import glm_ocr_api
from retainpdf_pipeline.ocr.ocr_provider import glm_ocr_driver
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


def _job(tmp_path: Path, pdf: Path, page_ranges: str = "", name: str = "job") -> SimpleNamespace:
    root = tmp_path / name
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


def _forget_chunk(job: SimpleNamespace, name: str, *, chunk_pages: int) -> None:
    """这一片没做完：任务目录和各任务共用的缓存里都没有它。"""
    from retainpdf_base import paths
    from retainpdf_pipeline.ocr.ocr_provider.glm_ocr_driver import shared_chunk_dir

    (Path(job.ocr_dir) / "glm_ocr_raw" / name).unlink()
    source_hash = glm_ocr_driver._sha256(Path(job.file_path))
    (shared_chunk_dir(paths.GLM_OCR_CHUNK_CACHE_DIR, source_hash, chunk_pages) / name).unlink()


def test_rerunning_the_job_does_not_pay_for_chunks_already_done(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("RETAIN_GLM_OCR_CHUNK_PAGES", "2")
    job = _job(tmp_path, _pdf(tmp_path / "book.pdf", 5))
    run_glm_ocr_to_job_dir(job, parse=FakeGlm())
    # 中断过：最后一片的结果没了
    _forget_chunk(job, "chunk-002-5-5.json", chunk_pages=2)
    again = FakeGlm()
    run_glm_ocr_to_job_dir(job, parse=again)
    assert again.calls == [1]
    # 换了分片大小：旧片对不上，全部重来
    monkeypatch.setenv("RETAIN_GLM_OCR_CHUNK_PAGES", "3")
    resized = FakeGlm()
    run_glm_ocr_to_job_dir(job, parse=resized)
    assert resized.calls == [3, 2]


class Interrupted(RuntimeError):
    pass


def _fails_after(chunks: int, fake: FakeGlm):
    def parse(pdf_bytes: bytes, *, api_key: str) -> dict:
        if len(fake.calls) >= chunks:
            raise Interrupted("GLM-OCR 请求超时")
        return fake(pdf_bytes, api_key=api_key)

    return parse


def test_a_new_job_on_the_same_file_reuses_chunks_another_job_paid_for(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("RETAIN_GLM_OCR_CHUNK_PAGES", "2")
    pdf = _pdf(tmp_path / "book.pdf", 5)
    # 第一个任务做了两片就断了（超时、重启）
    first = FakeGlm()
    with pytest.raises(Interrupted):
        run_glm_ocr_to_job_dir(_job(tmp_path, pdf, name="first"), parse=_fails_after(2, first))
    assert first.calls == [2, 2]
    # 重试新建的任务目录是空的，也只付剩下的一片
    retry = FakeGlm()
    result = run_glm_ocr_to_job_dir(_job(tmp_path, pdf, name="retry"), parse=retry)
    assert retry.calls == [1]
    assert [page["blocks"][0]["text"] for page in _document(result)["pages"]] == [f"Page {n}" for n in range(1, 6)]
    # 任务目录照旧有全部原始片
    assert sorted(path.name for path in (Path(result.job_dirs.root) / "ocr" / "glm_ocr_raw").glob("chunk-*.json")) == [
        "chunk-000-1-2.json", "chunk-001-3-4.json", "chunk-002-5-5.json",
    ]
    # 再来一个任务：一分钱不花
    again = FakeGlm()
    run_glm_ocr_to_job_dir(_job(tmp_path, pdf, name="again"), parse=again)
    assert again.calls == []


def test_the_shared_cache_misses_for_another_file_or_chunk_size(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("RETAIN_GLM_OCR_CHUNK_PAGES", "2")
    run_glm_ocr_to_job_dir(_job(tmp_path, _pdf(tmp_path / "book.pdf", 4), name="a"), parse=FakeGlm())
    other_file = FakeGlm()
    run_glm_ocr_to_job_dir(_job(tmp_path, _pdf(tmp_path / "other.pdf", 3), name="b"), parse=other_file)
    assert other_file.calls == [2, 1]
    monkeypatch.setenv("RETAIN_GLM_OCR_CHUNK_PAGES", "3")
    resized = FakeGlm()
    run_glm_ocr_to_job_dir(_job(tmp_path, tmp_path / "book.pdf", name="c"), parse=resized)
    assert resized.calls == [3, 1]


def test_a_broken_shared_chunk_is_requested_again(tmp_path: Path, monkeypatch) -> None:
    from retainpdf_base import paths
    from retainpdf_pipeline.ocr.ocr_provider.glm_ocr_driver import shared_chunk_dir

    monkeypatch.setenv("RETAIN_GLM_OCR_CHUNK_PAGES", "2")
    pdf = _pdf(tmp_path / "book.pdf", 4)
    run_glm_ocr_to_job_dir(_job(tmp_path, pdf, name="a"), parse=FakeGlm())
    shared = shared_chunk_dir(paths.GLM_OCR_CHUNK_CACHE_DIR, glm_ocr_driver._sha256(pdf), 2)
    (shared / "chunk-000-1-2.json").write_text("{", encoding="utf-8")
    payload = json.loads((shared / "chunk-001-3-4.json").read_text(encoding="utf-8"))
    payload["layout_details"] = payload["layout_details"][:1]
    (shared / "chunk-001-3-4.json").write_text(json.dumps(payload), encoding="utf-8")
    again = FakeGlm()
    run_glm_ocr_to_job_dir(_job(tmp_path, pdf, name="b"), parse=again)
    assert again.calls == [2, 2]


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

from retainpdf_base.ocr_stream import read_ocr_stream


def _record_publishes(monkeypatch) -> list[list]:
    """记下每次公布时的整份前缀页（公布在主线程里做，下一片的请求同时在跑，不互相等）。"""
    from retainpdf_base import ocr_stream

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
    _forget_chunk(job, "chunk-002-5-5.json", chunk_pages=2)

    def broken(pdf_bytes: bytes, *, api_key: str) -> dict:
        # 续跑时断点里的前 4 页在请求之前就公布了
        assert read_ocr_stream(Path(job.ocr_dir)).ready_pages == 4
        raise glm_ocr_api.GlmOcrRequestRejected("GLM-OCR 请求被拒绝 status=401")

    with pytest.raises(glm_ocr_api.GlmOcrRequestRejected):
        run_glm_ocr_to_job_dir(job, parse=broken)
    state = read_ocr_stream(Path(job.ocr_dir))
    assert state.failed and not state.done and state.ready_pages == 4
    assert "status=401" in state.error


# ---- 两栏被框成一块（2026-11-01 GEDIIS 第 1 页）----

from retainpdf_pipeline.ocr.document_schema.provider_adapters.glm_ocr.adapter import paddle_page_payload
from retainpdf_pipeline.ocr.ocr_provider.glm_ocr_repair import split_cross_column_blocks

LEFT_LINES = [f"left column sentence number {n} keeps going here" for n in range(1, 9)]
RIGHT_LINES = [f"right column words appear {n} in this place" for n in range(1, 9)]


def _two_column_pdf(path: Path, *, text_layer: bool = True) -> Path:
    with fitz.open() as document:
        page = document.new_page(width=612, height=792)
        if text_layer:
            for n, (left, right) in enumerate(zip(LEFT_LINES, RIGHT_LINES)):
                page.insert_text((54, 420 + 12 * n), left, fontsize=9)
                page.insert_text((318, 420 + 12 * n), right, fontsize=9)
            page.insert_text((54, 300), "A full width note that runs across the whole page from the left margin to the right", fontsize=9)
        document.save(path)
    return path


def _spanning_payload() -> dict:
    # 模型像素 = 点 × 2；左右两栏各有一个正常宽度的正文块，中间一块把两栏框在了一起
    page = [
        {"index": 0, "label": "text", "native_label": "text", "bbox_2d": [108, 580, 1170, 610], "content": "A full width note that runs across the whole page from the left margin to the right"},
        {"index": 1, "label": "text", "native_label": "paragraph_title", "bbox_2d": [108, 800, 300, 826], "content": "## I. Introduction"},
        {"index": 2, "label": "text", "native_label": "text", "bbox_2d": [108, 806, 1170, 1030], "content": "I. Introduction " + " ".join(LEFT_LINES) + " " + " ".join(RIGHT_LINES)},
        {"index": 3, "label": "text", "native_label": "text", "bbox_2d": [108, 1100, 590, 1300], "content": "Second left paragraph."},
        {"index": 4, "label": "text", "native_label": "text", "bbox_2d": [636, 1100, 1170, 1300], "content": "Second right paragraph."},
    ]
    return {"layout_details": [page], "data_info": {"pages": [{"width": 1224, "height": 1584}]}}


def test_a_block_spanning_both_columns_is_split_back_using_the_text_layer(tmp_path: Path) -> None:
    payload = _spanning_payload()
    splits = split_cross_column_blocks(payload, _two_column_pdf(tmp_path / "two.pdf"))
    assert len(splits) == 1, "只拆那一块：通栏的那行注释中间没有栏缝，不拆"
    blocks = payload["layout_details"][0]
    texts = [b["content"] for b in blocks]
    left = next(b for b in blocks if b["content"].startswith("I. Introduction left column"))
    right = next(b for b in blocks if b["content"].startswith("right column words appear 1"))
    assert left["content"].endswith("sentence number 8 keeps going here")
    assert right["content"].endswith("appear 8 in this place")
    assert left["bbox_2d"][2] < 612 < right["bbox_2d"][0], "左块收到栏缝左边、右块从栏缝右边开始"
    # 阅读顺序：左栏（标题、左块、左栏第二段）→ 右栏（右块、右栏第二段）
    assert texts.index(right["content"]) == texts.index("Second left paragraph.") + 1
    assert texts.index("Second right paragraph.") == texts.index(right["content"]) + 1
    assert [b["index"] for b in blocks] == list(range(len(blocks)))
    assert payload["_meta"]["cross_column_splits"][0]["page"] == 1


def test_nothing_is_split_without_a_text_layer(tmp_path: Path) -> None:
    payload = _spanning_payload()
    assert split_cross_column_blocks(payload, _two_column_pdf(tmp_path / "scan.pdf", text_layer=False)) == []
    assert len(payload["layout_details"][0]) == 5


def test_a_heading_repeated_at_the_start_of_the_body_below_it_is_dropped() -> None:
    blocks = _spanning_payload()["layout_details"][0]
    parsing = paddle_page_payload(blocks, {"width": 1224, "height": 1584}, {})["prunedResult"]["parsing_res_list"]
    body = parsing[2]  # 标题下面那块正文（index 2）
    assert body["block_content"].startswith("left column sentence number 1"), "标题单独一块，正文开头不该再有它"
    assert parsing[1]["block_content"] == "I. Introduction"


def test_a_request_waits_by_the_pages_it_carries_unless_the_timeout_is_set(tmp_path: Path, monkeypatch) -> None:
    # 10 页一片最多等 3 分钟（以前一律 15 分钟，加 5 次重试，服务端不回时一个多小时才报错）；写了环境变量就一律用它。
    monkeypatch.delenv(glm_ocr_api.GLM_OCR_TIMEOUT_ENV, raising=False)
    assert glm_ocr_api.timeout_seconds(10) == 180
    assert glm_ocr_api.timeout_seconds(100) == 1260
    assert glm_ocr_api.timeout_seconds(None) == glm_ocr_api.DEFAULT_TIMEOUT_SECONDS
    seen: list[float] = []

    def fake_request(_session, _method, _url, *, timeout, **_kwargs):
        seen.append(timeout)
        raise glm_ocr_api.RetainNetworkError("stop here")

    monkeypatch.setattr(glm_ocr_api, "request_with_retry", fake_request)
    chunk = _pdf(tmp_path / "chunk.pdf", 10).read_bytes()
    with pytest.raises(RuntimeError):
        glm_ocr_api.parse_pdf(chunk, api_key="test")
    monkeypatch.setenv(glm_ocr_api.GLM_OCR_TIMEOUT_ENV, "45")
    with pytest.raises(RuntimeError):
        glm_ocr_api.parse_pdf(chunk, api_key="test")
    assert seen == [180, 45]
    # 不是 PDF：读不出页数，按默认的等。
    assert glm_ocr_api.pdf_page_count(b"not a pdf") is None


# --- 某一页让服务端一直 500（2026-11-04：一套设计图纸第 61-70 页那片每次都 500，只有第 66 页整页怎么发都不行，切两半能认） ---

WIDE = 800  # 「坏页」的宽：整页发就 500，切成两半（各 400 宽）能认


def _pdf_with_wide_page(path: Path, pages: int, wide: int) -> Path:
    with fitz.open() as document:
        for number in range(pages):
            width = WIDE if number == wide else 595
            page = document.new_page(width=width, height=842)
            page.insert_text((72, 100), f"Page {number + 1} body text")
        document.save(path)
    return path


class ChokesOnWidePages(FakeGlm):
    """发来的 PDF 里只要有整张宽页就 500（`halves_fail` 时连切开的两半也 500）。记下每次请求的各页宽度。"""

    def __init__(self, *, halves_fail: bool = False) -> None:
        super().__init__()
        self.halves_fail = halves_fail
        self.widths: list[list[int]] = []

    def __call__(self, pdf_bytes: bytes, *, api_key: str) -> dict:
        with fitz.open(stream=pdf_bytes, filetype="pdf") as document:
            widths = [round(document[i].rect.width) for i in range(document.page_count)]
        self.widths.append(widths)
        if WIDE in widths or (self.halves_fail and WIDE // 2 in widths):
            raise glm_ocr_api.GlmOcrServerError("GLM-OCR 请求失败：network request failed after 5 attempts: HTTPError status=500")
        return super().__call__(pdf_bytes, api_key=api_key)


def test_a_page_the_server_chokes_on_is_recognized_in_two_halves_and_the_rest_page_by_page(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("RETAIN_GLM_OCR_CHUNK_PAGES", "3")
    fake = ChokesOnWidePages()
    job = _job(tmp_path, _pdf_with_wide_page(tmp_path / "book.pdf", 4, wide=1))
    result = run_glm_ocr_to_job_dir(job, parse=fake)
    # 第一片（1-3 页）整片 500 → 逐页：第 1、3 页单发能认，第 2 页单发 500 → 左右两半各一次；第二片照常
    assert fake.widths == [[595, 800, 595], [595], [800], [400], [400], [595], [595]]
    payload = json.loads(result.provider_result_json_path.read_text(encoding="utf-8"))
    assert payload["_meta"]["page_fallbacks"] == [{"page": 2, "mode": "halves", "error": payload["_meta"]["page_fallbacks"][0]["error"]}]
    second = payload["layout_details"][1]
    assert payload["data_info"]["pages"][1] == {"width": PX_W * 2, "height": PX_H}
    # 两半的块都在：右半的框挪到右边
    assert len(second) == 6 and second[3]["bbox_2d"][0] == PX_W + second[0]["bbox_2d"][0]
    document = _document(result)
    assert len(document["pages"]) == 4 and document["pages"][1]["width"] == pytest.approx(WIDE)
    # 整片失败过、但都认出来了：照常进断点，重跑不再花钱
    again = ChokesOnWidePages()
    run_glm_ocr_to_job_dir(job, parse=again)
    assert again.widths == []


def test_a_page_that_never_recognizes_is_left_empty_and_the_book_goes_on(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setenv("RETAIN_GLM_OCR_CHUNK_PAGES", "3")
    fake = ChokesOnWidePages(halves_fail=True)
    job = _job(tmp_path, _pdf_with_wide_page(tmp_path / "book.pdf", 4, wide=1))
    result = run_glm_ocr_to_job_dir(job, parse=fake)
    payload = json.loads(result.provider_result_json_path.read_text(encoding="utf-8"))
    assert [(item["page"], item["mode"]) for item in payload["_meta"]["page_fallbacks"]] == [(2, "failed")]
    assert payload["layout_details"][1] == []
    document = _document(result)
    assert len(document["pages"]) == 4 and document["pages"][1]["blocks"] == []
    assert [block["text"] for block in document["pages"][2]["blocks"]][:1] == ["Page 3"]
    # 有页没认出来的那片不进断点：重跑还会再试（第二片已经进了断点，不再请求）
    again = ChokesOnWidePages(halves_fail=True)
    run_glm_ocr_to_job_dir(job, parse=again)
    # 整片、第 1 页、第 2 页、第 2 页左半（左半也 500，右半就不发了）、第 3 页
    assert again.widths == [[595, 800, 595], [595], [800], [400], [595]]


def test_only_server_errors_are_retried_page_by_page(tmp_path: Path, monkeypatch) -> None:
    # 超时、连不上、被拒都照旧直接失败：网络断了时逐页再试只会每页各等一遍重试
    monkeypatch.setenv("RETAIN_GLM_OCR_CHUNK_PAGES", "3")
    calls: list[int] = []

    def offline(pdf_bytes: bytes, *, api_key: str) -> dict:
        calls.append(1)
        raise RuntimeError("GLM-OCR 请求失败：network request failed after 5 attempts: ConnectTimeout status=")

    with pytest.raises(RuntimeError, match="ConnectTimeout"):
        run_glm_ocr_to_job_dir(_job(tmp_path, _pdf(tmp_path / "book.pdf", 3)), parse=offline)
    assert calls == [1]


def test_a_final_5xx_is_reported_as_a_server_error(monkeypatch) -> None:
    def always_500(*_args, **_kwargs):
        raise glm_ocr_api.RetainNetworkError("GLM-OCR network request failed after 5 attempts: HTTPError status=500", status_code=500)

    monkeypatch.setattr(glm_ocr_api, "request_with_retry", always_500)
    with pytest.raises(glm_ocr_api.GlmOcrServerError):
        glm_ocr_api.parse_pdf(b"%PDF", api_key="k")

    def offline(*_args, **_kwargs):
        raise glm_ocr_api.RetainNetworkError("GLM-OCR network request failed after 5 attempts: ConnectionError status=")

    monkeypatch.setattr(glm_ocr_api, "request_with_retry", offline)
    with pytest.raises(RuntimeError) as raised:
        glm_ocr_api.parse_pdf(b"%PDF", api_key="k")
    assert not isinstance(raised.value, glm_ocr_api.GlmOcrServerError)
