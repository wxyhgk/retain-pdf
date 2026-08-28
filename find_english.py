#!/usr/bin/env python3

import os

for dp, dns, fns in os.walk('backend/scripts/services/translation/llm'):
    for f in fns:
        if not f.endswith('.py'):
            continue
        p = os.path.join(dp, f)
        try:
            txt = open(p, encoding='utf-8').read()
        except OSError:
            continue
        if 'You are' in txt:
            print('Found "You are" in', p)
            for i, line in enumerate(txt.splitlines(), 1):
                if 'You are' in line:
                    print(f'  {i}: {line.strip()}')