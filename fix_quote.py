#!/usr/bin/env python3

with open('backend/scripts/devtools/tests/translation/test_translation_prompt_protocols.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

old = '    assert "Vui lòng chủ động bọc bằng `$...$`\n'
new = '    assert "Vui lòng chủ động bọc bằng `$...$`"\n'

count = 0
for i in range(len(lines)):
    if lines[i] == old:
        lines[i] = new
        count += 1

with open('backend/scripts/devtools/tests/translation/test_translation_prompt_protocols.py', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print(f"Fixed {count} occurrences")