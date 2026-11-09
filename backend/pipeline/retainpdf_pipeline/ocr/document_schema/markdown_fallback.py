from __future__ import annotations

import json
import re
import shutil
from pathlib import Path, PurePosixPath

from retainpdf_pipeline.ocr.document_schema.consumer_reader import (
    block_asset_ids,
    block_kind,
    block_layout_role,
    block_reading_order,
    block_structure_role,
    block_sub_type,
    block_text,
    ensure_normalized_document,
    get_pages,
)

_EXTERNAL_URI_PREFIXES = ("http://", "https://", "data:")
_HTML_ALT_RE = re.compile(r"""\balt\s*=\s*["']([^"']*)["']""", re.IGNORECASE)


def render_document_markdown(
    document: dict,
    *,
    asset_uris: dict[str, str] | None = None,
) -> str:
    """Render canonical document.v1 blocks in page and reading order."""

    ensure_normalized_document(document)
    resolved_asset_uris = asset_uris or _canonical_markdown_asset_uris(document)
    rendered_pages: list[str] = []

    indexed_pages = list(enumerate(get_pages(document)))
    for _, page in sorted(indexed_pages, key=_page_sort_key):
        blocks = page.get("blocks", []) or []
        indexed_blocks = list(enumerate(blocks))
        rendered_blocks: list[str] = []
        for _, block in sorted(indexed_blocks, key=_block_sort_key):
            rendered = _render_block(block, document, resolved_asset_uris)
            if rendered:
                rendered_blocks.append(rendered)
        if rendered_blocks:
            rendered_pages.append("\n\n".join(rendered_blocks))

    rendered = "\n\n".join(rendered_pages).strip()
    return f"{rendered}\n" if rendered else ""


def materialize_document_markdown_fallback(
    *,
    normalized_json_path: Path,
    job_root: Path,
) -> Path | None:
    """Create md/full.md from document.v1 only when a provider did not create it."""

    full_md_path = job_root / "md" / "full.md"
    if full_md_path.exists():
        return full_md_path

    with normalized_json_path.open("r", encoding="utf-8") as handle:
        document = json.load(handle)
    ensure_normalized_document(document)

    asset_uris = _materialize_markdown_assets(document=document, job_root=job_root)
    markdown = render_document_markdown(document, asset_uris=asset_uris)
    if not markdown:
        return None

    full_md_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with full_md_path.open("x", encoding="utf-8") as handle:
            handle.write(markdown)
    except FileExistsError:
        # A provider artifact remains authoritative even if it appeared after
        # the initial existence check.
        pass
    return full_md_path


def _page_sort_key(indexed_page: tuple[int, dict]) -> tuple[int, int]:
    index, page = indexed_page
    page_index = page.get("page_index")
    if isinstance(page_index, int) and not isinstance(page_index, bool):
        return page_index, index
    page_number = page.get("page")
    if isinstance(page_number, int) and not isinstance(page_number, bool):
        return max(0, page_number - 1), index
    return index, index


def _block_sort_key(indexed_block: tuple[int, dict]) -> tuple[int, int, int]:
    index, block = indexed_block
    order = block.get("order")
    stable_order = order if isinstance(order, int) and not isinstance(order, bool) else index
    return block_reading_order(block), stable_order, index


def _render_block(block: dict, document: dict, asset_uris: dict[str, str]) -> str:
    kind = block_kind(block)
    text = block_text(block).strip()
    layout_role = block_layout_role(block)
    structure_role = block_structure_role(block)
    sub_type = block_sub_type(block, document).strip().lower()

    if kind == "image" or sub_type in {"image", "figure", "chart"}:
        links = _render_image_links(block, document, asset_uris)
        return "\n\n".join(links) if links else text

    if kind == "formula" or "formula" in sub_type:
        return _render_formula(text)

    if kind == "table" or sub_type in {"table", "table_html"}:
        content = block.get("content", {}) or {}
        return str(content.get("table_html", "") or text).strip()

    if not text:
        return ""
    if (
        layout_role == "title"
        or structure_role in {"document_title", "title"}
        or sub_type in {"title", "doc_title"}
    ):
        return f"# {text}"
    if layout_role == "heading" or structure_role == "heading" or sub_type == "heading":
        return f"## {text}"
    if layout_role == "list_item":
        return "\n".join(f"- {line}" for line in text.splitlines() if line.strip())
    return text


