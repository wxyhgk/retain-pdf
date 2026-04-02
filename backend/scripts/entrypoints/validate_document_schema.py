import argparse
import json
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from services.document_schema import adapt_path_to_document_v1_with_report
from services.document_schema import build_normalization_summary
from services.document_schema import build_validation_report
from services.document_schema import list_registered_ocr_adapters
from services.document_schema import validate_document_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate normalized document.v1.json, or explicitly adapt raw OCR JSON and inspect the resulting normalization report. Mainline OCR input still prefers document.v1.json.",
    )
    parser.add_argument("json_path", nargs="?", default="", type=str, help="Path to normalized document.v1.json, or to raw OCR JSON when --adapt is explicitly used.")
    parser.add_argument("--adapt", action="store_true", help="Treat input as raw OCR JSON and run adapter -> compat -> validation before inspecting the normalization report.")
    parser.add_argument("--list-providers", action="store_true", help="Print registered OCR adapters and exit.")
    parser.add_argument("--document-id", type=str, default="", help="Explicit document_id when --adapt is used.")
    parser.add_argument("--provider", type=str, default="", help="Optional explicit provider when --adapt is used.")
    parser.add_argument("--provider-version", type=str, default="", help="Optional provider version when --adapt is used.")
    parser.add_argument("--write-report", type=str, default="", help="Optional path to save JSON report.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.list_providers:
        for provider in list_registered_ocr_adapters():
            print(provider)
        return

    if not args.json_path.strip():
        raise SystemExit("json_path is required unless --list-providers is used.")

    path = Path(args.json_path).resolve()
    if args.adapt:
        document_id = args.document_id.strip() or path.stem
        document, normalization_report = adapt_path_to_document_v1_with_report(
            source_json_path=path,
            document_id=document_id,
            provider=args.provider.strip() or None,
            provider_version=args.provider_version.strip(),
        )
        normalization_summary = build_normalization_summary(normalization_report)
        validation_report = build_validation_report(document)
        report = {
            "mode": "adapt",
            "input_path": str(path),
            "normalization": normalization_report,
            "normalization_summary": normalization_summary,
            "validation": validation_report,
        }
        print(
            "adapted: "
            f"provider={normalization_summary['provider']} "
            f"detected={normalization_summary['detected_provider']} "
            f"pages={normalization_summary['page_count']} "
            f"blocks={normalization_summary['block_count']}"
        )
    else:
        data = validate_document_path(path)
        validation_report = build_validation_report(data)
        report = {
            "mode": "validate",
            "input_path": str(path),
            "validation": validation_report,
        }
        print(f"valid schema: {data['schema']} {data['schema_version']}")
        print(f"document_id: {data['document_id']}")
        print(f"pages: {data['page_count']}")
        print(f"blocks: {validation_report['block_count']}")

    if args.write_report.strip():
        report_path = Path(args.write_report).resolve()
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"report: {report_path}")


if __name__ == "__main__":
    main()
