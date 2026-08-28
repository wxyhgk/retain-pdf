#!/usr/bin/env python3

with open('backend/scripts/devtools/tests/translation/test_translation_prompt_protocols.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in [594, 961, 1729, 2096]:
    if 'assert " in system_prompt' in lines[i]:
        lines[i] = '    assert "Không sử dụng khoảng trắng" in system_prompt\n'

with open('backend/scripts/devtools/tests/translation/test_translation_prompt_protocols.py', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print('Fixed 4 broken assertions')