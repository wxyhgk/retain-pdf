from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[3]))

from devtools.tests.document_schema.fixtures.registry import expected_fixture_providers
from devtools.tests.document_schema.fixtures.registry import fixture_names
from devtools.tests.document_schema.fixtures.registry import PROVIDER_FIXTURES
from services.document_schema.providers import PROVIDER_MINERU
from services.document_schema import adapt_path_to_document_v1
from services.document_schema import adapt_path_to_document_v1_with_report
from services.document_schema import build_normalization_summary
from services.document_schema import build_validation_report
from services.document_schema import list_registered_ocr_adapters
from services.document_schema import upgrade_document_payload
from services.document_schema import validate_document_path
from services.document_schema import validate_document_payload
from services.document_schema.providers import PROVIDER_PADDLE
from services.translation.ocr.json_extractor import extract_text_items
from services.translation.payload.translations import _default_translation_flags


# This regression is the final gate for new OCR provider onboarding.
# Recommended sequence:
# 1. define semantics in document_schema/README.md
# 2. add a minimal raw fixture under fixtures/
# 3. register the provider adapter
# 4. add the fixture to fixtures/registry.py
# 5. run this file and make detector/adapt/validation/extractor smoke all pass
#
# Field layering reminder:
# - core structure layer: type/sub_type/bbox/text/lines/segments/tags/derived
# - common trace layer: content_format/asset_*/markdown_match_*
# - provider raw trace layer: source.raw_*, metadata.raw_*, layout_det_*
# New provider adapters should avoid promoting raw provider fields into core semantics.
DEFAULT_NEW_DOCUMENT = Path("output/20260330145544-14ab20/ocr/normalized/document.v1.json")
DEFAULT_LEGACY_DOCUMENT = Path("output/20260330115415-25fdae/ocr/normalized/document.v1.json")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run document.v1 schema regression checks on real samples.")
    parser.add_argument("--new-document", type=str, default=str(DEFAULT_NEW_DOCUMENT))
    parser.add_argument("--legacy-document", type=str, default=str(DEFAULT_LEGACY_DOCUMENT))
    parser.add_argument("--write-report", type=str, default="", help="Optional path to save aggregated regression report.")
    return parser.parse_args()


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def _scenario_validation_summary(document: dict) -> dict:
    validate_document_payload(document)
    return build_validation_report(document)


def _check_registered_providers(providers: list[str]) -> dict:
    expected_providers = expected_fixture_providers()
    provider_set = set(providers)
    missing = sorted(expected_providers - provider_set)
    _require(not missing, f"missing registered providers: {','.join(missing)}")
    names = fixture_names()
    _require(len(names) == len(set(names)), "fixture registry contains duplicate fixture names")
    print("OK registered_providers " + ",".join(providers))
    return {"providers": providers, "expected": sorted(expected_providers), "fixtures": names}


def _check_validated_document(name: str, path: Path) -> dict:
    validated = validate_document_path(path)
    summary = build_validation_report(validated)
    _require(summary["valid"], f"{name}: validation report marked invalid")
    _require(summary["page_count"] > 0, f"{name}: expected page_count > 0")
    _require(summary["block_count"] > 0, f"{name}: expected block_count > 0")
    print(
        f"OK {name} "
        f"schema={validated['schema']} version={validated['schema_version']} "
        f"pages={summary['page_count']} blocks={summary['block_count']}"
    )
    return summary


def _check_legacy_upgrade(path: Path) -> dict:
    legacy_payload = json.loads(path.read_text(encoding="utf-8"))
    upgraded_legacy = upgrade_document_payload(legacy_payload)
    _require("derived" in upgraded_legacy, "legacy_upgrade: top-level derived missing after compat upgrade")
    _require(upgraded_legacy["pages"], "legacy_upgrade: expected non-empty pages")
    _require(upgraded_legacy["pages"][0]["blocks"], "legacy_upgrade: expected non-empty first page blocks")
    _require(
        "derived" in upgraded_legacy["pages"][0]["blocks"][0],
        "legacy_upgrade: first block derived missing after compat upgrade",
    )
    summary = _scenario_validation_summary(upgraded_legacy)
    print(
        "OK legacy_upgrade "
        f"top_has_derived={'derived' in upgraded_legacy} "
        f"block_has_derived={'derived' in upgraded_legacy['pages'][0]['blocks'][0]} "
        f"pages={summary['page_count']} blocks={summary['block_count']}"
    )
    return summary


