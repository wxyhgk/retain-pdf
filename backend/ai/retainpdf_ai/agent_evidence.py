"""Citation indexing and safe model-visible tool result projection."""

from __future__ import annotations

import re
from typing import Any

from .runtimes.contracts import Citation

CITATION_RE = re.compile(r"\[(\d+)\]")
BLOCK_ID_BRACKET_RE = re.compile(r"\[\s*(p\d+[-_]b\d+)\s*\]", re.IGNORECASE)
BLOCK_ID_BARE_RE = re.compile(r"(?<![\w/])(p\d+[-_]b\d+)(?![\w/])", re.IGNORECASE)
MARKDOWN_ID_BRACKET_RE = re.compile(r"\[\s*(md-\d+)\s*\]", re.IGNORECASE)
MARKDOWN_ID_BARE_RE = re.compile(r"(?<![\w/])(md-\d+)(?![\w/])", re.IGNORECASE)


def _citation_image_urls(entry: dict[str, Any]) -> list[str]:
    candidates: list[Any] = [entry.get("image_url")]
    for key in ("image_urls", "asset_image_urls"):
        values = entry.get(key)
        if isinstance(values, list):
            candidates.extend(values)
    assets = entry.get("assets")
    if isinstance(assets, list):
        candidates.extend(
            asset.get("image_url")
            for asset in assets
            if isinstance(asset, dict)
        )

    urls: list[str] = []
    seen: set[str] = set()
    for candidate in candidates:
        url = str(candidate or "").strip()
        if (
            not url
            or url in seen
            or not url.startswith("/api/v1/jobs/")
            or "/markdown/images/" not in url
        ):
            continue
        seen.add(url)
        urls.append(url)
    return urls[:8]


def assign_refs(
    result: dict[str, Any],
    citations: dict[int, Citation],
    next_ref: int,
) -> int:
    """Assign public reference numbers to anchored tool results."""
    anchored: list[dict[str, Any]] = []
    anchored.extend(result.get("hits") or [])
    anchored.extend(result.get("favorites") or [])
    blocks = result.get("blocks")
    if isinstance(blocks, list):
        rewritten_blocks: list[dict[str, Any]] = []
        for block in blocks:
            if not isinstance(block, dict):
                continue
            item = dict(block)
            item.setdefault("document_id", result.get("document_id"))
            item.setdefault("job_id", result.get("job_id"))
            item.setdefault("page_idx", result.get("page_idx"))
            rewritten_blocks.append(item)
            anchored.append(item)
        result["blocks"] = rewritten_blocks
    for entry in anchored:
        if not isinstance(entry, dict):
            continue
        document_id = str(entry.get("document_id") or "")
        block_id = str(entry.get("block_id") or "")
        if not document_id or not block_id:
            continue
        entry["ref"] = next_ref
        snippet = str(
            entry.get("translated_snippet")
            or entry.get("translated_text")
            or entry.get("translated_quote_text")
            or entry.get("source_snippet")
            or entry.get("source_text")
            or entry.get("quote_text")
            or ""
        )
        raw_page_idx = entry.get("page_idx")
        try:
            page_idx = int(raw_page_idx) if raw_page_idx is not None else None
        except (TypeError, ValueError):
            page_idx = None
        citations[next_ref] = Citation(
            ref=next_ref,
            document_id=document_id,
            job_id=str(entry.get("job_id") or ""),
            page_idx=page_idx,
            block_id=block_id,
            snippet=snippet[:200],
            image_urls=_citation_image_urls(entry),
        )
        next_ref += 1
    return next_ref


def _public_anchor(entry: dict[str, Any]) -> dict[str, Any] | None:
    """Strip internal IDs while retaining public page and asset anchors."""
    ref = entry.get("ref")
    if ref is None:
        return None
    raw_page_idx = entry.get("page_idx")
    try:
        page_idx = int(raw_page_idx) if raw_page_idx is not None else None
    except (TypeError, ValueError):
        page_idx = None
    snippet = str(
        entry.get("translated_snippet")
        or entry.get("translated_text")
        or entry.get("translated_quote_text")
        or entry.get("source_snippet")
        or entry.get("source_text")
        or entry.get("quote_text")
        or entry.get("snippet")
        or ""
    )[:280]
    public = {"ref": int(ref), "snippet": snippet}
    for key in ("source_snippet", "translated_snippet"):
        value = str(entry.get(key) or "").strip()
        if value:
            public[key] = value[:280]
    if page_idx is not None and page_idx >= 0:
        public["page"] = page_idx + 1
    for key in ("chunk_id", "heading", "source"):
        value = str(entry.get(key) or "").strip()
        if value:
            public[key] = value
    for key in ("char_start", "char_end"):
        value = entry.get(key)
        if isinstance(value, int):
            public[key] = value
    bbox = entry.get("bbox")
    if isinstance(bbox, list) and len(bbox) == 4:
        public["bbox"] = bbox
        public["bbox_unit"] = str(entry.get("bbox_unit") or "pdf_point")
        public["bbox_origin"] = str(entry.get("bbox_origin") or "top_left")
    block_type = str(entry.get("block_type") or "").strip()
    if block_type:
        public["block_type"] = block_type
    asset_id = str(entry.get("asset_id") or "").strip()
    if asset_id:
        public["asset_id"] = asset_id
    asset_ids = entry.get("asset_ids")
    if isinstance(asset_ids, list):
        public["asset_ids"] = [str(value) for value in asset_ids if str(value).strip()]
    image_url = str(entry.get("image_url") or "").strip()
    if image_url:
        public["image_url"] = image_url
    asset_image_urls = entry.get("asset_image_urls")
    if isinstance(asset_image_urls, list):
        public["asset_image_urls"] = [
            str(value) for value in asset_image_urls if str(value).strip()
        ]
    assets = entry.get("assets")
    if isinstance(assets, list):
        public_assets: list[dict[str, str]] = []
        for asset in assets[:8]:
            if not isinstance(asset, dict):
                continue
            url = str(asset.get("image_url") or "").strip()
            if not url.startswith("/api/v1/jobs/") or "/markdown/images/" not in url:
                continue
            public_assets.append(
                {"image_url": url, "alt": str(asset.get("alt") or "").strip()}
            )
        if public_assets:
            public["assets"] = public_assets
    return public


