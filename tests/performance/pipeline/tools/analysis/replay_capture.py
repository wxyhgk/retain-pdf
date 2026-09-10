"""Strict, fake-only replay of captured Python inputs. No provider/client/network path."""
import argparse
from copy import deepcopy
import json

from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from tools.analysis.inspect_capture import load_capture
from retainpdf_pipeline.translate.llm.shared.request_capture import digest


def batch_identity(batch):
    if not isinstance(batch, list) or not batch:
        raise ValueError("empty or invalid captured batch")
    identities = set()
    for item in batch:
        if not isinstance(item.get("item_id"), str) or not item["item_id"].strip():
            raise ValueError("captured item lacks stable identity")
        identities.add(item["item_id"].strip())
        identities.update(str(value) for value in item.get("translation_unit_member_ids", []) if value)
    return digest(["translation", sorted(identities)])


def prepare(root):
    """Validate complete coverage before invoking even the fake model.

    Missing requests (including cache hits) are rejected, not guessed or regenerated.
    Repairs are replayed as saved inputs, not decided from synthetic responses.
    """
    plans, requests = load_capture(root)
    if len(plans) != 1:
        raise ValueError("fake replay requires exactly one dispatch plan")
    plan_hash, plan = next(iter(plans.items()))
    units = [batch_identity(batch) for batch in plan["batches"]]
    if not units:
        raise ValueError("dispatch plan has no batches to replay")
    if len(units) != len(set(units)):
        raise ValueError("duplicate dispatch unit")
    operations = {}
    excluded = 0
    for request in requests:
        if request["plan_sha256"] is None:
            excluded += 1
            continue
        unit, purpose = request["unit_id"], request["purpose"]
        if request["plan_sha256"] != plan_hash or unit not in units:
            raise ValueError("request is outside dispatch plan")
        if purpose not in {"primary", "repair"} or request["operation_id"] != f"{unit}.{purpose}":
            raise ValueError("request operation identity mismatch")
        if (unit, purpose) in operations:
            raise ValueError("duplicate operation")
        if request.get("connection_fingerprint", "") != plan.get("engine_identity", {}).get("connection_fingerprint", ""):
            raise ValueError("captured connection fingerprint mismatch")
        messages = request.get("messages")
        if not isinstance(messages, list) or not messages or any(
            not isinstance(m, dict) or set(m) != {"role", "content"}
            or m["role"] not in {"system", "user", "assistant"} or not isinstance(m["content"], str)
            for m in messages
        ):
            raise ValueError("invalid captured messages")
        operations[unit, purpose] = request
    if any((unit, "primary") not in operations for unit in units):
        raise ValueError("missing primary capture; cache hits/incomplete captures cannot be replayed")
    ordered = [operations[unit, purpose] for unit in units for purpose in ("primary", "repair")
               if (unit, purpose) in operations]
    return deepcopy(plan), deepcopy(ordered), excluded


class FakeModel:
    """Deterministic content digest only; deliberately has no URL, key, SDK or transport."""
    def request(self, request):
        return {"fake": True, "input_sha256": digest(request)}


def replay(root):
    plan, requests, excluded = prepare(root)
    model = FakeModel()
    input_hashes = []
    for request in requests:
        original = digest(request)
        response = model.request(deepcopy(request))
        if response != {"fake": True, "input_sha256": original} or digest(request) != original:
            raise ValueError("fake replay changed captured input")
        input_hashes.append(original)
    return {
        "schema": "fake_capture_replay_v1", "fake_only": True,
        "dispatch_input_sha256": plan["input_sha256"],
        "planned_batches": len(plan["batches"]), "replayed_requests": len(requests),
        "replayed_repairs": sum(r["purpose"] == "repair" for r in requests),
        "excluded_preplan_requests": excluded, "ordered_request_sha256": digest(input_hashes),
        "note": "Saved batches and request messages only. Sequential queue-priority replay; "
                "not historical concurrent/completion order. No regrouping, prompt regeneration, "
                "real translation, repair decision, rendering, quality or performance evaluation.",
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory")
    args = parser.parse_args()
    print(json.dumps(replay(args.directory), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