def _render_formula(text: str) -> str:
    if not text:
        return ""
    if (text.startswith("$$") and text.endswith("$$")) or (
        text.startswith("\\[") and text.endswith("\\]")
    ):
        return text
    return f"$$\n{text}\n$$"


def _render_image_links(block: dict, document: dict, asset_uris: dict[str, str]) -> list[str]:
    alt = _image_alt(block)
    links: list[str] = []
    for asset_id in block_asset_ids(block):
        uri = asset_uris.get(asset_id, "").strip()
        if uri:
            links.append(f"![{alt}]({uri})")
    return links


def _image_alt(block: dict) -> str:
    content = block.get("content", {}) or {}
    for value in (content.get("alt"), content.get("title")):
        text = str(value or "").strip()
        if text:
            return _escape_image_alt(text)
    raw_text = block_text(block)
    match = _HTML_ALT_RE.search(raw_text)
    if match and match.group(1).strip():
        return _escape_image_alt(match.group(1).strip())
    return "Image"


def _escape_image_alt(value: str) -> str:
    return value.replace("[", "\\[").replace("]", "\\]").replace("\n", " ")


def _canonical_markdown_asset_uris(document: dict) -> dict[str, str]:
    assets = document.get("assets", {}) or {}
    return {
        str(asset_id): _markdown_relative_uri(str((asset or {}).get("uri", "") or ""))
        for asset_id, asset in assets.items()
        if isinstance(asset, dict)
    }


def _materialize_markdown_assets(*, document: dict, job_root: Path) -> dict[str, str]:
    assets = document.get("assets", {}) or {}
    resolved: dict[str, str] = {}
    for raw_asset_id, raw_asset in assets.items():
        if not isinstance(raw_asset, dict):
            continue
        asset_id = str(raw_asset_id or "").strip()
        uri = str(raw_asset.get("uri", "") or "").strip()
        if not asset_id or not uri:
            continue
        markdown_uri = _markdown_relative_uri(uri)
        if uri.lower().startswith(_EXTERNAL_URI_PREFIXES) or markdown_uri.startswith("images/"):
            resolved[asset_id] = markdown_uri
            continue

        source_path = _job_asset_source_path(uri=uri, job_root=job_root)
        target_rel_path = _safe_asset_rel_path(asset_id=asset_id, uri=uri)
        if source_path is None or target_rel_path is None or not source_path.is_file():
            resolved[asset_id] = markdown_uri
            continue

        target_path = job_root / "md" / "images" / target_rel_path
        target_path.parent.mkdir(parents=True, exist_ok=True)
        if not target_path.exists() and source_path.resolve() != target_path.resolve():
            shutil.copy2(source_path, target_path)
        resolved[asset_id] = f"images/{target_rel_path.as_posix()}"
    return resolved


def _markdown_relative_uri(uri: str) -> str:
    normalized = str(uri or "").strip().replace("\\", "/")
    while normalized.startswith("./"):
        normalized = normalized[2:]
    if normalized.startswith("md/images/"):
        return normalized[len("md/") :]
    return normalized


def _job_asset_source_path(*, uri: str, job_root: Path) -> Path | None:
    normalized = str(uri or "").strip().replace("\\", "/")
    candidate = Path(normalized)
    if candidate.is_absolute():
        return candidate
    if normalized.startswith("images/"):
        return job_root / "md" / normalized
    resolved = (job_root / candidate).resolve()
    try:
        resolved.relative_to(job_root.resolve())
    except ValueError:
        return None
    return resolved


def _safe_asset_rel_path(*, asset_id: str, uri: str) -> Path | None:
    normalized = asset_id.strip().replace("\\", "/").lstrip("/")
    parts = [part for part in PurePosixPath(normalized).parts if part not in {"", ".", ".."}]
    if not parts:
        fallback_name = Path(uri).name
        parts = [fallback_name] if fallback_name else []
    return Path(*parts) if parts else None


__all__ = [
    "materialize_document_markdown_fallback",
    "render_document_markdown",
]
