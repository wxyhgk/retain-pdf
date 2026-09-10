"""ai-conversations.v1 契约锁（消费者侧：ai_service）。

后端测试镜像在 backend-root/contracts/ai-conversations.v1.schema.json。ai_service
访问会话 API 的唯一咽喉是 rust_client.py——本测试源码扫描它：请求路径
必须是契约端点、写入载荷的键必须 ⊆ 契约输入字段。生产侧锁在 rust_api
src/api_tests/conversations_contract.rs，前端锁在
frontend/tests/ai-conversations-contract.test.mjs。
"""

from __future__ import annotations

import json
import re
from pathlib import Path

AI_SERVICE_ROOT = Path(__file__).resolve().parents[1]
# backend/ai/tests -> backend root; this remains stable in an extracted services repo.
BACKEND_ROOT = Path(__file__).resolve().parents[2]
SCHEMA_PATH = BACKEND_ROOT / "contracts" / "ai-conversations.v1.schema.json"
SCHEMA = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
CLIENT_SOURCE = (AI_SERVICE_ROOT / "retainpdf_ai" / "rust_client.py").read_text(encoding="utf-8")

BASE_PATH = SCHEMA["base_path"]


def _contract_path_patterns() -> list[re.Pattern[str]]:
    patterns = []
    for endpoint in SCHEMA["endpoints"]:
        # 契约的 :conversation_id 段对应 f-string 的 {expr} 插值
        regex = "^" + re.escape(endpoint["path"]) + "$"
        regex = regex.replace(re.escape(":conversation_id"), r"\{[^}]+\}")
        patterns.append(re.compile(regex))
    return patterns


def test_client_paths_are_contract_endpoints() -> None:
    used_paths = [
        path
        for path in re.findall(
            r"[\"'](/api/v1/ai/conversations[^\"']*)[\"']", CLIENT_SOURCE
        )
        # Conversation-scoped operations and calculations have dedicated
        # contracts; ai-conversations.v1 owns only CRUD/message-tree paths.
        if not path.endswith(("/operations", "/calculations"))
    ]
    assert used_paths, "rust_client.py 中未找到会话 API 路径——扫描逻辑可能失效"

    patterns = _contract_path_patterns()
    for path in used_paths:
        assert any(p.match(path) for p in patterns), (
            f"rust_client.py 使用了契约之外的路径: {path}"
        )


def test_operation_context_uses_the_public_conversation_scoped_projection() -> None:
    assert "/api/v1/ai/conversations/{normalized}/operations" in CLIENT_SOURCE


def _payload_keys_near(function_name: str) -> set[str]:
    """提取函数体内 payload 字面量/赋值用到的键。"""
    start = CLIENT_SOURCE.index(f"def {function_name}")
    tail = CLIENT_SOURCE[start:]
    end = tail.index("\n    def ", 1) if "\n    def " in tail[1:] else len(tail)
    body = tail[:end]
    keys = set(re.findall(r"[\"']([a-z_]+)[\"']\s*:", body))
    keys.update(re.findall(r"payload\[[\"']([a-z_]+)[\"']\]", body))
    return keys


def test_write_payload_keys_subset_of_contract_inputs() -> None:
    cases = {
        "create_conversation": "CreateConversationInput",
        "append_conversation_message": "AppendMessageInput",
        "patch_conversation": "PatchConversationInput",
    }
    for function_name, definition in cases.items():
        allowed = set(SCHEMA["definitions"][definition]["properties"])
        used = _payload_keys_near(function_name)
        assert used, f"{function_name} 未提取到任何载荷键——扫描逻辑可能失效"
        unknown = used - allowed
        assert not unknown, (
            f"{function_name} 写入了契约外字段 {sorted(unknown)}（契约 {definition}）"
        )


def test_append_required_fields_always_sent() -> None:
    required = set(SCHEMA["definitions"]["AppendMessageInput"]["required"])
    used = _payload_keys_near("append_conversation_message")
    missing = required - used
    assert not missing, f"append_conversation_message 缺契约必填字段: {sorted(missing)}"
