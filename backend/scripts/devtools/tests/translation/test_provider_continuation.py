import importlib.util
import sys
import tempfile
import types
from pathlib import Path


REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from services.document_schema.adapters import adapt_payload_to_document_v1
from services.document_schema.providers import PROVIDER_GENERIC_FLAT_OCR
from services.translation.ocr.json_extractor import extract_text_items
from services.translation.payload.translations import export_translation_template
from services.translation.payload.translations import load_translations


def _ensure_package_stubs() -> None:
    package_paths = {
        "services": REPO_SCRIPTS_ROOT / "services",
        "services.translation": REPO_SCRIPTS_ROOT / "services" / "translation",
        "services.translation.continuation": REPO_SCRIPTS_ROOT / "services" / "translation" / "continuation",
    }
    for name, path in package_paths.items():
        module = sys.modules.get(name)
        if module is None:
            module = types.ModuleType(name)
            module.__path__ = [str(path)]
            sys.modules[name] = module


def _load_module(name: str, path: Path):
    _ensure_package_stubs()
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def _load_state_module():
    _load_module(
        "services.translation.continuation.rules",
        REPO_SCRIPTS_ROOT / "services" / "translation" / "continuation" / "rules.py",
    )
    return _load_module(
        "services.translation.continuation.state",
        REPO_SCRIPTS_ROOT / "services" / "translation" / "continuation" / "state.py",
    )


def _payload_item(
    *,
    item_id: str,
    page_idx: int,
    text: str,
    bbox: list[float],
    ocr_source: str = "",
    ocr_group_id: str = "",
    ocr_scope: str = "",
    ocr_order: int = -1,
    layout_mode: str = "",
    layout_zone: str = "",
    layout_boundary_role: str = "",
) -> dict:
    return {
        "item_id": item_id,
        "page_idx": page_idx,
        "block_idx": 0,
        "block_type": "text",
        "bbox": bbox,
        "protected_source_text": text,
        "ocr_continuation_source": ocr_source,
        "ocr_continuation_group_id": ocr_group_id,
        "ocr_continuation_scope": ocr_scope,
        "ocr_continuation_reading_order": ocr_order,
        "layout_mode": layout_mode,
        "layout_zone": layout_zone,
        "layout_boundary_role": layout_boundary_role,
    }


def test_provider_intra_page_join_takes_priority_and_rule_fallback_still_runs() -> None:
    state = _load_state_module()
    payload = [
        _payload_item(
            item_id="a",
            page_idx=0,
            text="left column sentence",
            bbox=[0, 0, 100, 20],
            ocr_source="provider",
            ocr_group_id="provider-paddle-page-001-group-12",
            ocr_scope="intra_page",
            ocr_order=0,
        ),
        _payload_item(
            item_id="b",
            page_idx=0,
            text="right column continuation",
            bbox=[120, 0, 220, 20],
            ocr_source="provider",
            ocr_group_id="provider-paddle-page-001-group-12",
            ocr_scope="intra_page",
            ocr_order=1,
        ),
        _payload_item(
            item_id="c",
            page_idx=0,
            text="This sentence continues with",
            bbox=[0, 40, 180, 60],
        ),
        _payload_item(
            item_id="d",
            page_idx=1,
            text="and additional evidence from the experiment.",
            bbox=[0, 0, 180, 20],
        ),
    ]

    annotated = state.annotate_continuation_context(payload)
    summary = state.summarize_continuation_decisions(payload)

    assert annotated == 4
    assert payload[0]["continuation_decision"] == "provider_joined"
    assert payload[1]["continuation_decision"] == "provider_joined"
    assert payload[0]["continuation_group"] == "provider-paddle-page-001-group-12"
    assert payload[2]["continuation_decision"] == "joined"
    assert payload[3]["continuation_decision"] == "joined"
    assert summary["joined_items"] == 4
    assert summary["provider_joined_items"] == 2
    assert summary["rule_joined_items"] == 2


