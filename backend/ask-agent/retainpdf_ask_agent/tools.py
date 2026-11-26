"""自带 agent 读书（只用标准库）：经后端的接口读正在读的那本书。

桥在握手时给 agent 书（任务编号，合并阅读的虚拟任务 `merged-…` 也行）、后端地址和一把能读的密钥（环境变量，见 `__main__.py`）。

**材料先给，常见的问题不用调工具**（2026-11-25 用户：「调用工具太多了，没有直达的」；11-26：「你规定死了也不好这样」——
工具一直给，用不用由模型按提示词定，不在代码里按问题删工具）。`carries_text(...)` 判断这一问带没带字，只用来挑取哪种材料：

- 带字（选中的字、前端附的那一块原文译文）：`background(...)` 补所在的节、同页前后各一块；问题里写了「第 N 页」就取那一页。
  书还没取到时最多等 1.5 秒，取不到就不带。
- 不带字（点在空白处、扫描页、问整本书）：`prefetch(...)` 取提问的那一页（或问题里写的页；没有文字层就附页图）。
- `overview()`：页数和两级以内的目录，放进系统提示词。

工具粗粒度、一次够用，都只读：

- `read_pages(pages, side?)`：一次读几页（每块的块编号、原文、译文）。
- `search_book(query, limit?)`：全书找字，每条命中带所在的节和整块原文译文（够直接回答，不用再读）。
- `view_page(page, side?)`：一页的图（公式、图表读不清时），图给模型看。

书的块全来自 `GET /jobs/{job_id}/reader/regions`（阅读页用的同一份，页码和阅读页一致），第一次用到时取一次、留在进程里
（会话一开就在后台先取）；页图来自 `GET /documents/{id}/files/pages/{page}.jpg`（原文）、`GET /jobs/{job_id}/files/pages/{page}.jpg`（译文）。
工具出错（页码不对、后端没开、这一页还没排好）不抛：回一段说明给模型（`ToolResult.is_error`），由它决定怎么办。
"""
from __future__ import annotations

import base64
import json
import re
import threading
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from dataclasses import field
from typing import Any, Callable

# 页眉、页脚、页码：读页、搜索都跳过
SKIP_SUB_TYPES = frozenset({"header", "footer", "page_header", "page_footer", "page_number"})
HEADING_SUB_TYPES = frozenset({"title", "heading"})
# 一次工具结果最多多少字（太长的截断，告诉模型）
MAX_PAGE_CHARS = 12_000
MAX_READ_CHARS = 24_000
MAX_READ_PAGES = 5
MAX_SEARCH_CHARS = 12_000
DEFAULT_SEARCH_LIMIT = 6
MAX_SEARCH_LIMIT = 12
HIT_SOURCE_CHARS = 600
HIT_TRANSLATED_CHARS = 500
# 系统提示词里的目录
MAX_OVERVIEW_CHARS = 3_000
MAX_OVERVIEW_ENTRIES = 60
# 每问之前自动取的上下文
NEIGHBOR_BLOCKS = 3
MAX_NEIGHBOR_CHARS = 1_200
MAX_ANCHOR_CHARS = 4_000
MAX_PREFETCH_PAGE_CHARS = 6_000
MAX_MENTIONED_PAGES = 2
# 带字的问题的背景：前后各一块，每块最多多少字；书还没取到时最多等多久
BACKGROUND_NEIGHBORS = 1
MAX_BACKGROUND_BLOCK_CHARS = 500
MAX_BACKGROUND_PAGE_CHARS = 4_000
BACKGROUND_WAIT_SECS = 1.5
# 前端附在问题前面的字（frontend/packages/reader/src/ask/ask-context.ts 的 anchorPreamble；2026-11-26 以前在 acp-adapter.ts 的 anchorPromptBlocks）
TEXT_MARKERS = ("我选中的这段：", "这一块的原文：", "这一块的译文：")
PAGE_IMAGE_WIDTH = 1000
# 一张图最多多大（Anthropic 一张图 5 MB 封顶，base64 再大三分之一）
MAX_IMAGE_BYTES = 3_500_000
REGIONS_TIMEOUT_SECS = 60
IMAGE_TIMEOUT_SECS = 90
ID_RE = re.compile(r"^[A-Za-z0-9_.:-]{1,200}$")
# 前端（frontend/packages/reader/src/ask/ask-context.ts 的 anchorPreamble；2026-11-26 以前在 acp-adapter.ts 的 anchorPromptBlocks）在第一问前面写的出处，最后一行是
# 「（RetainPDF 任务 <任务>，块 <块>，第 <页> 页）」；前端以后在 `_meta.retainpdf.anchor` 里直接给就不用认字了
ANCHOR_MARKER_RE = re.compile(r"（RetainPDF 任务 ([A-Za-z0-9_.:-]+)(?:，块 ([A-Za-z0-9_.:-]+))?，第 (\d{1,5}) 页）")
PAGE_MENTION_RE = re.compile(r"第\s*(\d{1,5})\s*页|\bpages?\s*(\d{1,5})\b|\bp\.\s*(\d{1,5})\b", re.IGNORECASE)

