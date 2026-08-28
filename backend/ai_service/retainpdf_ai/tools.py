"""Danh bạ tool: hình dạng chuẩn gồm name + JSON Schema + handler.

Quy ước đồng cấu với các framework agent phổ biến — sau này nếu chuyển sang một SDK nào đó
thì bưng nguyên phần định nghĩa tool, chỉ thay lớp vỏ vòng lặp. Mỗi tool trả về dict
serialize được sang JSON; kết quả truy xuất luôn kèm neo
(document_id, job_id, page_idx, block_id), và tầng agent đánh số thành ref để trích dẫn.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable
from urllib.parse import quote

from .blocks import read_page_blocks
from .config import Settings
from .rust_client import RustApiClient

# Danh sách trắng cho job_id: bắt đầu bằng chữ/số + [-._], cấm dấu phân cách đường dẫn và "..".
# Đây là ranh giới an toàn quan trọng — job_id đến từ tham số tool do model sinh (ngữ cảnh
# chứa nội dung tài liệu = bề mặt prompt injection), nên trước khi ghép thẳng vào
# data_root/jobs/<job_id> bắt buộc phải qua cổng này, nếu không sẽ bị duyệt thư mục.
_SAFE_JOB_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")


def _safe_job_root(settings: Settings, job_id: str) -> Path | None:
    """Trả về thư mục dưới gốc jobs nếu job_id hợp lệ, ngược lại trả None (bên gọi coi như tác vụ không tồn tại)."""
    if not _SAFE_JOB_ID_RE.fullmatch(job_id) or ".." in job_id:
        return None
    return settings.data_root / "jobs" / job_id


def _list_markdown_image_urls(job_root: Path, job_id: str, page_idx: int, *, limit: int = 8) -> list[str]:
    """Liệt kê ảnh Markdown OCR của trang, trả về đường dẫn API tương đối có thể tải kèm xác thực.

    Đĩa: jobs/<job>/md/images/page-<1-based>/...
    API:  /api/v1/jobs/<job>/markdown/images/<rel-without-images-prefix>
    """
    page_dir = job_root / "md" / "images" / f"page-{int(page_idx) + 1}"
    if not page_dir.is_dir():
        return []
    urls: list[str] = []
    for path in sorted(page_dir.rglob("*")):
        if not path.is_file():
            continue
        if path.suffix.lower() not in {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp"}:
            continue
        try:
            rel = path.relative_to(job_root / "md" / "images").as_posix()
        except ValueError:
            continue
        encoded = "/".join(quote(part, safe="") for part in rel.split("/"))
        urls.append(f"/api/v1/jobs/{job_id}/markdown/images/{encoded}")
        if len(urls) >= limit:
            break
    return urls


@dataclass(frozen=True)
class Tool:
    name: str
    description: str
    parameters: dict[str, Any]
    handler: Callable[[dict[str, Any]], dict[str, Any]]

    def as_openai_tool(self) -> dict[str, Any]:
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters,
            },
        }


class ToolRegistry:
    def __init__(self, tools: list[Tool]) -> None:
        self._tools = {tool.name: tool for tool in tools}

    def specs(self) -> list[dict[str, Any]]:
        return [tool.as_openai_tool() for tool in self._tools.values()]

    def invoke(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        tool = self._tools.get(name)
        if tool is None:
            return {"error": f"unknown tool: {name}"}
        try:
            return tool.handler(arguments)
        except Exception as exc:  # Lỗi của tool được trả lại cho model như một kết quả, không ngắt vòng lặp
            return {"error": f"{type(exc).__name__}: {exc}"}


def build_default_registry(settings: Settings, rust: RustApiClient) -> ToolRegistry:
    def search_fulltext(arguments: dict[str, Any]) -> dict[str, Any]:
        query = str(arguments.get("query") or "").strip()
        if not query:
            return {"error": "query must not be empty"}
        limit = int(arguments.get("limit") or 10)
        document_id = str(arguments.get("document_id") or "").strip()
        hits = rust.search_fulltext(
            query,
            limit=max(1, min(limit, 30)),
            document_id=document_id,
        )
        # Gắn đường dẫn ảnh Markdown vào trang trúng để model chèn ảnh bằng ![alt](url) trong câu trả lời
        enriched_hits: list[dict[str, Any]] = []
        for hit in hits:
            if not isinstance(hit, dict):
                continue
            item = dict(hit)
            hit_job_id = str(item.get("job_id") or "").strip()
            try:
                hit_page = int(item.get("page_idx") or 0)
            except (TypeError, ValueError):
                hit_page = 0
            if hit_job_id:
                job_root = _safe_job_root(settings, hit_job_id)
                if job_root is not None:
                    images = _list_markdown_image_urls(job_root, hit_job_id, hit_page, limit=4)
                    if images:
                        item["image_urls"] = images
            enriched_hits.append(item)
        payload: dict[str, Any] = {"hits": enriched_hits}
        if document_id:
            payload["document_id"] = document_id
        if document_id and not enriched_hits:
            payload["hint"] = (
                "No hit in the full-text index of this document: blocks_fts may not have been built yet, "
                "or the keyword appears neither in the source nor in the translation. Try other keywords, or state that there is no evidence for now."
            )
        return payload

    def list_documents(arguments: dict[str, Any]) -> dict[str, Any]:
        # Phiên hỏi đáp toàn cuốn sẽ chèn document_id: chỉ trả về tài liệu hiện tại, tránh nhiễu từ cả thư viện
        scoped_id = str(arguments.get("document_id") or "").strip()
        if scoped_id:
            try:
                document = rust.get_document(scoped_id)
            except Exception as exc:
                return {"error": f"{type(exc).__name__}: {exc}", "documents": []}
            return {
                "documents": [
                    {
                        "document_id": document.get("document_id"),
                        "title": document.get("title"),
                        "page_count": document.get("page_count"),
                        "tags": document.get("tags"),
                        "reading_status": document.get("reading_status"),
                    }
                ]
            }
        documents = rust.list_documents(
            tag=str(arguments.get("tag") or ""),
            reading_status=str(arguments.get("reading_status") or ""),
            limit=int(arguments.get("limit") or 50),
        )
        # Chỉ trả các trường model cần, không đổ nguyên bản ghi vào ngữ cảnh
        return {
            "documents": [
                {
                    "document_id": document.get("document_id"),
                    "title": document.get("title"),
                    "page_count": document.get("page_count"),
                    "tags": document.get("tags"),
                    "reading_status": document.get("reading_status"),
                }
                for document in documents
            ]
        }

    def read_blocks(arguments: dict[str, Any]) -> dict[str, Any]:
        document_id = str(arguments.get("document_id") or "").strip()
        page_idx = arguments.get("page_idx")
        if not document_id or page_idx is None:
            return {"error": "document_id and page_idx are required"}
        # Ưu tiên job_id trong request (tác vụ đang đọc, kể cả run cũ), sau đó mới quay về active_job_id
        job_id = str(arguments.get("job_id") or "").strip()
        if not job_id:
            document = rust.get_document(document_id)
            job_id = str(document.get("active_job_id") or "")
        if not job_id:
            return {"error": f"document {document_id} has no active job"}
        job_root = _safe_job_root(settings, job_id)
        if job_root is None:
            return {"error": f"invalid job_id: {job_id!r}"}
        page_i = int(page_idx)
        blocks = read_page_blocks(
            job_root,
            page_i,
            around_block_id=str(arguments.get("around_block_id") or ""),
            max_blocks=int(arguments.get("max_blocks") or 12),
        )
        image_urls = _list_markdown_image_urls(job_root, job_id, page_i, limit=8)
        return {
            "document_id": document_id,
            "job_id": job_id,
            "page_idx": page_i,
            "blocks": [
                {
                    "block_id": block.block_id,
                    "source_text": block.source_text[:600],
                    "translated_text": block.translated_text[:600],
                }
                for block in blocks
            ],
            "image_urls": image_urls,
        }

    def search_favorites(arguments: dict[str, Any]) -> dict[str, Any]:
        keyword = str(arguments.get("keyword") or "").strip().lower()
        favorites = rust.list_favorites(str(arguments.get("document_id") or ""))
        if keyword:
            favorites = [
                favorite
                for favorite in favorites
                if keyword in str(favorite.get("quote_text", "")).lower()
                or keyword in str(favorite.get("translated_quote_text", "")).lower()
                or keyword in str(favorite.get("note", "")).lower()
            ]
        return {
            "favorites": [
                {
                    "favorite_id": favorite.get("favorite_id"),
                    "document_id": favorite.get("document_id"),
                    "job_id": favorite.get("job_id"),
                    "page_idx": favorite.get("page_idx"),
                    "block_id": favorite.get("block_id"),
                    "kind": favorite.get("kind"),
                    "quote_text": favorite.get("quote_text"),
                    "translated_quote_text": favorite.get("translated_quote_text"),
                    "note": favorite.get("note"),
                }
                for favorite in favorites[:30]
            ]
        }

    return ToolRegistry(
        [
            Tool(
                name="list_documents",
                description="List the documents in the library (title, tags, reading status). Use it first to confirm the scope when the question mentions 'which document / in my library'.",
                parameters={
                    "type": "object",
                    "properties": {
                        "tag": {"type": "string", "description": "Filter by tag, optional"},
                        "reading_status": {
                            "type": "string",
                            "enum": ["unread", "reading", "done"],
                            "description": "Filter by reading status, optional",
                        },
                        "limit": {"type": "integer", "minimum": 1, "maximum": 200},
                    },
                },
                handler=list_documents,
            ),
            Tool(
                name="search_fulltext",
                description=(
                    "Full-text search (both Chinese and English), returning matching snippets anchored with (document_id, job_id, page_idx, block_id); "
                    "if the matching page has OCR figures, image_urls is attached (Markdown image paths that can be embedded in the answer). "
                    "This is the main tool for finding evidence and may be called several times with different keywords. "
                    "If the session is restricted to one document, always pass document_id and search only inside that document."
                ),
                parameters={
                    "type": "object",
                    "properties": {
                        "query": {"type": "string", "description": "Search keyword or phrase"},
                        "document_id": {
                            "type": "string",
                            "description": "Restrict to a single document; required in whole-document Q&A, pass the current document_id",
                        },
                        "limit": {"type": "integer", "minimum": 1, "maximum": 30},
                    },
                    "required": ["query"],
                },
                handler=search_fulltext,
            ),
            Tool(
                name="read_blocks",
                description=(
                    "Read the source and translated blocks of a given page of a document, together with the Markdown image_urls of that page. "
                    "Use it to see the full context around a search hit (pass around_block_id to take a window centred on the matching block); "
                    "when answering questions about figures or tables, embed the Markdown images from image_urls."
                ),
                parameters={
                    "type": "object",
                    "properties": {
                        "document_id": {"type": "string"},
                        "page_idx": {"type": "integer", "minimum": 0},
                        "job_id": {
                            "type": "string",
                            "description": "Prefer reading the artifacts of this job; defaults to the document's active_job_id",
                        },
                        "around_block_id": {"type": "string", "description": "Take the context centred on this block, optional"},
                        "max_blocks": {"type": "integer", "minimum": 1, "maximum": 30},
                    },
                    "required": ["document_id", "page_idx"],
                },
                handler=read_blocks,
            ),
            Tool(
                name="search_favorites",
                description="Search the sentences/data the user has bookmarked (can be filtered by keyword and document). Use it when the question refers to 'what I bookmarked / what I marked'.",
                parameters={
                    "type": "object",
                    "properties": {
                        "keyword": {"type": "string", "description": "Keyword filter over the quote and the note, optional"},
                        "document_id": {"type": "string", "description": "Restrict to one document, optional"},
                    },
                },
                handler=search_favorites,
            ),
        ]
    )
