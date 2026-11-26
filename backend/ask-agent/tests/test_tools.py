"""读书：块从 reader/regions 来，页图从页图接口来。带没带字、代码先取的上下文（背景 / 那一页 / 目录）、兜底的三个工具。
后端是假的（一个本机 HTTP 服务、或者换掉 http_get）。"""
from __future__ import annotations

import base64
import json
import threading
from http.server import BaseHTTPRequestHandler
from http.server import ThreadingHTTPServer

from retainpdf_ask_agent.tools import BookTools
from retainpdf_ask_agent.tools import make_book_tools


def _item(item_id, page, source, translated=None, *, sub_type="body", level=None, group=None, own=None, translated_page=None):
    item = {"item_id": item_id, "source": {"page": page, "text": source}, "translated": {"page": translated_page or page, "text": translated},
            "region_type": "text", "status": "translated" if translated else "source_only", "sub_type": sub_type}
    if level is not None:
        item["heading_level"] = level
    if group:
        item["continuation_group_id"] = group
    if own:
        item["translated_block_text"] = own
    return item


ITEMS = [
    _item("p001-b0000", 1, "Quantum Chemistry", "量子化学", sub_type="title", level=1),
    _item("p001-b0001", 1, "Page header", None, sub_type="header"),
    _item("p002-b0000", 2, "1 The Schrodinger Equation", "1 薛定谔方程", sub_type="heading", level=2),
    _item("p002-b0001", 2, "The Hamiltonian operator is Hermitian.", "哈密顿算符是厄米的。"),
    _item("p002-b0002", 2, "It has real eigenvalues and", "它有实的本征值，并且本征函数正交。", group="g1", own="它有实的本征值，并且"),
    _item("p002-b0003", 2, "E = mc^2", None, sub_type="display_formula"),
    _item("p003-b0000", 3, "orthogonal eigenfunctions.", "它有实的本征值，并且本征函数正交。", group="g1"),
    _item("p003-b0001", 3, "1.1 Time dependence", "1.1 含时", sub_type="heading", level=3),
    _item("p003-b0002", 3, "2", None, sub_type="page_number"),
    _item("p005-b0000", 5, "Last words.", "结语。"),
]

# 前端（ask-context.ts 的 anchorPreamble）附在第一问前面的出处
ANCHOR_WITH_TEXT = "我在读一本书，第 2 页（译文栏）。\n\n这一块的原文：\nThe Hamiltonian operator is Hermitian.\n\n（RetainPDF 任务 job-1，块 p002-b0001，第 2 页）"
ANCHOR_NO_TEXT = "我在读一本书，第 4 页（原文栏）。\n\n这一处没有认出文字（可能是扫描页、图或公式），可以去看这一页。\n\n（RetainPDF 任务 job-1，第 4 页）"
JPEG = b"\xff\xd8\xff fake jpeg"


def _tools(items=None, *, document_id="doc1", pages=None):
    calls = []

    def http_get(path, timeout):
        calls.append(path)
        if path.endswith("/reader/regions"):
            return 200, "application/json", json.dumps({"code": 0, "data": {"items": items if items is not None else ITEMS}}).encode()
        for prefix, reply in (pages or {}).items():
            if path.startswith(prefix):
                return reply
        return 404, "application/json", json.dumps({"code": 404, "message": "not found"}).encode()

    return BookTools(job_id="job-1", document_id=document_id, http_get=http_get), calls


def test_which_questions_carry_text() -> None:
    tools, _ = _tools()
    assert tools.carries_text([ANCHOR_WITH_TEXT, "这句译得对吗？"])
    assert tools.carries_text(["我选中的这段：\nHermitian", "什么意思"])
    assert tools.carries_text(["什么意思"], {"retainpdf": {"anchor": {"page": 2, "selection": "Hermitian"}}})
    assert not tools.carries_text([ANCHOR_NO_TEXT, "这页讲什么"])
    assert not tools.carries_text(["第 5 页讲了什么？"])
    assert not tools.carries_text(["问"], {"retainpdf": {"anchor": {"page": 2, "selection": "  "}}})


