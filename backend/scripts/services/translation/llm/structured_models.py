from __future__ import annotations


DOMAIN_CONTEXT_RESPONSE_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "domain_context_response",
        "strict": True,
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "domain": {"type": "string"},
                "summary": {"type": "string"},
                "translation_guidance": {"type": "string"},
            },
            "required": ["domain", "summary", "translation_guidance"],
        },
    },
}


CONTINUATION_REVIEW_RESPONSE_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "continuation_review_response",
        "strict": True,
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "decisions": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "pair_id": {"type": "string"},
                            "decision": {"type": "string", "enum": ["join", "break"]},
                        },
                        "required": ["pair_id", "decision"],
                    },
                }
            },
            "required": ["decisions"],
        },
    },
}


GARBLED_RECONSTRUCTION_RESPONSE_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "garbled_reconstruction_response",
        "strict": True,
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "translated_text": {"type": "string"},
            },
            "required": ["translated_text"],
        },
    },
}
