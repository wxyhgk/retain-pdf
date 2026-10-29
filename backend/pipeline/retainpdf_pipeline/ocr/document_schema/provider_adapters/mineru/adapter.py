from __future__ import annotations

"""MinerU layout payload -> document.v1 orchestration."""

import json
from collections import Counter
from pathlib import Path

from retainpdf_pipeline.ocr.document_schema.provider_adapters.common.continuation import (
    assign_provider_group_continuation_hints,
)
from retainpdf_pipeline.ocr.document_schema.provider_adapters.mineru.cross_page import (
    restore_cross_page_spans,
)
from retainpdf_pipeline.ocr.document_schema.provider_adapters.mineru.label_catalog import (
    MINERU_MIDDLE_TAXONOMY_PROFILE,
    MINERU_TEXT_AGGREGATE_CONTAINERS,
    get_mineru_label_definition,
)
from retainpdf_pipeline.ocr.document_schema.provider_adapters.mineru.records import (
    build_block_record,
    make_raw_path,
    ordered_page_roots,
)
from retainpdf_pipeline.ocr.document_schema.provider_adapters.mineru.relations import (
    attach_mineru_group_relations,
)
from retainpdf_pipeline.ocr.document_schema.provider_adapters.mineru.text import (
    iter_child_blocks,
    iter_layout_pages,
)
from retainpdf_pipeline.ocr.document_schema.providers import PROVIDER_MINERU
from retainpdf_pipeline.ocr.document_schema.version import (
    DOCUMENT_SCHEMA_NAME,
    DOCUMENT_SCHEMA_VERSION,
)


def build_page_record(page: dict, *, page_idx: int) -> tuple[dict, int]:
    page_size = page.get("page_size", []) or []
    width = page_size[0] if len(page_size) >= 1 else 0
    height = page_size[1] if len(page_size) >= 2 else 0
    blocks_out: list[dict] = []
    skipped_container_count = 0

    def visit_block(
        block: dict,
        raw_path_parts: list[str | int],
        parent_group: dict | None = None,
    ) -> None:
        nonlocal skipped_container_count
        # MinerU marks merged-from shells with lines_deleted=true and empties
        # their lines; skip them before they become empty downstream records.
        if block.get("lines_deleted"):
            return
        raw_type = str(block.get("type", "") or "").strip().lower()
        children = iter_child_blocks(block)
        aggregate_children = raw_type in MINERU_TEXT_AGGREGATE_CONTAINERS and bool(
            children
        )
        if children and not aggregate_children:
            skipped_container_count += 1
            group_raw_path = make_raw_path(page_idx, raw_path_parts)
            group = {
                "provider_group_type": raw_type,
                "provider_group_bbox": block.get("bbox", []),
                "provider_group_raw_path": group_raw_path,
            }
            start = len(blocks_out)
            for child_idx, child in enumerate(children):
                visit_block(
                    child, [*raw_path_parts, "blocks", child_idx], parent_group=group
                )
            group_records = blocks_out[start:]
            target = next(
                (
                    record
                    for record in group_records
                    if (record.get("content", {}) or {}).get("kind", record.get("type"))
                    in {"image", "table", "code"}
                ),
                None,
            )
            if target is not None:
                attach_mineru_group_relations(
                    group_type=raw_type,
                    target_block=target,
                    related_blocks=group_records,
                )
            return

        # A container without children is emitted as a conservative fallback;
        # some MinerU backends flatten their middle output.
        blocks_out.extend(
            build_block_record(
                block=block,
                page_idx=page_idx,
                page_block_index=len(blocks_out),
                raw_path_parts=raw_path_parts,
                aggregate_children=aggregate_children,
                parent_group=parent_group,
            )
        )

    for block, raw_path_parts in ordered_page_roots(page):
        visit_block(block, raw_path_parts)

    markdown_images: dict[str, str] = {}
    for record in blocks_out:
        metadata = record.get("metadata", {}) or {}
        raw_paths = metadata.get("asset_paths", [])
        if not isinstance(raw_paths, list):
            continue
        for value in raw_paths:
            relative = str(value or "").strip()
            if relative:
                markdown_images[relative] = (
                    f"md/images/page-{page_idx + 1}/{relative.lstrip('/')}"
                )

    return (
        {
            "page_index": page_idx,
            "width": width,
            "height": height,
            "unit": "pt",
            "blocks": blocks_out,
            **(
                {"metadata": {"markdown": {"images": markdown_images}}}
                if markdown_images
                else {}
            ),
        },
        skipped_container_count,
    )


