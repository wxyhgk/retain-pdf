from copy import deepcopy
import json
from pathlib import Path
import socket
import sqlite3
import sys

import pytest

from tools.analysis.audit_prompts import audit, reconstruct, unit_hash


def item(identity, **extra):
    return {"item_id": identity, "protected_source_text": "PRIVATE_SOURCE energy is conserved.",
            "source_text": "PRIVATE_SOURCE energy is conserved.", "math_mode": "direct_typst",
            "translation_unit_kind": "single", "translation_unit_member_ids": [identity], **extra}


def test_reconstruction_requires_hash_match_and_preserves_inputs():
    items = {i: item(i) for i in ("a", "b")}
    original = deepcopy(items)
    assert reconstruct(items, unit_hash([items["a"]]), "translation")[0] == "single"
    content = "<<<ITEM item_id=a>>>\nA\n<<<END>>>\n<<<ITEM item_id=b>>>\nB\n<<<END>>>"
    assert reconstruct(items, unit_hash(list(items.values())), content)[0] == "batch"
    assert reconstruct(items, "wrong_hash", content) is None
    assert reconstruct(items, unit_hash(list(items.values())), content.replace("item_id=b", "item_id=a")) is None
    assert items == original


def test_group_reconstruction_checks_saved_membership():
    group_id = "__cg__:g"
    items = {i: item(i, translation_unit_id=group_id, translation_unit_kind="group",
                     translation_unit_member_ids=["a", "b"], continuation_group="g") for i in ("a", "b")}
    original = deepcopy(items)
    content = json.dumps({"member_translations": [{"item_id": i, "translated_text": "x"} for i in items]})
    expected_hash = unit_hash([{"item_id": group_id, "translation_unit_member_ids": ["a", "b"]}])
    assert reconstruct(items, expected_hash, content)[0] == "group"
    assert items == original
    items["b"]["translation_unit_id"] = "__cg__:other"
    assert reconstruct(items, expected_hash, content) is None


def test_audit_is_offline_private_and_filters_job(tmp_path, monkeypatch):
    def forbid_network(*args, **kwargs):
        raise AssertionError("offline audit must not access network")
    monkeypatch.setattr(socket, "socket", forbid_network)
    pages = tmp_path / "data/jobs/j/translated"
    pages.mkdir(parents=True)
    page = pages / "page-001-deepseek.json"
    value = item("a")
    page.write_text(json.dumps([value]))
    report = tmp_path / "report.json"
    report.write_text('{"job_id":"j"}')
    db_path = tmp_path / "data/db/jobs.db"
    db_path.parent.mkdir()
    with sqlite3.connect(db_path) as db:
        db.execute("CREATE TABLE model_operations(job_id,unit_id,purpose,status,result_json)")
        receipt = json.dumps({"content": "PRIVATE_TRANSLATION", "input_tokens": 42})
        db.executemany("INSERT INTO model_operations VALUES(?,?,?,?,?)", [
            ("j", unit_hash([value]), "primary", "succeeded", receipt),
            ("j", unit_hash([value]), "repair", "succeeded", receipt),
            ("other", "unknown", "primary", "succeeded", receipt),
        ])
    before = {p: p.read_bytes() for p in (page, report, db_path)}
    result = audit(report)
    assert result["receipt_count"] == 2
    assert result["reconstructed_count"] == 1
    assert result["routes"]["single"]["unknown_historical_output_tokens"] == 1
    assert "PRIVATE" not in json.dumps(result)
    assert all(p.read_bytes() == data for p, data in before.items())
    report.write_text('{"job_id":".."}')
    with pytest.raises(ValueError, match="invalid job ID"):
        audit(report)