# (状态码, Content-Type, 内容)；连不上抛 OSError
HttpGet = Callable[[str, float], tuple[int, str, bytes]]


@dataclass
class ToolResult:
    """一次工具调用的结果：`text` 给模型，`images` 是 (MIME, base64) 跟着给模型看，`summary` 是给用户看的一句（ACP 工具卡片）。"""

    text: str
    images: list[tuple[str, str]] = field(default_factory=list)
    is_error: bool = False
    summary: str = ""


@dataclass
class Prefetch:
    """每问之前自动取的上下文：`text` 放在用户消息最前面，`images` 是没有文字层的页的图，`info` 记进用量（取了哪些）。"""

    text: str
    images: list[tuple[str, str]] = field(default_factory=list)
    info: dict[str, Any] = field(default_factory=dict)


def tool_error(text: str) -> ToolResult:
    return ToolResult(text=text, is_error=True, summary=text[:200])


TOOL_SPECS: list[dict[str, Any]] = [
    {
        "name": "read_pages",
        "description": "一次读书的几页（最多 5 页）：每页每一块的块编号、类型、原文和译文（按阅读顺序，页眉页脚页码不算）。"
                       "页码是原文 PDF 的页码，从 1 开始（和阅读页显示的一样）。要读的页一次给全，别一页一页地调。"
                       "side 只要原文（source）或只要译文（translated）时给，默认都要。",
        "parameters": {
            "type": "object",
            "properties": {
                "pages": {"type": "array", "items": {"type": "integer", "minimum": 1}, "minItems": 1, "maxItems": MAX_READ_PAGES,
                          "description": "页码列表，从 1 开始"},
                "side": {"type": "string", "enum": ["both", "source", "translated"], "description": "要原文、译文还是都要，默认 both"},
            },
            "required": ["pages"],
            "additionalProperties": False,
        },
    },
    {
        "name": "search_book",
        "description": "在整本书的原文和译文里找字（不分大小写；空格隔开的几个词都要出现在同一块里）。"
                       "每条命中带页码、所在的节、整块原文和译文，一般够直接回答，不用再读页。"
                       "不知道在哪页时用；一个词找不到再换原文或译文的说法试一次。",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "要找的字或词"},
                "limit": {"type": "integer", "minimum": 1, "maximum": MAX_SEARCH_LIMIT, "description": f"最多回几条，默认 {DEFAULT_SEARCH_LIMIT}"},
            },
            "required": ["query"],
            "additionalProperties": False,
        },
    },
    {
        "name": "view_page",
        "description": "看一页的图（JPEG）：只在公式、图、表的文字读不清，或者要核对排版时用；图很占篇幅。"
                       "side=source 看原文页（默认），side=translated 看排好的译文页。",
        "parameters": {
            "type": "object",
            "properties": {
                "page": {"type": "integer", "minimum": 1, "description": "原文 PDF 的页码，从 1 开始"},
                "side": {"type": "string", "enum": ["source", "translated"], "description": "原文页还是译文页，默认 source"},
            },
            "required": ["page"],
            "additionalProperties": False,
        },
    },
]

# ACP 工具卡片的 kind
TOOL_KINDS = {"read_pages": "read", "search_book": "search", "view_page": "fetch"}


