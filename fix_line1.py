#!/usr/bin/env python3

with open('backend/scripts/devtools/tests/translation/test_translation_prompt_protocols.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

if lines[0].startswith('from __future__ import annotations"'):
    lines[0] = 'from __future__ import annotations\n'

with open('backend/scripts/devtools/tests/translation/test_translation_prompt_protocols.py', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print('Fixed line 1')