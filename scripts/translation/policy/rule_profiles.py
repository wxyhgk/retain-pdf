from __future__ import annotations

from dataclasses import dataclass
import sqlite3
from pathlib import Path

from common.prompt_loader import load_prompt


DEFAULT_RULE_PROFILE_NAME = "general_sci"
KNOWN_RULE_PROFILE_NAMES = {
    "general",
    "general_sci",
    "computational_chemistry",
    "software_manual",
}


@dataclass(frozen=True)
class RuleProfileContext:
    profile_name: str
    profile_text: str
    custom_rules_text: str

    @property
    def merged_text(self) -> str:
        parts = []
        if self.profile_text.strip():
            parts.append(self.profile_text.strip())
        if self.custom_rules_text.strip():
            parts.append("User custom rules:\n" + self.custom_rules_text.strip())
        return "\n\n".join(parts).strip()


def normalize_rule_profile_name(profile_name: str) -> str:
    normalized = (profile_name or "").strip().lower().replace("-", "_")
    if not normalized:
        return DEFAULT_RULE_PROFILE_NAME
    if normalized == "general":
        return DEFAULT_RULE_PROFILE_NAME
    return normalized


def resolve_rule_profile_prompt_name(profile_name: str) -> str:
    normalized = normalize_rule_profile_name(profile_name)
    return f"rule_profile_{normalized}.txt"


def load_rule_profile_text(profile_name: str) -> str:
    return load_prompt(resolve_rule_profile_prompt_name(profile_name))


def _saved_rule_profiles_db_path() -> Path:
    return Path(__file__).resolve().parents[3] / "Fast_API" / "jobs.db"


def load_saved_rule_profile_text(profile_name: str) -> str:
    db_path = _saved_rule_profiles_db_path()
    if not db_path.exists():
        return ""
    try:
        conn = sqlite3.connect(db_path)
        try:
            row = conn.execute(
                "SELECT profile_text FROM rule_profiles WHERE name = ?",
                (profile_name,),
            ).fetchone()
        finally:
            conn.close()
    except sqlite3.Error:
        return ""
    if not row:
        return ""
    return str(row[0] or "").strip()


def build_rule_profile_context(profile_name: str = "", custom_rules_text: str = "") -> RuleProfileContext:
    resolved_name = normalize_rule_profile_name(profile_name)
    profile_text = ""
    if resolved_name in KNOWN_RULE_PROFILE_NAMES:
        profile_text = load_rule_profile_text(resolved_name)
    else:
        profile_text = load_saved_rule_profile_text(resolved_name)
        if not profile_text:
            profile_text = load_rule_profile_text(DEFAULT_RULE_PROFILE_NAME)
            resolved_name = DEFAULT_RULE_PROFILE_NAME
    return RuleProfileContext(
        profile_name=resolved_name,
        profile_text=profile_text,
        custom_rules_text=(custom_rules_text or "").strip(),
    )


__all__ = [
    "DEFAULT_RULE_PROFILE_NAME",
    "KNOWN_RULE_PROFILE_NAMES",
    "RuleProfileContext",
    "build_rule_profile_context",
    "load_rule_profile_text",
    "normalize_rule_profile_name",
    "resolve_rule_profile_prompt_name",
]
