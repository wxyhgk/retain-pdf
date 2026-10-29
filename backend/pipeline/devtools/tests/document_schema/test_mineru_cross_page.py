from __future__ import annotations

from copy import deepcopy
from pathlib import Path

import pytest
from retainpdf_pipeline.ocr.document_schema.adapters import adapt_payload_to_document_v1
from retainpdf_pipeline.ocr.document_schema.provider_adapters.mineru.cross_page import (
    restore_cross_page_spans,
)
from retainpdf_pipeline.ocr.document_schema.validator import validate_document_payload


def _line(text: str, y: int, *, cross_page: bool = False) -> dict:
    bbox = [100, y, 500, y + 10]
    return {
        "bbox": bbox,
        "spans": [
            {
                "type": "text",
                "content": text,
                "bbox": bbox,
                "score": 1,
                **({"cross_page": True} if cross_page else {}),
            }
        ],
    }


def _block(lines: list[dict], index: int, bbox: list[int]) -> dict:
    return {"type": "text", "index": index, "bbox": bbox, "lines": lines}


def _fixture() -> dict:
    tail = _block(
        [
            _line("bias may be crucial on the next physical page", 287),
            _line("for algorithmic and language understanding tasks.", 300),
        ],
        3,
        [98, 285, 502, 312],
    )
    merged = deepcopy(tail["lines"])
    for line in merged:
        line["spans"][0]["cross_page"] = True
    head = _block(
        [_line("Our experiments indicate that this inductive", 695), *merged],
        12,
        [98, 693, 502, 707],
    )
    shell = {**deepcopy(tail), "lines": [], "lines_deleted": True}
    return {
        "_version_name": "3.4.4",
        "pdf_info": [
            {"page_size": [612, 792], "para_blocks": [head], "preproc_blocks": []},
            {"page_size": [700, 900], "para_blocks": [shell], "preproc_blocks": [tail]},
        ],
    }


def _adapt(payload: dict) -> dict:
    return adapt_payload_to_document_v1(
        payload=payload,
        provider="mineru",
        document_id="cross-page-test",
        source_json_path=Path("layout.json"),
    )


def test_cross_page_tail_restores_physical_page_geometry_and_provenance() -> None:
    payload = _fixture()
    before = deepcopy(payload)
    document = _adapt(payload)
    validate_document_payload(document)
    head, tail = [page["blocks"][0] for page in document["pages"]]
    assert payload == before
    assert len(document["pages"][0]["blocks"]) == 1
    assert head["text"] == "Our experiments indicate that this inductive"
    assert (
        tail["text"]
        == "bias may be crucial on the next physical page for algorithmic and language understanding tasks."
    )
    assert tail["page_index"] == 1
    assert tail["block_id"] == "p002-b0000"
    assert tail["bbox"] == [98, 285, 502, 312]
    assert tail["source"]["raw_page_index"] == 1
    assert tail["source"]["raw_path"] == "/pdf_info/1/para_blocks/0"
    assert (
        tail["metadata"]["cross_page_physical_path"] == "/pdf_info/1/preproc_blocks/0"
    )
    assert document["pages"][1]["width"] == 700
    assert (
        document["derived"]["provider_signals"]["cross_page_recovered_span_count"] == 2
    )


def test_recovery_is_idempotent_and_does_not_duplicate_an_existing_tail() -> None:
    payload = _fixture()
    payload["pdf_info"][1]["para_blocks"] = deepcopy(
        payload["pdf_info"][1]["preproc_blocks"]
    )
    pages, signals = restore_cross_page_spans(payload["pdf_info"])
    again, next_signals = restore_cross_page_spans(pages)
    assert pages == again
    assert signals["cross_page_recovered_block_count"] == 1
    assert next_signals == {}
    assert len(pages[1]["para_blocks"][0]["lines"]) == 2


def test_recovery_handles_consecutive_cross_page_paragraphs() -> None:
    payload = _fixture()
    second = _fixture()
    second["pdf_info"][0]["para_blocks"][0]["index"] = 8
    for line in second["pdf_info"][0]["para_blocks"][0]["lines"][1:]:
        line["spans"][0]["content"] += " Another paragraph."
    for line in second["pdf_info"][1]["preproc_blocks"][0]["lines"]:
        line["spans"][0]["content"] += " Another paragraph."
    payload["pdf_info"][1]["para_blocks"].extend(second["pdf_info"][0]["para_blocks"])
    payload["pdf_info"].append(second["pdf_info"][1])
    document = _adapt(payload)
    validate_document_payload(document)
    assert [len(page["blocks"]) for page in document["pages"]] == [1, 2, 1]
    assert "Another paragraph." not in document["pages"][1]["blocks"][1]["text"]
    assert "Another paragraph." in document["pages"][2]["blocks"][0]["text"]


