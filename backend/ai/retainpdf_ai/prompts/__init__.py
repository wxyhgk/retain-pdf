"""Versioned prompt builders for RetainPDF AI runtimes.

Prompts describe model behavior. They never grant authority: document scope,
confirmation and effectful commands remain enforced by the host broker and
Rust control plane.
"""

from .agent import (
    PROMPT_VERSION,
    build_fx_workspace_instructions,
    build_operation_context_block,
    build_operation_system_prompt,
    build_reading_system_prompt,
)

__all__ = [
    "PROMPT_VERSION",
    "build_fx_workspace_instructions",
    "build_operation_context_block",
    "build_operation_system_prompt",
    "build_reading_system_prompt",
]