def test_provider_cross_page_boundary_pair_is_consumed() -> None:
    state = _load_state_module()
    payload = [
        _payload_item(
            item_id="a",
            page_idx=0,
            text="This sentence continues with",
            bbox=[0, 0, 180, 20],
            ocr_source="provider",
            ocr_group_id="provider-paddle-global-abc",
            ocr_scope="cross_page",
            ocr_order=0,
            layout_mode="single",
            layout_zone="single_column",
            layout_boundary_role="tail",
        ),
        _payload_item(
            item_id="b",
            page_idx=1,
            text="and additional evidence from the experiment.",
            bbox=[0, 0, 180, 20],
            ocr_source="provider",
            ocr_group_id="provider-paddle-global-abc",
            ocr_scope="cross_page",
            ocr_order=1,
            layout_mode="single",
            layout_zone="single_column",
            layout_boundary_role="head",
        ),
    ]

    state.annotate_continuation_context(payload)

    assert payload[0]["continuation_decision"] == "provider_joined"
    assert payload[1]["continuation_decision"] == "provider_joined"
    assert payload[0]["continuation_group"] == "provider-paddle-global-abc"


def test_provider_cross_page_hint_without_boundary_roles_falls_back_to_rules() -> None:
    state = _load_state_module()
    payload = [
        _payload_item(
            item_id="a",
            page_idx=0,
            text="This sentence continues with",
            bbox=[0, 0, 180, 20],
            ocr_source="provider",
            ocr_group_id="provider-paddle-global-abc",
            ocr_scope="cross_page",
            ocr_order=0,
        ),
        _payload_item(
            item_id="b",
            page_idx=1,
            text="and additional evidence from the experiment.",
            bbox=[0, 0, 180, 20],
            ocr_source="provider",
            ocr_group_id="provider-paddle-global-abc",
            ocr_scope="cross_page",
            ocr_order=1,
        ),
    ]

    state.annotate_continuation_context(payload)

    assert payload[0]["continuation_decision"] == "joined"
    assert payload[1]["continuation_decision"] == "joined"
    assert payload[0]["continuation_group"] != "provider-paddle-global-abc"


def test_provider_cross_page_hint_skipping_pages_is_not_consumed() -> None:
    state = _load_state_module()
    payload = [
        _payload_item(
            item_id="a",
            page_idx=0,
            text="This sentence continues with",
            bbox=[0, 0, 180, 20],
            ocr_source="provider",
            ocr_group_id="provider-paddle-global-abc",
            ocr_scope="cross_page",
            ocr_order=0,
            layout_boundary_role="tail",
        ),
        _payload_item(
            item_id="b",
            page_idx=2,
            text="and additional evidence from the experiment.",
            bbox=[0, 0, 180, 20],
            ocr_source="provider",
            ocr_group_id="provider-paddle-global-abc",
            ocr_scope="cross_page",
            ocr_order=1,
            layout_boundary_role="head",
        ),
    ]

    state.annotate_continuation_context(payload)

    assert payload[0]["continuation_decision"] == ""
    assert payload[1]["continuation_decision"] == ""
    assert payload[0]["continuation_group"] == ""


def test_provider_cross_page_double_column_left_tail_is_not_consumed() -> None:
    state = _load_state_module()
    payload = [
        _payload_item(
            item_id="a",
            page_idx=0,
            text="This sentence continues with",
            bbox=[0, 0, 100, 20],
            ocr_source="provider",
            ocr_group_id="provider-paddle-global-abc",
            ocr_scope="cross_page",
            ocr_order=0,
            layout_mode="double",
            layout_zone="left_column",
            layout_boundary_role="tail",
        ),
        _payload_item(
            item_id="b",
            page_idx=1,
            text="and additional evidence from the experiment.",
            bbox=[0, 0, 100, 20],
            ocr_source="provider",
            ocr_group_id="provider-paddle-global-abc",
            ocr_scope="cross_page",
            ocr_order=1,
            layout_mode="double",
            layout_zone="left_column",
            layout_boundary_role="head",
        ),
    ]

    state.annotate_continuation_context(payload)

    assert payload[0]["continuation_decision"] != "provider_joined"
    assert payload[0]["continuation_group"] != "provider-paddle-global-abc"


