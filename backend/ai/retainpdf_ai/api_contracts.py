"""HTTP request contracts exposed by the AI service."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class AskInput(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    document_id: str = ""
    job_id: str = ""
    conversation_id: str = ""
    parent_id: str = ""
    regenerate: bool = False
    user_message_id: str = ""
    assistant_message_id: str = ""
    stream: bool = False
    force_compress: bool = False
    confirm_document_operation: bool = False
    assistant_mode: Literal["auto", "reading", "operations"] = "auto"
    llm_api_key: str = ""
    llm_base_url: str = ""
    llm_model: str = ""


class RuntimeConfigUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expected_revision: int | None = Field(default=None, ge=0)
    agent_runtime: str | None = None
    agent_confirmation_mode: str | None = None
    llm_base_url: str | None = Field(default=None, max_length=2048)
    llm_model: str | None = Field(default=None, max_length=256)
    llm_api_key: str | None = Field(default=None, max_length=8192)
    llm_credential_ref: str | None = Field(default=None, max_length=64)
    clear_llm_api_key: bool = False
    fx_gateway_base_url: str | None = Field(default=None, max_length=2048)
    fx_gateway_api_key: str | None = Field(default=None, max_length=8192)
    fx_gateway_credential_ref: str | None = Field(default=None, max_length=64)
    clear_fx_gateway_api_key: bool = False
    fx_model: str | None = Field(default=None, max_length=256)
