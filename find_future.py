#!/usr/bin/env python3

txt = open('backend/scripts/devtools/tests/translation/test_translation_prompt_protocols.py', encoding='utf-8').read()
import re
for m in re.finditer(r'from __future__ import annotations"', txt):
    line = txt.count('\n', 0, m.start()) + 1
    print(f'Found at line {line}')