def public_tool_payload(result: dict[str, Any]) -> dict[str, Any]:
    """Project a raw tool result into the model-visible data contract."""
    if not isinstance(result, dict):
        return {"error": "invalid tool result"}
    if result.get("error"):
        return {"error": str(result.get("error"))}

    public: dict[str, Any] = {}
    if isinstance(result.get("structured_data_available"), bool):
        public["structured_data_available"] = result["structured_data_available"]
    if result.get("hint"):
        public["hint"] = str(result.get("hint"))
    if result.get("document_id"):
        public["scoped"] = True

    hits = result.get("hits")
    if isinstance(hits, list):
        public_hits = []
        for hit in hits:
            if isinstance(hit, dict):
                item = _public_anchor(hit)
                if item:
                    public_hits.append(item)
        if public_hits:
            public["hits"] = public_hits
            public["how_to_cite"] = "回答时只用 hits[].ref 写成 [1] [2]。"

    favorites = result.get("favorites")
    if isinstance(favorites, list):
        public_favs = []
        for favorite in favorites:
            if isinstance(favorite, dict):
                item = _public_anchor(favorite)
                if item:
                    public_favs.append(item)
        if public_favs:
            public["favorites"] = public_favs

    blocks = result.get("blocks")
    if isinstance(blocks, list):
        public_blocks = []
        for block in blocks:
            if isinstance(block, dict):
                item = _public_anchor(block)
                if item:
                    item["source_text"] = str(block.get("source_text") or "")
                    item["translated_text"] = str(block.get("translated_text") or "")
                    item["char_start"] = int(block.get("char_start") or 0)
                    item["source_text_length"] = int(
                        block.get("source_text_length") or 0
                    )
                    item["translated_text_length"] = int(
                        block.get("translated_text_length") or 0
                    )
                    item["source_has_more"] = bool(block.get("source_has_more"))
                    item["translated_has_more"] = bool(block.get("translated_has_more"))
                    public_blocks.append(item)
        if public_blocks:
            public["blocks"] = public_blocks
            public["how_to_cite"] = "回答时用 blocks[].ref 写成 [n]。"

    images = result.get("image_urls")
    if isinstance(images, list) and images:
        public["image_urls"] = [str(url) for url in images[:8]]

    if isinstance(hits, list):
        image_urls: list[str] = []
        for hit in hits:
            if not isinstance(hit, dict):
                continue
            for url in hit.get("image_urls") or []:
                image_urls.append(str(url))
                if len(image_urls) >= 8:
                    break
            if len(image_urls) >= 8:
                break
        if image_urls:
            public["image_urls"] = image_urls

    if not public:
        public["ok"] = True
    return public


def sanitize_answer_text(answer: str, citations: dict[int, Citation]) -> str:
    """Map internal block identifiers to public citations or remove them."""
    if not answer:
        return answer
    by_block = {
        citation.block_id.lower().replace("_", "-"): citation.ref
        for citation in citations.values()
        if citation.block_id
    }

    def replace_identifier(match: re.Match[str]) -> str:
        key = match.group(1).lower().replace("_", "-")
        ref = by_block.get(key)
        return f"[{ref}]" if ref is not None else ""

    cleaned = BLOCK_ID_BRACKET_RE.sub(replace_identifier, answer)
    cleaned = BLOCK_ID_BARE_RE.sub(replace_identifier, cleaned)
    cleaned = MARKDOWN_ID_BRACKET_RE.sub(replace_identifier, cleaned)
    cleaned = MARKDOWN_ID_BARE_RE.sub(replace_identifier, cleaned)
    cleaned = re.sub(r"[ \t]{2,}", " ", cleaned)
    cleaned = re.sub(r" *\n", "\n", cleaned)
    return cleaned.strip()


def referenced_citations(
    answer: str,
    citations: dict[int, Citation],
) -> list[Citation]:
    """Return referenced citations in reading order, with a page fallback."""
    ordered_refs: list[int] = []
    seen: set[int] = set()
    for match in CITATION_RE.findall(answer):
        ref = int(match)
        if ref in seen or ref not in citations:
            continue
        seen.add(ref)
        ordered_refs.append(ref)
    selected = [citations[ref] for ref in ordered_refs]
    if not selected and citations:
        picked: list[Citation] = []
        anchors: set[tuple[str, int | str]] = set()
        for ref in sorted(citations):
            item = citations[ref]
            anchor: tuple[str, int | str]
            if item.page_idx is None:
                anchor = ("block", item.block_id)
            else:
                anchor = ("page", item.page_idx)
            if anchor in anchors:
                continue
            anchors.add(anchor)
            picked.append(item)
            if len(picked) >= 3:
                break
        return picked
    return selected


# Compatibility aliases for code that used the former private names.
_assign_refs = assign_refs
_public_tool_payload = public_tool_payload
_referenced_citations = referenced_citations
_sanitize_answer_text = sanitize_answer_text