def test_background_for_a_question_with_text_is_small() -> None:
    tools, calls = _tools()
    context = tools.background([ANCHOR_WITH_TEXT, "这句译得对吗？"])
    # 所在的节、同页前后各一块；提问那一块前端已经附了，不重复
    assert "所在的节：1 The Schrodinger Equation（第 2 页）" in context.text
    assert "[p002-b0000]" in context.text and "[p002-b0002]" in context.text
    assert "[p002-b0001]" not in context.text and "[p002-b0003]" not in context.text
    assert context.images == [] and context.info["item_id"] == "p002-b0001"
    # 问题里写了别的页：那一页也带上
    other = tools.background([ANCHOR_WITH_TEXT, "和第 5 页的说法一样吗？"])
    assert "第 5 页（问题里说到的）" in other.text and "结语。" in other.text
    assert calls == ["/api/v1/jobs/job-1/reader/regions"]


def test_background_gives_up_when_the_book_cannot_be_read() -> None:
    def down(path, timeout):
        raise OSError("connection refused")

    tools = BookTools(job_id="job-1", http_get=down)
    assert tools.background([ANCHOR_WITH_TEXT, "问"]) is None


def test_prefetch_for_a_question_without_text() -> None:
    tools, calls = _tools(pages={"/api/v1/documents/doc1/files/pages/4.jpg": (200, "image/jpeg", JPEG)})
    # 问题里写了第 5 页：取那一页
    page = tools.prefetch(["第 5 页讲了什么？"])
    assert "第 5 页（问题里说到的）" in page.text and "结语。" in page.text and page.info["pages"] == [5]
    # 点在没有文字层的页上：代码取页图，不让模型调 view_page
    scanned = tools.prefetch([ANCHOR_NO_TEXT, "这页讲什么"])
    assert scanned.images == [("image/jpeg", base64.b64encode(JPEG).decode())] and scanned.info["images"] == [4]
    assert calls[-1] == "/api/v1/documents/doc1/files/pages/4.jpg?width=1000"
    # 没有位置、也没写页码：不取，靠目录和工具
    assert tools.prefetch(["全书讲什么？"]) is None
    overview = tools.overview()
    assert overview.splitlines()[0] == "用户正在读的书共 5 页（页码是原文 PDF 的页码）。"
    assert "- Quantum Chemistry ｜ 量子化学 —— 第 1 页" in overview
    assert "  - 1 The Schrodinger Equation ｜ 1 薛定谔方程 —— 第 2 页" in overview
    assert "    - 1.1 Time dependence ｜ 1.1 含时 —— 第 3 页" in overview


def test_read_pages_reads_several_pages_at_once() -> None:
    tools, _ = _tools()
    result = tools.run("read_pages", {"pages": [2, 3]})
    assert not result.is_error and result.summary == "第 2 页 4 块，第 3 页 2 块"
    assert "=== 第 2 页（4 块）===" in result.text and "[p002-b0001] 正文" in result.text
    assert "原文：The Hamiltonian operator is Hermitian." in result.text and "译文：哈密顿算符是厄米的。" in result.text
    assert "[p002-b0003] 公式" in result.text and "标题（2 级）" in result.text
    # 跨页的段落：本块有自己那份译文就用自己的；页眉页码不算
    assert "译文：它有实的本征值，并且\n" in result.text and "[p003-b0002]" not in result.text
    assert "原文：" not in tools.run("read_pages", {"pages": [3], "side": "translated"}).text
    # 旧写法（一页）也认
    assert tools.run("read_page", {"page": 2}).summary == "第 2 页 4 块"


def test_tool_errors_go_back_to_the_model() -> None:
    tools, _ = _tools()
    assert "1–5" in tools.run("read_pages", {"pages": [9]}).text
    assert tools.run("read_pages", {"pages": [0]}).is_error
    assert tools.run("read_pages", {"pages": [1, 2, 3, 4, 5, 6]}).is_error
    assert tools.run("read_pages", {}).is_error
    assert tools.run("outline", {}).is_error
    empty, _ = _tools([])
    assert "还没有识别出文字" in empty.run("read_pages", {"pages": [1]}).text


