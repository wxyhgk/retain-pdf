#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import re
import requests
import time
import urllib.parse
from pathlib import Path
from collections import defaultdict

REPORT_PATH = Path('docs/wiki/translation/chinese-residue-report.md')
ROOT = Path('.').resolve()
CHINESE_RE = re.compile(r'[\u4e00-\u9fff]+')
MAX_LIMIT = 10  # for testing; set to None for full

def translate(text):
    url = 'https://api.mymemory.translated.net/get'
    params = {'q': text, 'langpair': 'zh|vi'}
    try:
        r = requests.get(url, params=params, timeout=10)
        data = r.json()
        if 'responseData' in data and 'translatedText' in data['responseData']:
            return data['responseData']['translatedText']
        else:
            print(f"Translation error: {data}")
            return text
    except Exception as e:
        print(f"Translation failed: {e}")
        return text

def parse_comment_matches():
    content = REPORT_PATH.read_text(encoding='utf-8')
    # Find the "## Comment -> Vietnamese" section
    sections = re.split(r'^## ', content, flags=re.MULTILINE)
    comment_section = None
    for sec in sections:
        if sec.startswith('Comment -> Vietnamese'):
            comment_section = sec
            break
    if not comment_section:
        print("Comment section not found")
        return []
    lines = comment_section.splitlines()
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
                    matches.append((path, line_num, snippet))
    return matches

def process_file(file_path, line_mappings):
    full_path = ROOT / file_path
    if not full_path.exists():
        print(f"File not found: {full_path}")
        return
    with open(full_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    # line_mappings: dict line_num -> (original_chinese_text, translated_text)
    # We need to replace the Chinese text in the line.
    # For each line, find Chinese sequences and replace with translated.
    for line_num, (orig, trans) in line_mappings.items():
        if line_num < 1 or line_num > len(lines):
            continue
        line = lines[line_num-1]
        # Replace all occurrences of orig with trans (exact match)
        # But orig may appear multiple times; we replace all.
        new_line = line.replace(orig, trans)
        lines[line_num-1] = new_line
    with open(full_path, 'w', encoding='utf-8') as f:
        f.writelines(lines)

def main():
    matches = parse_comment_matches()
    print(f"Found {len(matches)} comment matches")
    if not matches:
        return
    if MAX_LIMIT:
        matches = matches[:MAX_LIMIT]
    # Group by file
    by_file = defaultdict(list)
    for path, line_num, snippet in matches:
        # We need to get the full line content to find the Chinese text
        full_path = ROOT / path
        if not full_path.exists():
            print(f"File not found: {full_path}")
            continue
        with open(full_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        if line_num > len(lines):
            print(f"Line {line_num} out of range in {path}")
            continue
        line = lines[line_num-1]
        chinese_matches = CHINESE_RE.findall(line)
        if not chinese_matches:
            print(f"No Chinese found in line {line_num} of {path}")
            continue
        # For simplicity, take the first Chinese match and translate it
        # But we could translate each; we'll just translate the whole contiguous block
        # Actually we need to preserve surrounding text, so we replace each match.
        # We'll collect all matches and their translations.
        for ch in chinese_matches:
            trans = translate(ch)
            time.sleep(0.5)  # avoid rate limit
            by_file[path].append((line_num, ch, trans))
    # Process each file
    for file_path, mappings in by_file.items():
        # mappings: list of (line_num, orig, trans)
        # We'll group by line number, and for each line, we need to replace all occurrences.
        line_map = defaultdict(list)
        for ln, orig, trans in mappings:
            line_map[ln].append((orig, trans))
        # For each line, we'll replace all orig with trans sequentially.
        full_path = ROOT / file_path
        with open(full_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        for ln, replacements in line_map.items():
            if ln < 1 or ln > len(lines):
                continue
            line = lines[ln-1]
            for orig, trans in replacements:
                line = line.replace(orig, trans)
            lines[ln-1] = line
        with open(full_path, 'w', encoding='utf-8') as f:
            f.writelines(lines)
        print(f"Updated {file_path}")

if __name__ == '__main__':
    main()