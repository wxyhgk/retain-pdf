#!/usr/bin/env python3

txt = open('backend/scripts/devtools/tests/translation/test_translation_prompt_protocols.py', encoding='utf-8').read()
print('Occurrences:', txt.count('from __future__ import annotations"'))