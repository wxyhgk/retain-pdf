#!/usr/bin/env python3

with open('backend/scripts/devtools/tests/translation/test_translation_prompt_protocols.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'assert "' in line and '" in system_prompt' in line:
        parts = line.split('assert "', 1)[1].split('" in system_prompt', 1)
        if len(parts) == 2:
            content = parts[0]
            print(f'{i+1}: {repr(content)}')