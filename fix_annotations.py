#!/usr/bin/env python3

with open('backend/scripts/devtools/tests/translation/test_translation_prompt_protocols.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

count = 0
for i in range(len(lines)):
    if 'from __future__ import annotations' in lines[i] and lines[i].endswith('annotations\n') and '"' not in lines[i][-15:]:
        lines[i] = lines[i].rstrip() + '"\n'
        count += 1

with open('backend/scripts/devtools/tests/translation/test_translation_prompt_protocols.py', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print(f"Fixed {count} unterminated annotations strings")