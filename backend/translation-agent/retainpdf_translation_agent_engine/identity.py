"""翻译引擎 agent 的身份：交接格式、提示词或检查规则换了，旧断点、旧状态不再沿用。

以前在翻译包的 `core/engine_identity.py`（2026-11-20 拆包第 3 步挪来）：底座的断点身份经引擎登记表
（`EngineSpec.checkpoint_identity`）取它，不再直接 import agent 包。
"""

from __future__ import annotations

import retainpdf_translation_agent as agent


def agent_engine_identity() -> dict[str, str]:
    # 每次现读（测试会替换包上的版本号）
    return {
        "agent_contract_version": agent.CONTRACT_VERSION,
        "agent_prompt_version": agent.PROMPT_VERSION,
        "agent_checks_version": agent.CHECKS_VERSION,
    }


__all__ = ["agent_engine_identity"]