def _check_adapted_document(name: str, path: Path, *, document_id: str, expected_provider: str) -> dict:
    adapted, report = adapt_path_to_document_v1_with_report(source_json_path=path, document_id=document_id)
    normalization_summary = build_normalization_summary(report)
    summary = _scenario_validation_summary(adapted)
    detected_provider = normalization_summary["detected_provider"]
    _require(adapted["source"]["provider"] == expected_provider, f"{name}: source.provider mismatch")
    _require(detected_provider == expected_provider, f"{name}: detected_provider mismatch")
    _require(report.get("detection", {}).get("matched") is True, f"{name}: provider detection not matched")
    _require(summary["page_count"] > 0, f"{name}: expected page_count > 0")
    _require(summary["block_count"] > 0, f"{name}: expected block_count > 0")
    _require(normalization_summary["valid"] is True, f"{name}: report validation marked invalid")
    print(
        f"OK {name} "
        f"schema={adapted['schema']} provider={expected_provider} "
        f"pages={summary['page_count']} blocks={summary['block_count']} "
        f"compat_pages={normalization_summary['compat_pages']} compat_blocks={normalization_summary['compat_blocks']}"
    )
    print(
        f"OK {name}_detect "
        f"detected={detected_provider} matched={report['detection']['matched']} "
        f"attempts={len(report['detection']['attempts'])}"
    )
    return {
        "summary": summary,
        "normalization": report,
        "normalization_summary": normalization_summary,
    }


def _check_explicit_provider(path: Path, *, document_id: str, provider: str) -> dict:
    adapted = adapt_path_to_document_v1(source_json_path=path, document_id=document_id, provider=provider)
    summary = _scenario_validation_summary(adapted)
    _require(adapted["source"]["provider"] == provider, "explicit_provider: source.provider mismatch")
    print(
        "OK explicit_provider "
        f"provider={provider} pages={summary['page_count']} blocks={summary['block_count']}"
    )
    return summary


def _check_extractor_smoke(name: str, document: dict, *, page_index: int = 0) -> dict:
    items = extract_text_items(document, page_index)
    _require(items, f"{name}: expected non-empty extracted items")
    roles: dict[str, int] = {}
    for item in items:
        role = str(((item.metadata or {}).get("structure_role") or "")).strip().lower()
        _require(role != "", f"{name}: extracted item missing structure_role")
        roles[role] = roles.get(role, 0) + 1
    print(
        f"OK {name} "
        f"page={page_index} items={len(items)} roles={','.join(f'{k}:{v}' for k, v in sorted(roles.items()))}"
    )
    return {
        "page_index": page_index,
        "item_count": len(items),
        "roles": roles,
    }