@pytest.mark.parametrize(
    "failure",
    ["missing_preproc", "ambiguous_page", "missing_shell", "incomplete_coverage"],
)
def test_uncertain_physical_page_fails_instead_of_silently_emitting_wrong_text(
    failure: str,
) -> None:
    payload = _fixture()
    if failure == "missing_preproc":
        payload["pdf_info"][1]["preproc_blocks"] = []
    elif failure == "ambiguous_page":
        payload["pdf_info"].append(deepcopy(payload["pdf_info"][1]))
    elif failure == "missing_shell":
        payload["pdf_info"][1]["para_blocks"] = []
    else:
        payload["pdf_info"][0]["para_blocks"][0]["lines"].pop()
    before = deepcopy(payload)
    with pytest.raises(ValueError, match="MinerU cross-page"):
        _adapt(payload)
    assert payload == before


def test_unrelated_deleted_shell_and_unmarked_orphan_are_unchanged() -> None:
    payload = _fixture()
    orphan = _block([_line("ordinary disjoint line", 40)], 14, [100, 700, 500, 720])
    deleted = {
        **_block([_line("merged on same page", 60)], 15, [100, 60, 500, 70]),
        "lines_deleted": True,
    }
    payload["pdf_info"][0]["para_blocks"].extend([orphan, deleted])
    document = _adapt(payload)
    text = " ".join(block["text"] for block in document["pages"][0]["blocks"])
    assert "ordinary disjoint line" in text
    assert "merged on same page" not in text


def test_nested_hyperlink_cross_page_spans_are_recovered() -> None:
    payload = _fixture()
    for line in payload["pdf_info"][0]["para_blocks"][0]["lines"][1:]:
        line["spans"] = [{"type": "hyperlink", "children": line["spans"]}]
    document = _adapt(payload)
    validate_document_payload(document)
    assert len(document["pages"][0]["blocks"]) == 1
    assert "bias may be crucial" in document["pages"][1]["blocks"][0]["text"]


def test_cross_page_is_resolved_even_when_coordinates_overlap_parent() -> None:
    payload = _fixture()
    payload["pdf_info"][0]["para_blocks"][0]["bbox"] = [98, 280, 502, 707]
    document = _adapt(payload)
    assert (
        document["pages"][0]["blocks"][0]["text"]
        == "Our experiments indicate that this inductive"
    )
    assert "bias may be crucial" in document["pages"][1]["blocks"][0]["text"]


def test_empty_merged_owner_does_not_leave_a_phantom_block() -> None:
    payload = _fixture()
    payload["pdf_info"][0]["para_blocks"][0]["lines"].pop(0)
    document = _adapt(payload)
    assert document["pages"][0]["blocks"] == []
    assert len(document["pages"][1]["blocks"]) == 1


def test_deleted_stale_cross_page_spans_are_not_resurrected() -> None:
    payload = _fixture()
    stale = _block(
        [_line("stale discarded content", 50, cross_page=True)], 99, [100, 50, 500, 60]
    )
    stale["lines_deleted"] = True
    payload["pdf_info"][0]["para_blocks"].append(stale)
    document = _adapt(payload)
    assert [len(page["blocks"]) for page in document["pages"]] == [1, 1]


def test_the_two_halves_of_a_cross_page_paragraph_are_linked_as_one_continuation() -> None:
    document = _adapt(_fixture())
    validate_document_payload(document)
    head, tail = [page["blocks"][0] for page in document["pages"]]
    head_hint, tail_hint = head["continuation_hint"], tail["continuation_hint"]

    # 拆回两页以后，翻译要知道它们是同一段话（以前两边都是 single，各翻各的）。
    assert head_hint["source"] == tail_hint["source"] == "provider"
    assert head_hint["group_id"] == tail_hint["group_id"] == f"mineru-cross-page-{head['block_id']}"
    assert (head_hint["role"], tail_hint["role"]) == ("head", "tail")
    assert head_hint["scope"] == tail_hint["scope"] == "cross_page"
    assert document["derived"]["provider_signals"]["cross_page_linked_group_count"] == 1


def test_documents_without_cross_page_spans_get_no_continuation_links() -> None:
    payload = _fixture()
    for line in payload["pdf_info"][0]["para_blocks"][0]["lines"]:
        for span in line["spans"]:
            span.pop("cross_page", None)
    payload["pdf_info"][1]["para_blocks"] = [payload["pdf_info"][1]["preproc_blocks"][0]]
    document = _adapt(payload)
    for page in document["pages"]:
        for block in page["blocks"]:
            assert block["continuation_hint"]["source"] != "provider"
    assert "cross_page_linked_group_count" not in document["derived"]["provider_signals"]
