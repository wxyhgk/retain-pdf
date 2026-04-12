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


TRANSLATION_BATCH_RESPONSE_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "translation_batch_response",
        "strict": True,
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "translations": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "item_id": {"type": "string"},
                            "translated_text": {"type": "string"},
                            "decision": {"type": "string"},
                        },
                        "required": ["item_id", "translated_text"],
                    },
                }
            },
            "required": ["translations"],
        },
    },
}


TRANSLATION_SINGLE_TEXT_RESPONSE_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "translation_single_text_response",
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


TRANSLATION_SINGLE_DECISION_RESPONSE_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "translation_single_decision_response",
        "strict": True,
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "decision": {"type": "string"},
                "translated_text": {"type": "string"},
            },
            "required": ["decision", "translated_text"],
        },
    },
}


FORMULA_SEGMENT_RESPONSE_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "formula_segment_response",
        "strict": True,
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "segments": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "properties": {
                            "segment_id": {"type": "string"},
                            "translated_text": {"type": "string"},
                        },
                        "required": ["segment_id", "translated_text"],
                    },
                }
            },
            "required": ["segments"],
        },
    },
}
