CALL_SEARCH_SCHEMA_KEEP = {
    "type": "object",
    "required": ["action"],
    "properties": {
        "action": {"type": "string", "enum": ["search", "done"]},
        "keep": {"type": "array", "items": {"type": "integer"}},
        "nouns": {"type": "array", "items": {"type": "string"}},
        "queries": {"type": "array", "items": {"type": "string"}},
        "missing": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "keep": {"type": "string"},
                    "searched_with": {"type": "array", "items": {"type": "string"}},
                },
            },
        },
    },
}

CALL_SEARCH_SCHEMA_REMOVE = {
    "type": "object",
    "required": ["action"],
    "properties": {
        "action": {"type": "string", "enum": ["search", "done"]},
        "keep": {"type": "array", "items": {"type": "integer"}},
        "nouns": {"type": "array", "items": {"type": "string"}},
        "queries": {"type": "array", "items": {"type": "string"}},
        "missing": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "remove": {"type": "string"},
                    "searched_with": {"type": "array", "items": {"type": "string"}},
                },
            },
        },
    },
}

CALL_SEARCH_SCHEMA_INITIATE = {
    "type": "object",
    "required": ["action", "nouns", "queries"],
    "properties": {
        "action": {"type": "string", "enum": ["search"]},
        "nouns": {"type": "array", "items": {"type": "string"}},
        "queries": {"type": "array", "items": {"type": "string"}},
    },
}

CALL_1C_PASS1_SCHEMA = {
    "type": "object",
    "required": ["step_review", "gaps"],
    "properties": {
        "step_review": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["step", "needs", "entries_used", "covered", "gap"],
                "properties": {
                    "step": {"type": "string"},
                    "needs": {"type": "string"},
                    "entries_used": {"type": "array", "items": {"type": "string"}},
                    "covered": {"type": "boolean"},
                    "gap": {"type": ["string", "null"]},
                },
            },
        },
        "gaps": {
            "type": "array",
            "items": {
                "type": "object",
                "required": ["reason", "search_for"],
                "properties": {
                    "reason": {"type": "string"},
                    "search_for": {
                        "type": "array",
                        "items": {"type": "string"},
                        "minItems": 1,
                    },
                },
            },
        },
    },
}

CALL_1C_PASS2_SCHEMA = {
    "type": "object",
    "required": ["keep"],
    "properties": {"keep": {"type": "array", "items": {"type": "integer"}}},
}