def tool_title(name: str, arguments: dict[str, Any]) -> str:
    """给用户看的工具卡片标题。"""
    if name == "read_pages":
        pages = arguments.get("pages")
        pages = pages if isinstance(pages, list) else [arguments.get("page")]
        return f"读第 {'、'.join(str(page) for page in pages[:MAX_READ_PAGES])} 页"
    if name == "search_book":
        return f"在书里找「{str(arguments.get('query') or '')[:40]}」"
    if name == "view_page":
        return f"看第 {arguments.get('page')} 页的{'译文' if arguments.get('side') == 'translated' else '原文'}图"
    return name


def default_http_get(base_url: str, api_key: str) -> HttpGet:
    """标准库的 GET：带 `X-API-Key`；不走系统代理（后端在本机回环地址上）。"""
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))

    def get(path: str, timeout: float) -> tuple[int, str, bytes]:
        request = urllib.request.Request(base_url.rstrip("/") + path, headers={"X-API-Key": api_key, "Accept": "*/*"})
        try:
            with opener.open(request, timeout=timeout) as response:
                return response.status, response.headers.get("Content-Type", ""), response.read()
        except urllib.error.HTTPError as error:
            return error.code, error.headers.get("Content-Type", "") if error.headers else "", error.read() or b""

    return get


