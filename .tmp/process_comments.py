#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import re, urllib.request, urllib.parse, time, sys
from pathlib import Path
from collections import defaultdict

REPORT = Path('docs/wiki/translation/chinese-residue-report.md')
ROOT = Path('.').resolve()
CHINESE_RE = re.compile(r'[\u4e00-\u9fff]+')
MAX_PER_DIR = 3  # test limit

def translate(text):
    url = 'https://api.mymemory.translated.net/get?q=' + urllib.parse.quote(text) + '&langpair=zh|vi'
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            data = resp.read().decode('utf-8')
            import json
            obj = json.loads(data)
            if 'responseData' in obj and 'translatedText' in obj['responseData']:
                return obj['responseData']['translatedText']
    except Exception as e:
        print(f"Translation error for '{text}': {e}")
    return text

def parse_comment_matches(prefix=None):
    content = REPORT.read_text(encoding='utf-8')
    sections = re.split(r'^## ', content, flags=re.MULTILINE)
    for sec in sections:
        if sec.startswith('Comment -> Vietnamese'):
            lines = sec.splitlines()
            matches = []
            in_table = False
            for line in lines:
                if line.startswith('| ---'):
                    in_table = True
                    continue
                if in_table and line.startswith('|'):
                    parts = line.split('|')
                    if len(parts) >= 4:
                        pathline = parts[1].strip()
                        snippet = parts[3].strip()
                        m = re.search(r'\[([^]]+):(\d+)\]', pathline)
                        if m:
                            path = m.group(1)
                            line_num = int(m.group(2))
                            if prefix and not path.startswith(prefix):
                                continue
                            matches.append((path, line_num, snippet))
            return matches
    return []

def process_dir(prefix):
    matches = parse_comment_matches(prefix)
    if not matches:
        print(f"No comment matches for prefix: {prefix}")
        return
    print(f"Found {len(matches)} comment matches in {prefix}")
    # Group by file
    by_file = defaultdict(list)
    for path, line_num, snippet in matches:
        by_file[path].append((line_num, snippet))
    # Process each file
    for file_path, items in by_file.items():
        full_path = ROOT / file_path
        if not full_path.exists():
            print(f"File not found: {full_path}")
            continue
        with open(full_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        # Process each line
        for line_num, snippet in items:
            if line_num < 1 or line_num > len(lines):
                continue
            line = lines[line_num-1]
            # Find all Chinese segments
            chinese_parts = CHINESE_RE.findall(line)
            if not chinese_parts:
                continue
            # Translate each distinct Chinese segment
            replacements = {}
            for ch in chinese_parts:
                if ch not in replacements:
                    replacements[ch] = translate(ch)
                    time.sleep(0.5)  # respect rate limit
            # Replace in line
            new_line = line
            for orig, trans in replacements.items():
                new_line = new_line.replace(orig, trans)
            if new_line != line:
                lines[line_num-1] = new_line
                print(f"Updated {file_path}:{line_num}")
        with open(full_path, 'w', encoding='utf-8') as f:
            f.writelines(lines)

if __name__ == '__main__':
    prefix = sys.argv[1] if len(sys.argv) > 1 else 'frontend/src'
    process_dir(prefix)