def _check_paddle_semantics(path: Path) -> dict:
    adapted = adapt_path_to_document_v1(source_json_path=path, document_id="regression-paddle-semantics", provider=PROVIDER_PADDLE)
    pages = adapted["pages"]
    blocks = [block for page in pages for block in page.get("blocks", [])]

    headers = [block for block in blocks if block.get("sub_type") == "header"]
    footers = [block for block in blocks if block.get("sub_type") == "footer"]
    image_captions = [block for block in blocks if block.get("sub_type") == "image_caption"]
    table_captions = [block for block in blocks if block.get("sub_type") == "table_caption"]
    table_footnotes = [block for block in blocks if block.get("sub_type") == "table_footnote"]
    formulas = [block for block in blocks if block.get("type") == "formula" and block.get("sub_type") == "display_formula"]
    image_blocks = [block for block in blocks if block.get("type") == "image"]
    table_blocks = [block for block in blocks if block.get("type") == "table"]
    algorithm_blocks = [block for block in blocks if block.get("type") == "code" and block.get("sub_type") == "code_block"]

    _require(len(headers) == 6, f"paddle_semantics: expected 6 headers, got {len(headers)}")
    _require(len(footers) == 6, f"paddle_semantics: expected 6 footers, got {len(footers)}")
    _require(len(image_captions) == 2, f"paddle_semantics: expected 2 image captions, got {len(image_captions)}")
    _require(len(table_captions) == 2, f"paddle_semantics: expected 2 table captions, got {len(table_captions)}")
    _require(len(table_footnotes) == 1, f"paddle_semantics: expected 1 table footnote, got {len(table_footnotes)}")
    _require(len(formulas) == 1, f"paddle_semantics: expected 1 display formula, got {len(formulas)}")

    _require(all(((block.get("derived", {}) or {}).get("role") == "header") for block in headers), "paddle_semantics: header derived.role mismatch")
    _require(all(((block.get("derived", {}) or {}).get("role") == "footer") for block in footers), "paddle_semantics: footer derived.role mismatch")
    _require(all(((block.get("derived", {}) or {}).get("role") == "image_caption") for block in image_captions), "paddle_semantics: image_caption derived.role mismatch")
    _require(all(((block.get("derived", {}) or {}).get("role") == "table_caption") for block in table_captions), "paddle_semantics: table_caption derived.role mismatch")
    _require(((table_footnotes[0].get("derived", {}) or {}).get("role") == "table_footnote"), "paddle_semantics: table_footnote derived.role mismatch")
    _require(all((page.get("metadata", {}) or {}).get("provider_page_count") == 3 for page in pages), "paddle_semantics: provider_page_count mismatch")
    _require(all(isinstance((page.get("metadata", {}) or {}).get("model_settings"), dict) for page in pages), "paddle_semantics: missing model_settings")
    _require(all(isinstance(((page.get("metadata", {}) or {}).get("markdown", {}) or {}).get("text", None), str) for page in pages), "paddle_semantics: missing markdown text")
    _require(all(isinstance(((page.get("metadata", {}) or {}).get("layout_det_res", {}) or {}).get("boxes", None), list) for page in pages), "paddle_semantics: missing layout_det_res boxes")
    _require(all("source" in block for block in blocks), "paddle_semantics: missing source trace")
    _require(all("metadata" in block for block in blocks), "paddle_semantics: missing metadata")
    _require(all(block.get("metadata", {}).get("layout_det_matched") is True for block in blocks), "paddle_semantics: layout_det matching regression")
    _require(all(str(block.get("metadata", {}).get("layout_det_label", "") or "") == str((block.get("source", {}) or {}).get("raw_type", "") or "") for block in blocks), "paddle_semantics: layout_det label mismatch")
    _require(len(image_blocks) == 1, f"paddle_semantics: expected 1 image block, got {len(image_blocks)}")
    _require(len(table_blocks) == 2, f"paddle_semantics: expected 2 table blocks, got {len(table_blocks)}")
    _require(len(algorithm_blocks) == 1, f"paddle_semantics: expected 1 algorithm block, got {len(algorithm_blocks)}")
    _require(all(str(block.get("metadata", {}).get("content_format", "") or "") == "html_table" for block in table_blocks), "paddle_semantics: table content_format mismatch")
    _require(str(image_blocks[0].get("metadata", {}).get("content_format", "") or "") == "html_image", "paddle_semantics: image content_format mismatch")
    _require(str(algorithm_blocks[0].get("metadata", {}).get("content_format", "") or "") == "code_like_text", "paddle_semantics: algorithm content_format mismatch")
    _require(image_blocks[0].get("metadata", {}).get("asset_resolved") is True, "paddle_semantics: image asset not resolved")
    _require(bool(str(image_blocks[0].get("metadata", {}).get("asset_key", "") or "")), "paddle_semantics: image asset_key missing")
    _require(bool(str(image_blocks[0].get("metadata", {}).get("asset_url", "") or "")), "paddle_semantics: image asset_url missing")
    _require(any(block.get("metadata", {}).get("markdown_match_found") for block in image_captions + table_captions + algorithm_blocks + formulas), "paddle_semantics: markdown matching did not hit any key blocks")

    formula_segments = formulas[0].get("segments", [])
    _require(bool(formula_segments), "paddle_semantics: display formula missing segments")
    _require(str(formula_segments[0].get("type", "") or "") == "formula", "paddle_semantics: display formula segment type mismatch")
    _require("Figure 1:" in image_captions[0].get("text", "") or "Listing 1:" in image_captions[0].get("text", ""), "paddle_semantics: unexpected image caption text")
    _require("Table" in table_captions[0].get("text", ""), "paddle_semantics: unexpected table caption text")
    print(
        "OK paddle_semantics "
        f"headers={len(headers)} footers={len(footers)} "
        f"image_captions={len(image_captions)} table_captions={len(table_captions)} "
        f"table_footnotes={len(table_footnotes)} formulas={len(formulas)}"
    )
    return {
        "headers": len(headers),
        "footers": len(footers),
        "image_captions": len(image_captions),
        "table_captions": len(table_captions),
        "table_footnotes": len(table_footnotes),
        "formulas": len(formulas),
    }


