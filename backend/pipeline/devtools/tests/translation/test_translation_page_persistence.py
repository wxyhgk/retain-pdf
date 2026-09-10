from copy import deepcopy
import json

from retainpdf_pipeline.translate.core.orchestration.units import refresh_translation_units_by_page
from retainpdf_pipeline.translate.services.results.page_io import save_pages


def payload():
    return {index: [{"item_id": f"p00{index + 1}-b000", "page_idx": index,
                     "source_text": text, "protected_source_text": text,
                     "continuation_group": "cross-page", "should_translate": True}]
            for index, text in enumerate(["A sentence begins", "and continues here."])}


def test_saving_selected_page_does_not_prepare_or_mutate_any_payload(tmp_path):
    pages = payload()
    before = deepcopy(pages)
    paths = {index: tmp_path / f"page-{index}.json" for index in pages}
    save_pages(pages, paths, {0})
    assert pages == before
    assert json.loads(paths[0].read_text()) == before[0]
    assert not paths[1].exists()
    assert "translation_unit_id" not in pages[0][0]


def test_explicit_preparation_creates_group_before_mutation_free_save(tmp_path):
    pages = payload()
    refresh_translation_units_by_page(pages)
    assert pages[0][0]["translation_unit_member_ids"] == ["p001-b000", "p002-b000"]
    assert pages[1][0]["translation_unit_id"] == pages[0][0]["translation_unit_id"]
    before = deepcopy(pages)
    paths = {index: tmp_path / f"page-{index}.json" for index in pages}
    save_pages(pages, paths)
    assert pages == before
    assert {index: json.loads(path.read_text()) for index, path in paths.items()} == before


def test_explicit_legacy_refresh_keyword_remains_available(tmp_path):
    pages = payload()
    paths = {index: tmp_path / f"page-{index}.json" for index in pages}
    save_pages(pages, paths, refresh_units=True)
    assert pages[0][0]["translation_unit_member_ids"] == ["p001-b000", "p002-b000"]
