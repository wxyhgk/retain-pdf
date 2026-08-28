#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import re, urllib.request, urllib.parse, time, sys, json, os
from pathlib import Path
from collections import defaultdict

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

REPORT = Path('docs/wiki/translation/chinese-residue-report.md')
ROOT = Path('.').resolve()
CHINESE_RE = re.compile(r'[\u4e00-\u9fff]+')
CACHE_FILE = Path('.tmp/comment_translation_cache.json')
LOG_FILE = Path('.tmp/comment_translation.log')
CACHE_FILE.parent.mkdir(exist_ok=True)

def load_cache():
    if CACHE_FILE.exists():
        with open(CACHE_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {}

def save_cache(cache):
    with open(CACHE_FILE, 'w', encoding='utf-8') as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)

def translate_with_retry(text, max_retries=5):
    cache = load_cache()
    if text in cache:
        return cache[text]
    delay = 2
    for attempt in range(max_retries):
        try:
            url = 'https://api.mymemory.translated.net/get?q=' + urllib.parse.quote(text) + '&langpair=zh|vi'
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = resp.read().decode('utf-8')
                obj = json.loads(data)
                if 'responseData' in obj and 'translatedText' in obj['responseData']:
                    trans = obj['responseData']['translatedText']
                    cache[text] = trans
                    save_cache(cache)
                    return trans
                else:
                    with open(LOG_FILE, 'a', encoding='utf-8') as log:
                        log.write(f"API error for '{text}': {obj}\n")
                    break
        except urllib.error.HTTPError as e:
            if e.code == 429:
                with open(LOG_FILE, 'a', encoding='utf-8') as log:
                    log.write(f"Rate limit, retry in {delay}s for '{text}'\n")
                time.sleep(delay)
                delay *= 2
                continue
            else:
                with open(LOG_FILE, 'a', encoding='utf-8') as log:
                    log.write(f"HTTP error {e.code} for '{text}': {e}\n")
                break
        except Exception as e:
            with open(LOG_FILE, 'a', encoding='utf-8') as log:
                log.write(f"Error for '{text}': {e}\n")
            break
    return text

def parse_comment_matches():
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
                            matches.append((path, line_num, snippet))
            return matches
    return []

def main():
    limit = int(os.environ.get('TRANSLATE_COMMENTS_LIMIT_FILES', '0'))
    delay = float(os.environ.get('TRANSLATE_COMMENTS_DELAY', '2'))
    matches = parse_comment_matches()
    with open(LOG_FILE, 'w', encoding='utf-8') as log:
        log.write(f"Total comment matches: {len(matches)}\n")
    print(f"Total comment matches: {len(matches)}")
    if not matches:
        return
    by_file = defaultdict(list)
    for path, line_num, snippet in matches:
        by_file[path].append((line_num, snippet))
    total_files = len(by_file)
    processed = 0
    for file_path, items in by_file.items():
        if limit and processed >= limit:
            with open(LOG_FILE, 'a', encoding='utf-8') as log:
                log.write(f"Stopping after limit {limit} files\n")
            break
        full_path = ROOT / file_path
        if not full_path.exists():
            with open(LOG_FILE, 'a', encoding='utf-8') as log:
                log.write(f"File not found: {full_path}\n")
            continue
        with open(LOG_FILE, 'a', encoding='utf-8') as log:
            log.write(f"Processing {file_path} ({len(items)} lines)\n")
        with open(full_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        modified = False
        for line_num, snippet in items:
            if line_num < 1 or line_num > len(lines):
                continue
            line = lines[line_num-1]
            chinese_parts = CHINESE_RE.findall(line)
            if not chinese_parts:
                continue
            replacements = {}
            for ch in chinese_parts:
                if ch not in replacements:
                    trans = translate_with_retry(ch)
                    replacements[ch] = trans
                    time.sleep(delay)
            new_line = line
            for orig, trans in replacements.items():
                new_line = new_line.replace(orig, trans)
            if new_line != line:
                lines[line_num-1] = new_line
                modified = True
                with open(LOG_FILE, 'a', encoding='utf-8') as log:
                    log.write(f"Updated {file_path}:{line_num}\n")
        if modified:
            with open(full_path, 'w', encoding='utf-8') as f:
                f.writelines(lines)
            with open(LOG_FILE, 'a', encoding='utf-8') as log:
                log.write(f"Done with {file_path}\n")
        processed += 1
        if processed % 5 == 0:
            print(f"Processed {processed}/{total_files} files")
    print("Comment translation complete.")

if __name__ == '__main__':
    main()