def _check_paddle_extractor_roles(path: Path) -> dict:
    adapted = adapt_path_to_document_v1(
        source_json_path=path,
        document_id="regression-paddle-extractor-roles",
        provider=PROVIDER_PADDLE,
    )
    items = []
    for page_idx in range(len(adapted["pages"])):
        items.extend(extract_text_items(adapted, page_idx))

    image_captions = [
        item for item in items if str(((item.metadata or {}).get("structure_role") or "")).strip().lower() == "image_caption"
    ]
    table_captions = [
        item for item in items if str(((item.metadata or {}).get("structure_role") or "")).strip().lower() == "table_caption"
    ]
    table_footnotes = [
        item for item in items if str(((item.metadata or {}).get("structure_role") or "")).strip().lower() == "table_footnote"
    ]
    headings = [
        item for item in items if str(((item.metadata or {}).get("structure_role") or "")).strip().lower() == "heading"
    ]

    _require(image_captions, "paddle_extractor_roles: image_caption should be seeded into extraction role")
    _require(table_captions, "paddle_extractor_roles: table_caption should be seeded into extraction role")
    _require(table_footnotes, "paddle_extractor_roles: table_footnote should be seeded into extraction role")
    _require(headings, "paddle_extractor_roles: heading should be seeded into extraction role")
    print(
        "OK paddle_extractor_roles "
        f"image_captions={len(image_captions)} table_captions={len(table_captions)} "
        f"table_footnotes={len(table_footnotes)} headings={len(headings)}"
    )
    return {
        "image_captions": len(image_captions),
        "table_captions": len(table_captions),
        "table_footnotes": len(table_footnotes),
        "headings": len(headings),
    }


def _check_paddle_sci_semantics(path: Path) -> dict:
    adapted = adapt_path_to_document_v1(source_json_path=path, document_id="regression-paddle-sci-semantics", provider=PROVIDER_PADDLE)
    pages = adapted["pages"]
    blocks = [block for page in pages for block in page.get("blocks", [])]

    titles = [block for block in blocks if block.get("sub_type") == "title"]
    abstracts = [block for block in blocks if block.get("sub_type") == "abstract"]
    references = [block for block in blocks if block.get("sub_type") == "reference_entry"]
    formula_numbers = [block for block in blocks if block.get("sub_type") == "formula_number"]
    images = [block for block in blocks if block.get("type") == "image"]

    _require(len(titles) >= 1, "paddle_sci_semantics: expected doc_title mapping")
    _require(len(abstracts) >= 1, "paddle_sci_semantics: expected abstract mapping")
    _require(len(references) >= 50, "paddle_sci_semantics: expected many reference_content mappings")
    _require(len(formula_numbers) >= 20, "paddle_sci_semantics: expected formula_number mappings")
    _require(len(images) >= 10, "paddle_sci_semantics: expected image/chart mappings")
    _require(all("skip_translation" in (block.get("tags") or []) for block in references), "paddle_sci_semantics: reference entries should skip translation")
    _require(all("skip_translation" in (block.get("tags") or []) for block in formula_numbers), "paddle_sci_semantics: formula numbers should skip translation")
    _require(all("skip_translation" in (block.get("tags") or []) for block in images), "paddle_sci_semantics: images/charts should skip translation")
    _require(all(((block.get("derived", {}) or {}).get("role") == "reference_entry") for block in references[:10]), "paddle_sci_semantics: reference role mismatch")
    _require(all(((block.get("derived", {}) or {}).get("role") == "formula_number") for block in formula_numbers[:10]), "paddle_sci_semantics: formula number role mismatch")
    _require(((titles[0].get("derived", {}) or {}).get("role") == "title"), "paddle_sci_semantics: title role mismatch")
    _require(((abstracts[0].get("derived", {}) or {}).get("role") == "abstract"), "paddle_sci_semantics: abstract role mismatch")
    _require(any(block.get("metadata", {}).get("content_format") == "html_image" for block in images), "paddle_sci_semantics: expected rich image trace")
    _require(all(block.get("type") != "unknown" for block in blocks), "paddle_sci_semantics: unknown block types remain")
    print(
        "OK paddle_sci_semantics "
        f"titles={len(titles)} abstracts={len(abstracts)} references={len(references)} "
        f"formula_numbers={len(formula_numbers)} images={len(images)}"
    )
    return {
        "titles": len(titles),
        "abstracts": len(abstracts),
        "references": len(references),
        "formula_numbers": len(formula_numbers),
        "images": len(images),
    }