def test_provider_cross_page_short_fragments_are_not_consumed() -> None:
    state = _load_state_module()
    payload = [
        _payload_item(
            item_id="a",
            page_idx=0,
            text="A",
            bbox=[0, 0, 180, 20],
            ocr_source="provider",
            ocr_group_id="provider-paddle-global-abc",
            ocr_scope="cross_page",
            ocr_order=0,
            layout_mode="single",
            layout_zone="single_column",
            layout_boundary_role="tail",
        ),
        _payload_item(
            item_id="b",
            page_idx=1,
            text="B",
            bbox=[0, 0, 180, 20],
            ocr_source="provider",
            ocr_group_id="provider-paddle-global-abc",
            ocr_scope="cross_page",
            ocr_order=1,
            layout_mode="single",
            layout_zone="single_column",
            layout_boundary_role="head",
        ),
    ]

    state.annotate_continuation_context(payload)

    assert payload[0]["continuation_decision"] != "provider_joined"
    assert payload[0]["continuation_group"] != "provider-paddle-global-abc"


def test_generic_provider_continuation_hint_flows_through_extractor_and_template() -> None:
    state = _load_state_module()
    adapted = adapt_payload_to_document_v1(
        payload={
            "provider": PROVIDER_GENERIC_FLAT_OCR,
            "pages": [
                {
                    "width": 240.0,
                    "height": 200.0,
                    "unit": "pt",
                    "blocks": [
                        {
                            "type": "text",
                            "sub_type": "body",
                            "bbox": [0, 0, 100, 20],
                            "text": "left column sentence",
                            "lines": [
                                {
                                    "bbox": [0, 0, 100, 20],
                                    "spans": [
                                        {
                                            "type": "text",
                                            "raw_type": "text",
                                            "text": "left column sentence",
                                            "bbox": [0, 0, 100, 20],
                                        }
                                    ],
                                }
                            ],
                            "segments": [],
                            "tags": [],
                            "derived": {"role": "", "by": "", "confidence": 0.0},
                            "continuation_hint": {
                                "source": "provider",
                                "group_id": "provider-generic-group-1",
                                "role": "head",
                                "scope": "intra_page",
                                "reading_order": 0,
                                "confidence": 0.91,
                            },
                            "metadata": {},
                        },
                        {
                            "type": "text",
                            "sub_type": "body",
                            "bbox": [120, 0, 220, 20],
                            "text": "right column continuation",
                            "lines": [
                                {
                                    "bbox": [120, 0, 220, 20],
                                    "spans": [
                                        {
                                            "type": "text",
                                            "raw_type": "text",
                                            "text": "right column continuation",
                                            "bbox": [120, 0, 220, 20],
                                        }
                                    ],
                                }
                            ],
                            "segments": [],
                            "tags": [],
                            "derived": {"role": "", "by": "", "confidence": 0.0},
                            "continuation_hint": {
                                "source": "provider",
                                "group_id": "provider-generic-group-1",
                                "role": "tail",
                                "scope": "intra_page",
                                "reading_order": 1,
                                "confidence": 0.91,
                            },
                            "metadata": {},
                        },
                    ],
                }
            ],
        },
        provider=PROVIDER_GENERIC_FLAT_OCR,
        document_id="generic-continuation-doc",
        source_json_path=Path("/tmp/generic-continuation.json"),
    )

    blocks = adapted["pages"][0]["blocks"]
    assert blocks[0]["continuation_hint"]["group_id"] == "provider-generic-group-1"
    assert blocks[1]["continuation_hint"]["role"] == "tail"

    items = extract_text_items(adapted, 0)
    assert len(items) == 2
    assert items[0].metadata["continuation_hint"]["source"] == "provider"

    with tempfile.TemporaryDirectory() as tmp:
        translation_path = Path(tmp) / "page-001.json"
        export_translation_template(items, translation_path, page_idx=0)
        payload = load_translations(translation_path)

    assert payload[0]["ocr_continuation_group_id"] == "provider-generic-group-1"
    assert payload[1]["ocr_continuation_role"] == "tail"

    annotated = state.annotate_continuation_context(payload)

    assert annotated == 2
    assert payload[0]["continuation_decision"] == "provider_joined"
    assert payload[1]["continuation_decision"] == "provider_joined"
    assert payload[0]["continuation_group"] == "provider-generic-group-1"
