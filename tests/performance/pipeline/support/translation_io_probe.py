"""Only external model transports are replaced; all business stages remain real."""
from contextlib import ExitStack
import json
import os
import re
from pathlib import Path
import socket
import sys
import threading
import time
import traceback
from types import SimpleNamespace
from unittest.mock import Mock, patch
import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from support.translation_io_support import SOURCES, TRANSLATIONS
from support.offline import network_guard, forbid_private_data


def main():
    spec = json.loads(Path(sys.argv[1]).read_text())
    root = Path(sys.argv[1]).parent
    os.environ["RETAIN_TRANSLATION_TRANSPORT"] = spec["transport"]
    calls, violations, unknown_requests = [], [], []
    lock = threading.Lock()
    concurrent_started = threading.Barrier(2, timeout=5)
    def forbidden(*args, **kwargs):
        violations.append("unexpected external I/O: " + "".join(traceback.format_stack(limit=5)))
        raise AssertionError(violations[-1])
    with ExitStack() as stack:
        stack.enter_context(network_guard(forbidden))
        forbid_private_data()
        from retainpdf_pipeline.translate.translation_stage import translate_book_pipeline
        from retainpdf_pipeline.translate.llm.shared import executor_context
        from retainpdf_pipeline.translate.llm.shared.rust_executor import ExecutorError
        from retainpdf_pipeline.translate.llm.providers.deepseek import client

        def _answer(messages, **kwargs):
            user = messages[-1]["content"]
            # Match the response protocol and source identities, not prompt bytes.
            try:
                payload = json.loads(user)
            except ValueError:
                payload = {}
            if not isinstance(payload, dict):
                raise TypeError("model request JSON must be an object")
            kind = "translation"
            protocol = "single"
            if {"item_id", "source_text", "current_translation", "issues"} <= payload.keys():
                protocol = "agent_repair"
                ids = [payload["item_id"]]
                if payload["source_text"] != SOURCES.get(ids[0]):
                    violations.append("unknown repair source")
                    raise AssertionError(violations[-1])
                content = json.dumps({"repaired_text": TRANSLATIONS[ids[0]],
                    "applied_issue_kinds": [issue["kind"] for issue in payload["issues"]],
                    "confidence": 1.0, "needs_manual_review": False, "notes": ""})
            elif "pairs" in payload:
                kind = "continuation"
                pairs = payload["pairs"]
                for pair in pairs:
                    if (pair["prev_text"] != SOURCES.get(pair["prev_item_id"]) or
                            pair["next_text"] != SOURCES.get(pair["next_item_id"])):
                        violations.append("unknown continuation source")
                        raise AssertionError(violations[-1])
                ids = sorted({pair[key] for pair in pairs for key in ("prev_item_id", "next_item_id")})
                content = json.dumps({"decisions": [{"pair_id": pair["pair_id"],
                    "decision": "join" if (pair["prev_item_id"], pair["next_item_id"]) ==
                    ("p001-b003", "p002-b000") else "break"} for pair in pairs]})
            elif "group" in payload:
                protocol = "group"
                members = payload["group"]["members"]
                ids = [member["item_id"] for member in members]
                if any(member["source_text"] != SOURCES.get(member["item_id"]) for member in members):
                    violations.append("unknown group member source")
                    raise AssertionError(violations[-1])
                content = json.dumps({"member_translations": [
                    {"item_id": key, "translated_text": TRANSLATIONS[key]} for key in ids]})
            elif re.search(r"^原文 p\d+-b\d+:", user, re.M):
                protocol = "batch"
                members = re.findall(r"^原文 (p\d+-b\d+):\n([^\n]+)", user, re.M)
                ids = [key for key, _ in members]
                if not ids or len(set(ids)) != len(ids) or any(
                    source != SOURCES.get(key) for key, source in members
                ):
                    violations.append("unknown batch member source")
                    raise AssertionError(violations[-1])
                response_ids = list(reversed(ids))
                first_batch = not any(call.get("protocol") == "batch" for call in calls)
                if first_batch and spec["outcome"] == "batch_missing":
                    response_ids.remove(ids[0])
                if spec["outcome"] == "batch_exhaust" and "p002-b001" in response_ids:
                    response_ids.remove("p002-b001")
                if first_batch and spec["outcome"] == "batch_duplicate":
                    response_ids.append(ids[0])
                replies = [(key, TRANSLATIONS[key]) for key in response_ids]
                if first_batch and spec["outcome"] == "batch_duplicate":
                    # A conflicting duplicate must not silently overwrite the
                    # first member with another member's plausible translation.
                    replies[-1] = (ids[0], TRANSLATIONS[ids[-1]])
                content = "\n".join(
                    f"<<<ITEM item_id={key}>>>\n{text}\n<<<END>>>" for key, text in replies
                )
            else:
                if not payload and user.strip() in SOURCES.values():
                    current = user.strip()  # Legacy raw-source fallback protocol.
                elif not payload and "【当前原文开始】" in user and "【当前原文结束】" in user:
                    current = user.split("【当前原文开始】", 1)[1].split("【当前原文结束】", 1)[0].strip()
                else:
                    unknown_requests.append(user)
                    violations.append("unrecognized model protocol")
                    raise AssertionError(violations[-1])
                ids = [key for key, source in SOURCES.items() if source == current and key in TRANSLATIONS]
                if len(ids) != 1:
                    violations.append("unrecognized model source")
                    raise AssertionError(violations[-1])
                content = TRANSLATIONS[ids[0]]
            if spec["outcome"] == "block_after_commit" and kind == "translation":
                checkpoint_path = Path(spec["output"]) / "translation-checkpoint.v1.json"
                if checkpoint_path.exists():
                    checkpoint = json.loads(checkpoint_path.read_text())
                    if checkpoint.get("phase") == "translating" and any(
                        set(page.get("changed_item_ids", [])) & TRANSLATIONS.keys()
                        for page in checkpoint.get("committed_pages", [])
                    ):
                        print(json.dumps({"event_type": "probe_blocked", "members": ids}), flush=True)
                        if not threading.Event().wait(25):
                            raise TimeoutError("parent did not terminate blocked probe")
            with lock:
                record = dict(kind=kind, protocol=protocol, members=ids, messages=messages,
                              purpose=kwargs.get("purpose"), unit_id=kwargs.get("unit_id"))
                if protocol == "batch":
                    record["response_members"] = response_ids
                    record["response_content"] = content
                calls.append(record)
                (root / "calls.json").write_text(json.dumps(calls, ensure_ascii=False))
                attempts = sum(c["kind"] == "translation" and "p001-b000" in c["members"] for c in calls)
            if spec["outcome"] == "concurrent_failure" and kind == "translation":
                if ids not in (["p001-b000"], ["p001-b001"]):
                    violations.append("new translation dispatched after concurrent failure")
                    raise AssertionError(violations[-1])
                concurrent_started.wait()
                if ids == ["p001-b000"]:
                    raise ExecutorError("synthetic concurrent failure")
                # Observe the real runtime latch; do not set it or bypass the
                # production request/worker error handling. This success was
                # already in flight when the other unit failed.
                deadline = time.monotonic() + 5
                while executor_context.runtime().failure is None:
                    if time.monotonic() >= deadline:
                        violations.append("concurrent failure did not latch")
                        raise AssertionError(violations[-1])
                    threading.Event().wait(0.01)
                record["returned_after_failure_latched"] = True
            if kind == "translation" and "p001-b000" in ids:
                if spec["outcome"] == "transport":
                    if spec["transport"] == "rust":
                        raise ExecutorError("synthetic transport failure")
                    raise requests.ConnectionError("synthetic transport failure")
                if spec["outcome"] == "protocol" or (spec["outcome"] == "repair" and attempts == 1):
                    return ""
            return content

        def answer(messages, **kwargs):
            try:
                return _answer(messages, **kwargs)
            except (KeyError, TypeError, IndexError) as error:
                # Legacy may recover from ordinary parser errors; keep a durable
                # test violation so that recovery cannot hide an unknown request.
                violations.append("invalid synthetic request structure: " + type(error).__name__)
                raise

        def request(**kwargs):
            return SimpleNamespace(content=answer(**kwargs))
        def post(url, **kwargs):
            payload = kwargs["json"]
            response = Mock(status_code=200)
            response.json.return_value = {"choices": [{"message": {"content": answer(payload["messages"])}}]}
            return response
        stack.enter_context(patch.object(executor_context, "_runtime", executor_context.ExecutorRuntime(SimpleNamespace(request=request))))
        stack.enter_context(patch.object(client, "get_session", return_value=SimpleNamespace(post=post)))
        stack.enter_context(patch.object(client, "_prewarm_dns"))
        stack.enter_context(patch.object(client, "should_use_stream_responses", return_value=False))
        result = {"ok": False}
        try:
            translate_book_pipeline(source_json_path=Path(spec["source"]), output_dir=Path(spec["output"]),
                api_key="synthetic", model="qwen3.8-flash", base_url="https://example.invalid/v1",
                workers=spec["workers"], batch_size=spec.get("batch_size", 1), mode="fast", math_mode="direct_typst",
                context_mode="off", memory_mode="off", glossary_mode="off",
                start_page=spec["start_page"], end_page=spec["end_page"])
            result["ok"] = True
        except Exception as error:
            result.update(error_type=type(error).__name__, error=str(error))
        result.update(calls=calls, violations=violations, unknown_requests=unknown_requests)
        (root / "result.json").write_text(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