def _check_paddle_sci_extractor_policy(path: Path) -> dict:
    adapted = adapt_path_to_document_v1(
        source_json_path=path,
        document_id="regression-paddle-sci-extractor-policy",
        provider=PROVIDER_PADDLE,
    )
    items = []
    for page_idx in range(len(adapted["pages"])):
        items.extend(extract_text_items(adapted, page_idx))

    _require(items, "paddle_sci_extractor_policy: expected extracted items")
    abstracts = [item for item in items if str(((item.metadata or {}).get("structure_role") or "")).strip().lower() == "abstract"]
    references = [item for item in items if str(((item.metadata or {}).get("structure_role") or "")).strip().lower() == "reference_entry"]
    formula_numbers = [
        item for item in items if str(((item.metadata or {}).get("normalized_sub_type") or "")).strip().lower() == "formula_number"
    ]

    _require(abstracts, "paddle_sci_extractor_policy: abstract items should remain extractable")
    _require(not references, "paddle_sci_extractor_policy: reference entries should not enter extraction items")
    _require(not formula_numbers, "paddle_sci_extractor_policy: formula_number should not enter extraction items")

    abstract_flags = {_default_translation_flags(item.block_type, item.metadata) for item in abstracts}

    _require(
        any(should_translate for _, should_translate, _ in abstract_flags),
        "paddle_sci_extractor_policy: abstract should remain translatable by default",
    )

    print(
        "OK paddle_sci_extractor_policy "
        f"items={len(items)} abstracts={len(abstracts)} references={len(references)} formula_numbers={len(formula_numbers)}"
    )
    return {
        "items": len(items),
        "abstracts": len(abstracts),
        "references": len(references),
    }


def main() -> None:
    args = parse_args()
    new_document = Path(args.new_document)
    legacy_document = Path(args.legacy_document)
    validated_new = validate_document_path(new_document)
    validated_legacy = validate_document_path(legacy_document)
    raw_layout_entry = next(entry for entry in PROVIDER_FIXTURES if entry["name"] == "raw_layout")
    adapted_raw_document, _ = adapt_path_to_document_v1_with_report(
        source_json_path=Path(raw_layout_entry["path"]),
        document_id="regression-raw-layout-extractor",
    )

    adapted_reports: dict[str, dict] = {}
    for fixture in PROVIDER_FIXTURES:
        adapted_reports[fixture["name"]] = _check_adapted_document(
            f"{fixture['name']}_adapt",
            Path(fixture["path"]),
            document_id=str(fixture["document_id"]),
            expected_provider=str(fixture["provider"]),
        )

    report = {
        "registered_providers": _check_registered_providers(list_registered_ocr_adapters()),
        "validated_documents": {
            "new_document": _check_validated_document("new_document", new_document),
            "legacy_document": _check_validated_document("legacy_document", legacy_document),
        },
        "compat_upgrade": {
            "legacy_document": _check_legacy_upgrade(legacy_document),
        },
        "adapted_documents": adapted_reports,
        "explicit_provider": _check_explicit_provider(
            Path(raw_layout_entry["path"]),
            document_id="regression-raw-layout-explicit",
            provider=PROVIDER_MINERU,
        ),
        "extractor_smoke": {
            "new_document": _check_extractor_smoke("extractor_new_document", validated_new),
            "legacy_document": _check_extractor_smoke("extractor_legacy_document", validated_legacy),
            "adapted_raw_layout": _check_extractor_smoke("extractor_adapted_raw_layout", adapted_raw_document),
        },
        "provider_semantics": {
            "paddle_fixture": _check_paddle_semantics(
                next(Path(fixture["path"]) for fixture in PROVIDER_FIXTURES if fixture["provider"] == PROVIDER_PADDLE)
            ),
            "paddle_extractor_roles": _check_paddle_extractor_roles(
                next(Path(fixture["path"]) for fixture in PROVIDER_FIXTURES if fixture["name"] == "paddle_fixture")
            ),
            "paddle_sci_fixture": _check_paddle_sci_semantics(
                next(Path(fixture["path"]) for fixture in PROVIDER_FIXTURES if fixture["name"] == "paddle_sci_fixture")
            ),
            "paddle_sci_extractor_policy": _check_paddle_sci_extractor_policy(
                next(Path(fixture["path"]) for fixture in PROVIDER_FIXTURES if fixture["name"] == "paddle_sci_fixture")
            ),
        },
    }

    if args.write_report.strip():
        report_path = Path(args.write_report).resolve()
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"OK report {report_path}")


if __name__ == "__main__":
    main()
