#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import html
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", line_buffering=True)

REPORT = Path("docs/wiki/translation/chinese-residue-report.md")
ROOT = Path(".").resolve()
CHINESE_RE = re.compile(r"[\u4e00-\u9fff]+")
LOG_FILE = Path(".tmp/comment_translation.log")
CACHE_FILE = Path(".tmp/comment_translation_cache.json")
LOG_FILE.parent.mkdir(exist_ok=True)

REQUEST_DELAY_SECONDS = float(os.environ.get("TRANSLATE_COMMENTS_DELAY", "1.2"))
MAX_RETRIES = int(os.environ.get("TRANSLATE_COMMENTS_RETRIES", "3"))
URL_TIMEOUT_SECONDS = float(os.environ.get("TRANSLATE_COMMENTS_TIMEOUT", "20"))
LIMIT_FILES = int(os.environ.get("TRANSLATE_COMMENTS_LIMIT_FILES", "0"))


class TranslationRateLimited(RuntimeError):
    pass


def log(message):
    print(message, flush=True)
    with open(LOG_FILE, "a", encoding="utf-8") as handle:
        handle.write(message + "\n")
        handle.flush()


def load_cache():
    if not CACHE_FILE.exists():
        return {}
    try:
        return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
    except Exception as exc:
        log(f"Cache read failed, starting with empty cache: {exc}")
        return {}


def save_cache(cache):
    tmp_path = CACHE_FILE.with_suffix(".json.tmp")
    tmp_path.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp_path.replace(CACHE_FILE)


def request_translation(text):
    url = "https://api.mymemory.translated.net/get?q=" + urllib.parse.quote(text) + "&langpair=zh|vi"
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "retain-pdf-vi-comment-cleanup/1.0",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(request, timeout=URL_TIMEOUT_SECONDS) as resp:
        payload = resp.read().decode("utf-8")
    obj = json.loads(payload)
    translated = obj.get("responseData", {}).get("translatedText")
    if not translated:
        raise RuntimeError(f"missing translatedText in response: {payload[:200]}")
    translated = html.unescape(str(translated)).strip()
    if CHINESE_RE.search(translated):
        raise RuntimeError(f"provider returned untranslated Chinese text: {translated}")
    return translated


def translate(text, cache):
    if text in cache:
        return cache[text]

    last_error = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            translated = request_translation(text)
            cache[text] = translated
            save_cache(cache)
            time.sleep(REQUEST_DELAY_SECONDS)
            return translated
        except urllib.error.HTTPError as exc:
            last_error = exc
            if exc.code == 429:
                wait_seconds = min(60, REQUEST_DELAY_SECONDS * (2 ** attempt) + 5)
                log(f"Rate limited translating {text!r} (attempt {attempt}/{MAX_RETRIES}); waiting {wait_seconds:.1f}s")
                time.sleep(wait_seconds)
                continue
            log(f"HTTP error translating {text!r}: {exc}")
            break
        except Exception as exc:
            last_error = exc
            wait_seconds = min(30, REQUEST_DELAY_SECONDS * attempt)
            log(f"Translation error for {text!r} (attempt {attempt}/{MAX_RETRIES}): {exc}; waiting {wait_seconds:.1f}s")
            time.sleep(wait_seconds)

    if isinstance(last_error, urllib.error.HTTPError) and last_error.code == 429:
        raise TranslationRateLimited(
            "Translation provider returned HTTP 429 repeatedly. Stop now instead of silently leaving Chinese text."
        ) from last_error
    raise RuntimeError(f"Failed to translate {text!r}: {last_error}")

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
    LOG_FILE.write_text("", encoding="utf-8")
    matches = parse_comment_matches()
    cache = load_cache()
    log(f"Total comment matches: {len(matches)}")
    log(f"Cached translations: {len(cache)}")
    if not matches:
        return
    # Group by file
    by_file = defaultdict(list)
    for path, line_num, snippet in matches:
        by_file[path].append((line_num, snippet))
    total_files = len(by_file)
    if LIMIT_FILES > 0:
        log(f"Limit enabled: processing at most {LIMIT_FILES} files")
    processed = 0
    for file_path, items in by_file.items():
        if LIMIT_FILES > 0 and processed >= LIMIT_FILES:
            log(f"Stopping after TRANSLATE_COMMENTS_LIMIT_FILES={LIMIT_FILES}")
            break
        full_path = ROOT / file_path
        if not full_path.exists():
            log(f"File not found: {full_path}")
            continue
        log(f"Processing {file_path} ({len(items)} lines)")
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
                    trans = translate(ch, cache)
                    replacements[ch] = trans
            new_line = line
            for orig, trans in replacements.items():
                new_line = new_line.replace(orig, trans)
            if new_line != line:
                lines[line_num-1] = new_line
                modified = True
                log(f"Updated {file_path}:{line_num}")
        if modified:
            with open(full_path, 'w', encoding='utf-8') as f:
                f.writelines(lines)
            log(f"Done with {file_path}")
        processed += 1
        if processed % 10 == 0:
            log(f"Processed {processed}/{total_files} files")
    log("Comment translation complete. See .tmp/comment_translation.log")

if __name__ == '__main__':
    try:
        main()
    except TranslationRateLimited as exc:
        log(f"FAILED: {exc}")
        raise SystemExit(2)
    except Exception as exc:
        log(f"FAILED: {exc}")
        raise