def test_search_hits_carry_the_section_and_the_whole_block() -> None:
    tools, _ = _tools()
    result = tools.run("search_book", {"query": "hermitian"})
    assert "第 2 页，1 The Schrodinger Equation [p002-b0001] 正文" in result.text
    assert "原文：The Hamiltonian operator is Hermitian." in result.text and "译文：哈密顿算符是厄米的。" in result.text
    assert result.summary == "「hermitian」1 处，1 页"
    # 跨块的段落按整段的译文找
    both = tools.run("search_book", {"query": "本征 正交"})
    assert "[p002-b0002]" in both.text and "[p003-b0000]" in both.text
    assert "没找到" in tools.run("search_book", {"query": "Dirac"}).text
    assert tools.run("search_book", {"query": "  "}).is_error
    limited = tools.run("search_book", {"query": "的", "limit": 1})
    assert "列前 1 处" in limited.text and "全部命中的页" in limited.text


def test_view_page_fetches_the_source_or_translated_page_image() -> None:
    items = [_item("p001-b0000", 5, "x", "y", translated_page=2)]
    tools, calls = _tools(items, pages={
        "/api/v1/documents/doc1/files/pages/5.jpg": (200, "image/jpeg", JPEG),
        "/api/v1/jobs/job-1/files/pages/2.jpg": (409, "application/json", b'{"message":"page not ready","error":{"details":{"reason":"not_ready"}}}'),
    })
    source = tools.run("view_page", {"page": 5})
    assert not source.is_error and source.images == [("image/jpeg", base64.b64encode(JPEG).decode())]
    assert calls[-1] == "/api/v1/documents/doc1/files/pages/5.jpg?width=1000"
    # 译文页按任务自己的页号取
    translated = tools.run("view_page", {"page": 5, "side": "translated"})
    assert translated.is_error and "还没排好" in translated.text and calls[-1].startswith("/api/v1/jobs/job-1/files/pages/2.jpg")
    # 不知道书编号：原文页取不到，看任务的页
    no_doc, calls = _tools(items, document_id="")
    assert no_doc.run("view_page", {"page": 5}).is_error and calls[-1].startswith("/api/v1/jobs/job-1/files/pages/2.jpg")


class FakeBackend(BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802
        self.server.seen.append((self.path, self.headers.get("x-api-key")))  # type: ignore[attr-defined]
        body = json.dumps({"code": 0, "data": {"items": ITEMS}}).encode()
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *args):
        pass


def test_real_http_sends_the_key_and_reports_a_backend_that_is_down() -> None:
    server = ThreadingHTTPServer(("127.0.0.1", 0), FakeBackend)
    server.seen = []  # type: ignore[attr-defined]
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_address[1]}"
    try:
        tools = make_book_tools(job_id="merged-doc-abc", document_id="doc", base_url=base, api_key="agent-key")
        assert tools is not None and "哈密顿算符" in tools.run("read_pages", {"pages": [2]}).text
        assert server.seen == [("/api/v1/jobs/merged-doc-abc/reader/regions", "agent-key")]  # type: ignore[attr-defined]
    finally:
        server.shutdown()
        server.server_close()
    down = make_book_tools(job_id="job-1", document_id="", base_url=base, api_key="k")
    result = down.run("search_book", {"query": "x"})
    assert result.is_error and "连不上" in result.text
    assert down.overview() == ""
    # 没有书、地址不对：不给工具
    assert make_book_tools(job_id="", document_id="", base_url=base, api_key="k") is None
    assert make_book_tools(job_id="job/../x", document_id="", base_url=base, api_key="k") is None
    assert make_book_tools(job_id="job-1", document_id="", base_url="ftp://x", api_key="k") is None
