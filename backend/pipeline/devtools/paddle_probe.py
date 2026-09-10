from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
PIPELINE_ROOT = Path(__file__).resolve().parents[1]
if str(PIPELINE_ROOT) not in sys.path:
    sys.path.append(str(PIPELINE_ROOT))

from retainpdf_pipeline.ocr.document_schema import adapt_path_to_document_v1_with_report


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Probe Paddle raw OCR JSON and print suspicious cross-column merge signals.",
    )
    parser.add_argument("--source-json", required=True, help="Path to Paddle raw JSON payload")
    parser.add_argument("--source-pdf", default="", help="Optional source PDF path, only echoed for context")
    parser.add_argument("--document-id", default="paddle-probe", help="Document id used during normalization")
    parser.add_argument("--provider-version", default="PaddleOCR-VL", help="Provider version label")
    parser.add_argument(
        "--show-blocks",
        action="store_true",
        help="Print suspicious block previews for each flagged page",
    )
    return parser.parse_args()


def _load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _iter_flagged_blocks(page: dict) -> list[dict]:
    flagged = []
    for block in page.get("blocks", []) or []:
        metadata = dict(block.get("metadata", {}) or {})
        if not metadata.get("provider_cross_column_merge_suspected"):
            continue
        text = " ".join(str(block.get("text", "") or "").split())
        flagged.append(
            {
                "block_id": block.get("block_id"),
                "bbox": block.get("bbox"),
                "column_guess": metadata.get("provider_column_index_guess"),
                "continuation_suppressed": metadata.get("provider_continuation_suppressed"),
                "text_missing_but_bbox_present": metadata.get("provider_text_missing_but_bbox_present"),
                "peer_block_absorbed_text": metadata.get("provider_peer_block_absorbed_text"),
                "suspected_peer_block_id": metadata.get("provider_suspected_peer_block_id"),
                "preview": text[:160],
            }
        )
    return flagged


def main() -> int:
    args = parse_args()
    source_json_path = Path(args.source_json).expanduser().resolve()
    source_pdf_path = Path(args.source_pdf).expanduser().resolve() if args.source_pdf else None
    if not source_json_path.exists():
        raise RuntimeError(f"source json not found: {source_json_path}")
    if source_pdf_path is not None and not source_pdf_path.exists():
        raise RuntimeError(f"source pdf not found: {source_pdf_path}")

    document, report = adapt_path_to_document_v1_with_report(
        source_json_path=source_json_path,
        document_id=args.document_id,
        provider="paddle",
        provider_version=args.provider_version,
    )

    provider_signals = dict(report.get("provider_signals") or {})
    page_summaries = list(provider_signals.get("pages") or [])

    print(f"source_json: {source_json_path}")
    if source_pdf_path is not None:
        print(f"source_pdf: {source_pdf_path}")
    print(f"pages: {document.get('page_count', 0)}")
    print(
        "provider_signals: "
        + json.dumps(
            {
                "suspicious_cross_column_merge_pages": provider_signals.get(
                    "suspicious_cross_column_merge_pages",
                    0,
                ),
                "suspicious_cross_column_merge_blocks": provider_signals.get(
                    "suspicious_cross_column_merge_blocks",
                    0,
                ),
            },
            ensure_ascii=False,
        )
    )

    if not page_summaries:
        print("pages_summary: []")
        return 0

    print("pages_summary:")
    pages = list(document.get("pages", []) or [])
    for page_summary in page_summaries:
        page_index = int(page_summary.get("page_index", 0) or 0)
        one_based = page_index + 1
        print(
            json.dumps(
                {
                    "page": one_based,
                    "column_layout_mode": page_summary.get("column_layout_mode"),
                    "suspected_cross_column_merge_block_count": page_summary.get(
                        "suspected_cross_column_merge_block_count",
                        0,
                    ),
                    "suspected_block_ids": page_summary.get("suspected_block_ids", []),
                },
                ensure_ascii=False,
            )
        )
        if not args.show_blocks:
            continue
        if not (0 <= page_index < len(pages)):
            continue
        for block in _iter_flagged_blocks(pages[page_index]):
            print(json.dumps(block, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