def link_cross_page_continuations(pages: list[dict]) -> int:
    """把拆回各页的跨页段落连成一组接续提示（head → … → tail），返回连了几组。

    MinerU 把跨页的一段话合进前一页那段（后半截的片段标着 `cross_page`），`restore_cross_page_spans` 把后半截拆回它
    自己的页，在那段的元数据里记着前一页那段的原始路径（`cross_page_source_paths`）。以前拆完就什么都没留，翻译把两半
    当成两段各翻各的（Paddle 那边一直有接续提示）。同一个原始块拆出几条记录（行跑出块框的另成一条）时只认第一条。
    已经有服务商接续提示的块不动。
    """
    first_record_by_path: dict[str, dict] = {}
    for page in pages:
        for block in page.get("blocks", []) or []:
            raw_path = str((block.get("source") or {}).get("raw_path", "") or "")
            if raw_path and raw_path not in first_record_by_path:
                first_record_by_path[raw_path] = block

    next_by_id: dict[str, dict] = {}
    has_previous: set[str] = set()
    blocks_by_id: dict[str, dict] = {}
    for raw_path, block in first_record_by_path.items():
        blocks_by_id[block["block_id"]] = block
        sources = [
            first_record_by_path[str(path)]
            for path in (block.get("metadata") or {}).get("cross_page_source_paths", []) or []
            if str(path) in first_record_by_path and first_record_by_path[str(path)] is not block
        ]
        if not sources:
            continue
        # 一段被合进好几块时，按页、按顺序串起来，最后一块接这一段。
        chain = sorted(sources, key=lambda item: (item.get("page_index", 0), item.get("order", 0))) + [block]
        for earlier, later in zip(chain, chain[1:]):
            blocks_by_id[earlier["block_id"]] = earlier
            next_by_id.setdefault(earlier["block_id"], later)
            has_previous.add(later["block_id"])

    linked = 0
    for block_id, block in blocks_by_id.items():
        if block_id in has_previous or block_id not in next_by_id:
            continue
        ordered = [block]
        seen = {block_id}
        while ordered[-1]["block_id"] in next_by_id:
            following = next_by_id[ordered[-1]["block_id"]]
            if following["block_id"] in seen:
                break
            seen.add(following["block_id"])
            ordered.append(following)
        if any(
            str((item.get("continuation_hint") or {}).get("source", "") or "") == "provider"
            for item in ordered
        ):
            continue
        assign_provider_group_continuation_hints(
            group_id=f"mineru-cross-page-{block_id}",
            ordered_blocks=ordered,
            reading_order_resolver=lambda item, _index: item.get("reading_order", item.get("order")),
        )
        linked += 1
    return linked


def collect_raw_label_counts(layout_payload: dict) -> Counter[str]:
    counts: Counter[str] = Counter()

    def visit(block: dict) -> None:
        label = str(block.get("type", "") or "").strip().lower() or "<missing>"
        counts[label] += 1
        for child in iter_child_blocks(block):
            visit(child)

    for page in iter_layout_pages(layout_payload):
        for block, _raw_path in ordered_page_roots(page):
            visit(block)
    return counts


def build_mineru_document(
    payload: dict,
    document_id: str,
    source_json_path: Path,
    provider_version: str,
) -> dict:
    physical_pages, cross_page_signals = restore_cross_page_spans(
        iter_layout_pages(payload)
    )
    page_results = [
        build_page_record(page, page_idx=page_idx)
        for page_idx, page in enumerate(physical_pages)
    ]
    pages = [page for page, _skipped in page_results]
    cross_page_linked_group_count = link_cross_page_continuations(pages)
    raw_label_counts = collect_raw_label_counts(payload)
    unknown_labels = sorted(
        label
        for label in raw_label_counts
        if label != "<missing>" and get_mineru_label_definition(label) is None
    )
    resolved_version = str(provider_version or payload.get("_version_name", "") or "")
    return {
        "schema": DOCUMENT_SCHEMA_NAME,
        "schema_version": DOCUMENT_SCHEMA_VERSION,
        "document_id": document_id,
        "source": {
            "provider": PROVIDER_MINERU,
            "provider_version": resolved_version,
            "raw_files": {"layout_json": str(source_json_path)},
        },
        "page_count": len(pages),
        "pages": pages,
        "derived": {
            "notes": "MinerU middle.json adapted through RetainPDF canonical roles.",
            "provider_signals": {
                "taxonomy_profile": MINERU_MIDDLE_TAXONOMY_PROFILE,
                "backend": str(payload.get("_backend", "") or ""),
                "mineru_version": str(payload.get("_version_name", "") or ""),
                "raw_block_type_counts": dict(sorted(raw_label_counts.items())),
                "unknown_block_types": unknown_labels,
                "structural_containers_not_emitted": sum(
                    skipped for _page, skipped in page_results
                ),
                **cross_page_signals,
                **(
                    {"cross_page_linked_group_count": cross_page_linked_group_count}
                    if cross_page_signals
                    else {}
                ),
            },
        },
    }


def build_normalized_document_from_layout_payload(
    *,
    layout_payload: dict,
    document_id: str,
    layout_json_path: Path,
    provider_version: str = "",
) -> dict:
    return build_mineru_document(
        payload=layout_payload,
        document_id=document_id,
        source_json_path=layout_json_path,
        provider_version=provider_version,
    )


def build_normalized_document_from_layout_path(
    *,
    layout_json_path: Path,
    document_id: str,
    provider_version: str = "",
) -> dict:
    payload = json.loads(layout_json_path.read_text(encoding="utf-8"))
    return build_normalized_document_from_layout_payload(
        layout_payload=payload,
        document_id=document_id,
        layout_json_path=layout_json_path,
        provider_version=provider_version,
    )


__all__ = [
    "build_mineru_document",
    "build_normalized_document_from_layout_path",
    "build_normalized_document_from_layout_payload",
]
