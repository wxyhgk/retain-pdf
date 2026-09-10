"""Crash after durable translated output, then resume through the public entry."""
import hashlib
import json
from queue import Empty, Queue
import subprocess
from threading import Thread
import time

import pytest

from support.translation_io_support import (
    SOURCES, TRANSLATIONS, command, environment, prepare, read_artifacts, run,
)


def _read_output(stream, queue):
    try:
        for line in stream:
            queue.put(line)
    finally:
        queue.put(None)


def _durable_translations(root, event):
    """Cross-check public event against checkpoint and actual page bytes."""
    output = root / "translated"
    checkpoint = json.loads((output / "translation-checkpoint.v1.json").read_text())
    assert checkpoint["status"] == "in_progress"
    assert checkpoint["phase"] == event["phase"] == "translating"
    assert checkpoint["committed_pages_event"] == event
    assert not (output / "translation-manifest.json").exists()
    pages = {page["page_index"]: page for page in checkpoint["pages"]}
    committed = {}
    for change in event["committed_pages"]:
        page = pages[change["page_index"]]
        raw = (output / page["path"]).read_bytes()
        assert hashlib.sha256(raw).hexdigest() == page["page_hash"] == change["page_hash"]
        rows = {item["item_id"]: item for item in json.loads(raw)}
        for identity in change["changed_item_ids"]:
            item = rows[identity]
            if identity in TRANSLATIONS and item["translated_text"] == TRANSLATIONS[identity]:
                assert item["source_text"] == SOURCES[identity]
                assert item["should_translate"] is True
                committed[identity] = item["translated_text"]
    assert committed, "Must interrupt after actual translation, not skip/preparation metadata"
    assert set(committed) < set(TRANSLATIONS), "Must leave unfinished translation work"
    return committed


@pytest.mark.parametrize("attempt", range(3))
def test_translation_resumes_durable_output_without_retranslating(tmp_path, attempt):
    root = prepare(tmp_path / f"crash-{attempt}", workers=1, outcome="block_after_commit")
    queue = Queue()
    process = subprocess.Popen(
        command(root), env=environment(root), stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT, text=True, encoding="utf-8",
    )
    reader = Thread(target=_read_output, args=(process.stdout, queue), daemon=True)
    reader.start()
    lines, checkpoints = [], []
    blocked = False
    try:
        deadline = time.monotonic() + 30
        while not blocked:
            remaining = deadline - time.monotonic()
            assert remaining > 0, "Timed out waiting for durable translation:\n" + "".join(lines)
            try:
                line = queue.get(timeout=remaining)
            except Empty:
                pytest.fail("No checkpoint/block signal:\n" + "".join(lines))
            assert line is not None, "Probe exited before interruption:\n" + "".join(lines)
            lines.append(line)
            try:
                event = json.loads(line)
            except ValueError:
                continue
            if event.get("event_type") == "pipeline_checkpoint":
                payload = event["payload"]
                if payload["phase"] == "translating" and payload["committed_pages"]:
                    checkpoints.append(payload)
            elif event.get("event_type") == "probe_blocked":
                blocked = True
        assert checkpoints, "Block must follow a real public translation checkpoint"
        assert process.poll() is None
        committed = _durable_translations(root, checkpoints[-1])
        first_calls = json.loads((root / "calls.json").read_text())
        assert set(committed) <= {
            identity for call in first_calls if call.get("kind") == "translation"
            for identity in call.get("members", [])
        }
        process.terminate()
        process.wait(timeout=5)
    finally:
        if process.poll() is None:
            process.kill()
            process.wait(timeout=5)
        reader.join(timeout=5)
        process.stdout.close()
    assert not reader.is_alive(), "Output reader leaked after subprocess cleanup"

    # Change only the fake transport fault: document, production configuration,
    # output directory and durable checkpoint are exactly those of the killed run.
    spec_path = root / "spec.json"
    spec = json.loads(spec_path.read_text())
    spec["outcome"] = "success"
    spec_path.write_text(json.dumps(spec), encoding="utf-8")
    result = run(root)
    assert result["ok"], result
    assert result["violations"] == []
    requested = {
        identity for call in result["calls"] if call.get("kind") == "translation"
        for identity in call.get("members", [])
    }
    assert not requested.intersection(committed), "Committed members were sent to model again"
    assert requested == set(TRANSLATIONS) - set(committed)
    pages, manifest, checkpoint = read_artifacts(root)
    items = [item for page in pages.values() for item in page]
    rows = {item["item_id"]: item for item in items}
    assert len(items) == len(rows) == len(SOURCES)
    assert set(rows) == set(SOURCES)
    for identity, expected in TRANSLATIONS.items():
        assert rows[identity]["translated_text"] == expected
        assert rows[identity]["source_text"] == SOURCES[identity]
    assert checkpoint["status"] == "complete"
    assert checkpoint["phase"] == "committed"
    assert checkpoint["progress"]["pending_item_count"] == 0
    assert checkpoint["final_manifest"] == "translation-manifest.json"
    assert {page["page_index"] for page in manifest["pages"]} == {0, 1}
