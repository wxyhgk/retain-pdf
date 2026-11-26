"""Offline recovery into a NEW job copy; never edits the source job or calls a provider.

Usage: uv run --project backend python backend/pipeline/devtools/repair_mineru_cross_page.py SOURCE OUTPUT
Review/render OUTPUT before publishing it. Existing checkpoints remain historical;
the repaired generation must be committed through the durable DB API at publication.
"""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path

from retainpdf_base.io import save_json_atomic
from retainpdf_pipeline.ocr.document_schema.adapters import (
    adapt_path_to_document_v1_with_report,
)
from retainpdf_translation.public import prepare_relocated_translation_copy


def build_block_mapping(old: dict, new: dict) -> dict[str, dict]:
    index = defaultdict(list)
    for page in new["pages"]:
        for block in page["blocks"]:
            paths = {
                block["source"]["raw_path"],
                *block["metadata"].get("cross_page_source_paths", []),
            }
            for path in paths:
                index[(path, block["text"])].append(block)
    mapping = {}
    for page in old["pages"]:
        for block in page["blocks"]:
            candidates = index[(block["source"]["raw_path"], block["text"])]
            if len(candidates) != 1:
                raise ValueError(
                    f"Cannot safely reuse old block {block['block_id']}: {len(candidates)} matches"
                )
            mapping[block["block_id"]] = candidates[0]
    if len({b["block_id"] for b in mapping.values()}) != len(mapping):
        raise ValueError("Block mapping is not one-to-one")
    if len(mapping) != sum(len(p["blocks"]) for p in new["pages"]):
        raise ValueError("New document contains unmatched blocks")
    return mapping


def _write_repair_summary(path: Path, result: dict) -> None:
    """Publish this tool's audit summary without exposing a partial JSON file."""
    save_json_atomic(path, result)


def prepare_repaired_job(source: Path, output: Path) -> dict:
    source, output = source.resolve(), output.resolve()
    if (
        output.exists()
        or output.is_relative_to(source)
        or source.is_relative_to(output)
    ):
        raise ValueError("Output must be a new, separate job directory")
    normalized = source / "ocr/normalized/document.v1.json"
    old = json.loads(normalized.read_text(encoding="utf-8"))
    new, report = adapt_path_to_document_v1_with_report(
        source_json_path=source / "ocr/unpacked/layout.json",
        document_id=old["document_id"],
        provider="mineru",
        provider_version=old["source"].get("provider_version", ""),
    )
    mapping = build_block_mapping(old, new)
    if not report["provider_signals"].get("cross_page_recovered_block_count"):
        raise ValueError(
            "No cross-page recovery found; refusing an unnecessary rewrite"
        )
    result = prepare_relocated_translation_copy(
        source=source,
        output=output,
        normalized_document=new,
        normalization_report=report,
        block_mapping=mapping,
        expected_relocated_count=report["provider_signals"][
            "cross_page_recovered_block_count"
        ],
    )
    # This tool owns only its provider-specific audit summary; translation
    # payloads, references and checkpoints are committed by the public operation.
    result_path = output / "artifacts/mineru-cross-page-repair.json"
    _write_repair_summary(result_path, result)
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    print(
        json.dumps(
            prepare_repaired_job(args.source, args.output), ensure_ascii=False, indent=2
        )
    )
