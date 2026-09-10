import json
import sys
from pathlib import Path

REPO_SCRIPTS_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(REPO_SCRIPTS_ROOT))


from retainpdf_pipeline.ocr.document_schema.validator import (
    default_schema_json_path,
)
from retainpdf_pipeline.ocr.document_schema.vocabulary import (
    BLOCK_CLASSES,
    BLOCK_TYPES,
    CONTENT_KINDS,
    LAYOUT_ROLES,
    SEGMENT_TYPES,
    SEMANTIC_ROLES,
    STRUCTURE_ROLES,
)


def _schema() -> dict:
    return json.loads(default_schema_json_path().read_text(encoding="utf-8"))


def test_closed_python_vocabularies_match_machine_schema() -> None:
    definitions = _schema()["$defs"]
    block_properties = definitions["block"]["properties"]

    assert tuple(definitions["content"]["properties"]["kind"]["enum"]) == CONTENT_KINDS
    assert tuple(definitions["segment"]["properties"]["type"]["enum"]) == SEGMENT_TYPES
    assert set(block_properties["type"]["enum"]) == set(BLOCK_TYPES)
    assert tuple(block_properties["block_class"]["enum"]) == BLOCK_CLASSES
    assert tuple(block_properties["layout_role"]["enum"]) == LAYOUT_ROLES
    assert tuple(block_properties["semantic_role"]["enum"]) == SEMANTIC_ROLES


def test_structure_role_is_typed_but_remains_an_open_v1_1_extension_point() -> None:
    structure_role_schema = _schema()["$defs"]["block"]["properties"][
        "structure_role"
    ]

    assert structure_role_schema["type"] == "string"
    assert "enum" not in structure_role_schema
    assert len(STRUCTURE_ROLES) == len(set(STRUCTURE_ROLES))