def _error_message(status: int, body: bytes) -> str:
    try:
        payload = json.loads(body.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        return f"HTTP {status}"
    message = payload.get("message") if isinstance(payload, dict) else None
    reason = ((payload.get("error") or {}).get("details") or {}).get("reason") if isinstance(payload, dict) else None
    return f"HTTP {status}：{message or ''}{f'（{reason}）' if reason else ''}"


def _clip(text: str, limit: int) -> str:
    text = " ".join(str(text or "").split())
    return text if len(text) <= limit else text[: limit - 1] + "…"


class BookTools:
    """读一本书。`http_get` 可以换成假的（测试）。"""

    def __init__(self, *, job_id: str, document_id: str = "", http_get: HttpGet):
        if not ID_RE.match(job_id or ""):
            raise ValueError("job_id is not a valid id")
        self.job_id = job_id
        self.document_id = document_id if ID_RE.match(document_id or "") else ""
        self.http_get = http_get
        self._items: list[dict[str, Any]] | None = None
        self._index: dict[str, int] = {}
        self._lock = threading.Lock()
        self._overview: str | None = None
        self._ready = threading.Event()
        self._warming = False

    # 给核心 ----------------------------------------------------------------

    def specs(self) -> list[dict[str, Any]]:
        return TOOL_SPECS

    def describe(self, name: str, arguments: dict[str, Any]) -> tuple[str, str]:
        return tool_title(name, arguments), TOOL_KINDS.get(name, "other")

    def run(self, name: str, arguments: dict[str, Any]) -> ToolResult:
        try:
            if name in ("read_pages", "read_page"):
                return self.read_pages(_pages(arguments), str(arguments.get("side") or "both"))
            if name == "search_book":
                return self.search_book(str(arguments.get("query") or ""), arguments.get("limit"))
            if name == "view_page":
                return self.view_page(_page(arguments.get("page")), str(arguments.get("side") or "source"))
            return tool_error(f"没有工具 {name}；能用的是 read_pages、search_book、view_page。")
        except ToolInputError as error:
            return tool_error(str(error))
        except OSError as error:
            return tool_error(f"连不上 RetainPDF 后端：{error}")
        except ValueError as error:
            return tool_error(f"后端回的数据读不懂：{error}")

    def warm(self) -> None:
        """会话一开就在后台把书的块取好，第一问不用等（取不到就算了，用到时再报）。"""
        self._warming = True
        try:
            self.items()
        except Exception:  # noqa: BLE001
            pass
        finally:
            self._ready.set()

    def carries_text(self, texts: list[str], meta: Any = None) -> bool:
        """这一问带没带字：`_meta.retainpdf.anchor` 里有选中的字或那一块的原文译文，或者前端在问题前面附了这些。"""
        anchor = ((meta or {}).get("retainpdf") or {}).get("anchor") if isinstance(meta, dict) else None
        if isinstance(anchor, dict) and any(str(anchor.get(key) or "").strip() for key in
                                            ("selection", "source_text", "translated_text", "sourceText", "translatedText")):
            return True
        return any(marker in (text or "") for text in texts for marker in TEXT_MARKERS)

    def background(self, texts: list[str], meta: Any = None) -> Prefetch | None:
        """带字的问题的一点背景（不给模型工具）：所在的节、同页前后各一块；问题里写了「第 N 页」就取那一页。
        书还没取到最多等 `BACKGROUND_WAIT_SECS` 秒，取不到就 None（照常回答）。"""
        if self._items is None:
            if not self._warming:
                threading.Thread(target=self.warm, daemon=True).start()
            if not self._ready.wait(BACKGROUND_WAIT_SECS) or self._items is None:
                return None
        anchor = _anchor_from_meta(meta) or _anchor_from_texts(texts, self.job_id)
        sections: list[str] = []
        info: dict[str, Any] = {"pages": [], "blocks": 0}
        index = self._index.get(str((anchor or {}).get("item_id") or ""))
        if index is not None:
            sections.append(self._around(index, info, neighbors=BACKGROUND_NEIGHBORS, block_chars=MAX_BACKGROUND_BLOCK_CHARS,
                                         include_anchor=False))
        for page in _mentioned_pages(texts, anchor):
            text, count = self._page_text(page, "both", MAX_BACKGROUND_PAGE_CHARS)
            if count:
                sections.append(f"第 {page} 页（问题里说到的）：\n{text}")
                info["pages"].append(page)
                info["blocks"] += count
        body = "\n\n".join(section for section in sections if section)
        if not body:
            return None
        return Prefetch(text=f"【RetainPDF 从书里取的背景（自动附上，页码是原文页码）】\n{body}\n【背景到此为止】", info=info)

    def overview(self) -> str:
        """系统提示词里的「这本书」：页数和两级以内的目录。取不到书就是空串。"""
        if self._overview is None:
            try:
                self._overview = self._build_overview()
            except Exception:  # noqa: BLE001 - 后端没开也照常回答，工具到时候报错
                return ""
        return self._overview

    def prefetch(self, texts: list[str], meta: Any = None) -> Prefetch | None:
        """每问之前按提问的位置取好上下文（代码取，不是模型调工具）。`texts` 是这一问的几段文字（前端的出处在前、问题在最后），
        `meta` 是 `session/prompt` 的 `_meta`。认不出位置、问题里也没写页码就是 None。"""
        anchor = _anchor_from_meta(meta) or _anchor_from_texts(texts, self.job_id)
        mentioned = _mentioned_pages(texts, anchor)
        if not anchor and not mentioned:
            return None
        try:
            self.items()
        except (ToolInputError, OSError, ValueError):
            return None
        sections: list[str] = []
        images: list[tuple[str, str]] = []
        info: dict[str, Any] = {"pages": [], "blocks": 0}
        empty_pages: list[int] = []
        if anchor:
            index = self._index.get(str(anchor.get("item_id") or ""))
            page = anchor.get("page")
            if index is not None:
                sections.append(self._around(index, info))
            elif isinstance(page, int) and page >= 1:
                text, count = self._page_text(page, "both", MAX_PREFETCH_PAGE_CHARS)
                sections.append(f"第 {page} 页（提问的那一页）：\n{text}" if count else "")
                info["pages"].append(page)
                info["blocks"] += count
                if not count:
                    empty_pages.append(page)
        for page in mentioned:
            text, count = self._page_text(page, "both", MAX_PREFETCH_PAGE_CHARS)
            info["pages"].append(page)
            info["blocks"] += count
            if count:
                sections.append(f"第 {page} 页（问题里说到的）：\n{text}")
            elif page <= self.page_count() or not self.page_count():
                empty_pages.append(page)
        for page in empty_pages[:1]:
            result = self.view_page(page, "source")
            if not result.is_error:
                images.extend(result.images)
                sections.append(f"第 {page} 页没有文字层（扫描页、整页图），附上这一页的原文图。")
                info["images"] = [page]
        body = "\n\n".join(section for section in sections if section)
        if not body:
            return None
        return Prefetch(text=f"【RetainPDF 从书里取的上下文（自动附上，页码是原文页码）】\n{body}\n【上下文到此为止】",
                        images=images, info=info)

    # 书的块 ----------------------------------------------------------------

    def items(self) -> list[dict[str, Any]]:
        with self._lock:
            if self._items is None:
                status, _, body = self.http_get(f"/api/v1/jobs/{self.job_id}/reader/regions", REGIONS_TIMEOUT_SECS)
                if status != 200:
                    raise ToolInputError(f"读不到这本书的内容（{_error_message(status, body)}）")
                payload = json.loads(body.decode("utf-8"))
                items = ((payload.get("data") or {}).get("items")) if isinstance(payload, dict) else None
                self._items = [item for item in items or [] if isinstance(item, dict)]
                self._index = {str(item.get("item_id")): index for index, item in enumerate(self._items)}
            return self._items

    def page_count(self) -> int:
        return max((_source_page(item) for item in self.items()), default=0)

    def _check_page(self, page: int) -> None:
        count = self.page_count()
        if count == 0:
            raise ToolInputError("这本书还没有识别出文字（没有可读的块），可以用 view_page 看图。")
        if page > count:
            raise ToolInputError(f"没有第 {page} 页：这本书有文字的页是 1–{count}。")

    def _heading_before(self, index: int) -> dict[str, Any] | None:
        items = self.items()
        for position in range(index, -1, -1):
            if _is_heading(items[position]):
                return items[position]
        return None

    def _around(self, index: int, info: dict[str, Any], *, neighbors: int = NEIGHBOR_BLOCKS,
                block_chars: int = MAX_NEIGHBOR_CHARS, include_anchor: bool = True) -> str:
        """提问的那一块和同页前后几块，加所在的节。`include_anchor=False`：那一块前端已经附了，只给前后。"""
        items = self.items()
        anchor = items[index]
        page = _source_page(anchor)
        same_page = [position for position, item in enumerate(items)
                     if _source_page(item) == page and item.get("sub_type") not in SKIP_SUB_TYPES]
        where = same_page.index(index) if index in same_page else 0
        window = same_page[max(0, where - neighbors): where + neighbors + 1] or [index]
        if not include_anchor:
            window = [position for position in window if position != index]
        heading = self._heading_before(index)
        title = _clip(_source_text(heading), 120) if heading else ""
        where_text = f"第 {page} 页{f'，所在的节：{title}（第 {_source_page(heading)} 页）' if heading else ''}"
        if not include_anchor:
            if not window:
                return f"{where_text}。" if heading else ""
            lines = [f"{where_text}。提问那一块的前后（同一页）："]
        else:
            lines = [f"{where_text}。▶ 是提问的那一块，前后是同一页的块："]
        seen: set[str] = set()
        for position in window:
            item = items[position]
            limit = MAX_ANCHOR_CHARS if position == index else block_chars
            lines.append("")
            lines.extend(_block_lines(item, "both", seen, limit, marker="▶ " if position == index else ""))
        info["pages"].append(page)
        info["blocks"] += len(window)
        info["item_id"] = anchor.get("item_id")
        return "\n".join(lines)

    def _page_text(self, page: int, side: str, budget: int) -> tuple[str, int]:
        blocks = [item for item in self.items() if _source_page(item) == page and item.get("sub_type") not in SKIP_SUB_TYPES]
        seen: set[str] = set()
        lines: list[str] = []
        for item in blocks:
            lines.append("")
            lines.extend(_block_lines(item, side, seen, MAX_ANCHOR_CHARS))
        text = "\n".join(lines).strip()
        if len(text) > budget:
            text = text[:budget] + "\n……（这一页后面截掉了）"
        return text, len(blocks)

    def _build_overview(self) -> str:
        items = self.items()
        count = self.page_count()
        if not items:
            return ""
        headings = [item for item in items if _is_heading(item) and _source_text(item)]
        if len(headings) > MAX_OVERVIEW_ENTRIES:
            headings = [item for item in headings if _level(item) <= 2]
        if len(headings) > MAX_OVERVIEW_ENTRIES:
            headings = [item for item in headings if _level(item) <= 1] or headings
        lines = [f"用户正在读的书共 {count} 页（页码是原文 PDF 的页码）。"]
        if headings:
            lines.append("目录（标题 ｜ 译文 —— 第几页）：")
            for item in headings:
                source = _clip(_source_text(item), 90)
                translated = _clip(_translated_text(item, set()), 60)
                lines.append(f"{'  ' * (min(_level(item), 3) - 1)}- {source}{f' ｜ {translated}' if translated and translated != source else ''}"
                             f" —— 第 {_source_page(item)} 页")
        text = "\n".join(lines)
        if len(text) > MAX_OVERVIEW_CHARS:
            text = text[:MAX_OVERVIEW_CHARS] + "\n……（目录太长，后面略）"
        return text

    # 工具 ----------------------------------------------------------------

    def read_pages(self, pages: list[int], side: str) -> ToolResult:
        if side not in ("both", "source", "translated"):
            raise ToolInputError("side 要是 both、source 或 translated")
        for page in pages:
            self._check_page(page)
        budget = min(MAX_PAGE_CHARS, MAX_READ_CHARS // len(pages))
        parts: list[str] = []
        counts: list[str] = []
        for page in pages:
            text, count = self._page_text(page, side, budget)
            parts.append(f"=== 第 {page} 页（{count} 块）===\n{text or '没有文字块（可能是整页图片或空白页），要看可以用 view_page。'}")
            counts.append(f"第 {page} 页 {count} 块")
        return ToolResult(text="\n\n".join(parts), summary="，".join(counts))

    def search_book(self, query: str, limit: Any = None) -> ToolResult:
        terms = [term.casefold() for term in query.split() if term.strip()]
        if not terms:
            raise ToolInputError("query 不能是空的")
        try:
            limit = max(1, min(MAX_SEARCH_LIMIT, int(limit))) if limit is not None else DEFAULT_SEARCH_LIMIT
        except (TypeError, ValueError):
            limit = DEFAULT_SEARCH_LIMIT
        hits = []
        for index, item in enumerate(self.items()):
            if item.get("sub_type") in SKIP_SUB_TYPES:
                continue
            source = _source_text(item)
            own = _translated_text(item, set())
            # 跨块的段落也按整段的译文找（词可能落在同段的别的块里）
            whole = str((item.get("translated") or {}).get("text") or "").strip()
            translated = own if all(term in own.casefold() for term in terms) or not whole else whole
            if all(term in f"{source}\n{own}\n{whole}".casefold() for term in terms):
                hits.append((index, item, source, translated))
        if not hits:
            return ToolResult(text=f"没找到「{query}」。可以换原文或译文的说法再找一次，或者照目录读那几页。",
                              summary=f"「{_clip(query, 40)}」没找到")
        pages = sorted({_source_page(item) for _, item, _, _ in hits})
        lines = [f"「{query}」找到 {len(hits)} 处（{len(pages)} 页）{f'，列前 {limit} 处' if len(hits) > limit else ''}："]
        size = len(lines[0])
        shown = 0
        for index, item, source, translated in hits[:limit]:
            heading = self._heading_before(index)
            section = f"，{_clip(_source_text(heading), 80)}" if heading and heading is not item else ""
            entry = [f"\n第 {_source_page(item)} 页{section} [{item.get('item_id')}] {_kind(item)}"]
            if source:
                entry.append(f"原文：{_window(source, terms, HIT_SOURCE_CHARS)}")
            if translated:
                entry.append(f"译文：{_window(translated, terms, HIT_TRANSLATED_CHARS)}")
            block = "\n".join(entry)
            if size + len(block) > MAX_SEARCH_CHARS and shown:
                break
            lines.append(block)
            size += len(block)
            shown += 1
        if len(hits) > shown:
            lines.append(f"\n全部命中的页：{', '.join(str(page) for page in pages[:80])}{' ……' if len(pages) > 80 else ''}")
        return ToolResult(text="\n".join(lines), summary=f"「{_clip(query, 40)}」{len(hits)} 处，{len(pages)} 页")

    def view_page(self, page: int, side: str) -> ToolResult:
        if side not in ("source", "translated"):
            raise ToolInputError("side 要是 source（原文页）或 translated（译文页）")
        label = f"第 {page} 页{'译文' if side == 'translated' else '原文'}"
        if side == "source" and self.document_id:
            path = f"/api/v1/documents/{self.document_id}/files/pages/{page}.jpg?width={PAGE_IMAGE_WIDTH}"
        else:
            # 译文页按任务自己的页号取（只翻了部分页的任务和原文页码不一样）。不知道书编号时原文页取不到，给译文页
            if side == "source":
                label = f"第 {page} 页译文（这本书的原文页图取不到）"
            path = f"/api/v1/jobs/{self.job_id}/files/pages/{self._translated_page(page)}.jpg?width={PAGE_IMAGE_WIDTH}"
        status, content_type, body = self.http_get(path, IMAGE_TIMEOUT_SECS)
        if status != 200:
            hint = "（这一页还没排好，或这个任务没有译文 PDF）" if b"not_ready" in body else ""
            return tool_error(f"取不到{label}的图：{_error_message(status, body)}{hint}")
        mime = content_type.split(";")[0].strip().lower() or "image/jpeg"
        if not mime.startswith("image/"):
            return tool_error(f"取不到{label}的图：后端回的不是图片（{mime}）")
        if len(body) > MAX_IMAGE_BYTES:
            return tool_error(f"{label}的图太大（{len(body) // 1024} KB），没有给你看；用 read_pages 读文字。")
        return ToolResult(text=f"{label}的图（宽 {PAGE_IMAGE_WIDTH} 像素）。", images=[(mime, base64.b64encode(body).decode("ascii"))],
                          summary=f"{label}的图，{len(body) // 1024} KB")

    def _translated_page(self, page: int) -> int:
        try:
            items = self.items()
        except (ToolInputError, OSError, ValueError):
            return page
        for item in items:
            if _source_page(item) == page:
                translated_page = (item.get("translated") or {}).get("page")
                if isinstance(translated_page, int) and translated_page >= 1:
                    return translated_page
        return page


class ToolInputError(ValueError):
    """参数不对、书里没有：回给模型的话。"""


def _page(value: Any) -> int:
    if isinstance(value, str) and value.strip().isdigit():
        value = int(value.strip())
    if not isinstance(value, int) or isinstance(value, bool) or value < 1:
        raise ToolInputError("页码要是从 1 开始的整数")
    return value


def _pages(arguments: dict[str, Any]) -> list[int]:
    raw = arguments.get("pages")
    if raw is None and "page" in arguments:
        raw = [arguments["page"]]
    if isinstance(raw, (int, str)):
        raw = [raw]
    if not isinstance(raw, list) or not raw:
        raise ToolInputError("pages 要是页码列表，比如 [5] 或 [5, 6]")
    pages: list[int] = []
    for value in raw:
        page = _page(value)
        if page not in pages:
            pages.append(page)
    if len(pages) > MAX_READ_PAGES:
        raise ToolInputError(f"一次最多读 {MAX_READ_PAGES} 页")
    return pages


def _mentioned_pages(texts: list[str], anchor: dict[str, Any] | None) -> list[int]:
    """问题（最后一段字，去掉前端的出处行）里写的「第 N 页」，不算提问的那一页，最多两页。"""
    question = ANCHOR_MARKER_RE.sub("", texts[-1] if texts else "")
    pages: list[int] = []
    for match in PAGE_MENTION_RE.finditer(question):
        page = int(next(group for group in match.groups() if group))
        if page >= 1 and page not in pages and page != (anchor or {}).get("page"):
            pages.append(page)
    return pages[:MAX_MENTIONED_PAGES]


def _anchor_from_meta(meta: Any) -> dict[str, Any] | None:
    """`session/prompt` 的 `_meta.retainpdf.anchor`（和问答记录的锚点同一个写法：`page`、`item_id`）。"""
    anchor = ((meta or {}).get("retainpdf") or {}).get("anchor") if isinstance(meta, dict) else None
    if not isinstance(anchor, dict):
        return None
    page = anchor.get("page")
    item_id = anchor.get("item_id") or anchor.get("itemId")
    if not isinstance(page, int) or isinstance(page, bool) or page < 1:
        return None
    return {"page": page, "item_id": item_id if isinstance(item_id, str) and ID_RE.match(item_id) else None}


def _anchor_from_texts(texts: list[str], job_id: str) -> dict[str, Any] | None:
    for text in texts:
        match = ANCHOR_MARKER_RE.search(text or "")
        if match:
            # 别的书的出处（换了书还在同一个会话里）：块号不认，页码照用
            same_book = match.group(1) == job_id
            return {"page": int(match.group(3)), "item_id": match.group(2) if same_book else None}
    return None


def _source_page(item: dict[str, Any]) -> int:
    page = (item.get("source") or {}).get("page")
    return page if isinstance(page, int) else 0


def _source_text(item: dict[str, Any] | None) -> str:
    return str(((item or {}).get("source") or {}).get("text") or "").strip()


def _is_heading(item: dict[str, Any]) -> bool:
    return item.get("sub_type") in HEADING_SUB_TYPES or isinstance(item.get("heading_level"), int)


def _level(item: dict[str, Any]) -> int:
    level = item.get("heading_level")
    if isinstance(level, int) and level >= 1:
        return min(level, 6)
    return 1 if item.get("sub_type") == "title" else 2


def _kind(item: dict[str, Any]) -> str:
    sub_type = str(item.get("sub_type") or "")
    region = str(item.get("region_type") or "")
    if sub_type in HEADING_SUB_TYPES:
        return f"标题（{_level(item)} 级）"
    names = {"formula": "公式", "display_formula": "公式", "table": "表格", "table_html": "表格", "image": "图", "image_body": "图",
             "figure": "图", "caption": "图注", "figure_caption": "图注", "table_caption": "表注", "footnote": "脚注", "list": "列表",
             "reference_entry": "参考文献", "code_block": "代码", "metadata": "书目信息"}
    return names.get(sub_type) or names.get(region) or "正文"


def _block_lines(item: dict[str, Any], side: str, seen_groups: set[str], limit: int, marker: str = "") -> list[str]:
    lines = [f"{marker}[{item.get('item_id')}] {_kind(item)}"]
    if side in ("both", "source"):
        lines.append(f"原文：{_clip(_source_text(item), limit) or '（无文字）'}")
    if side in ("both", "translated"):
        lines.append(f"译文：{_clip(_translated_text(item, seen_groups), limit) or '（没有译文）'}")
    return lines


def _translated_text(item: dict[str, Any], seen_groups: set[str]) -> str:
    """一块的译文。跨块的段落（`continuation_group_id`）`translated.text` 是整段的，有本块那份就用本块的；
    没有就整段只在第一块给一次。"""
    own = item.get("translated_block_text")
    if isinstance(own, str) and own.strip():
        return own.strip()
    text = str((item.get("translated") or {}).get("text") or "").strip()
    group = item.get("continuation_group_id")
    if text and isinstance(group, str) and group:
        if group in seen_groups:
            return "（和上一块是同一段，译文见上）"
        seen_groups.add(group)
    return text


def _window(text: str, terms: list[str], size: int) -> str:
    """整块不长就给整块；长的取命中处前后共 `size` 字。"""
    flat = " ".join(text.split())
    if len(flat) <= size:
        return flat
    lowered = flat.casefold()
    at = min((lowered.find(term) for term in terms if lowered.find(term) >= 0), default=0)
    start = max(0, min(at - size // 3, len(flat) - size))
    end = min(len(flat), start + size)
    return f"{'…' if start else ''}{flat[start:end]}{'…' if end < len(flat) else ''}"


def make_book_tools(*, job_id: str, document_id: str, base_url: str, api_key: str) -> BookTools | None:
    """按桥给的环境变量建工具；缺书或缺后端地址就不给工具（和以前一样只靠前端放进 prompt 的上下文）。"""
    if not job_id or not base_url or not ID_RE.match(job_id):
        return None
    parsed = urllib.parse.urlparse(base_url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        return None
    return BookTools(job_id=job_id, document_id=document_id, http_get=default_http_get(base_url, api_key))


__all__ = ["TOOL_SPECS", "BookTools", "Prefetch", "ToolResult", "make_book_tools", "tool_error", "tool_title"]
