import os
import re
import sys
from pathlib import Path

try:
    from deep_translator import GoogleTranslator
    translator = GoogleTranslator(source='zh-CN', target='vi')
except ImportError:
    print("deep_translator not installed. Install with: pip install deep-translator")
    sys.exit(1)

def translate_chinese(text: str) -> str:
    if not text:
        return text
    # Split text into non-Chinese and Chinese parts, translate each Chinese part.
    pattern = re.compile(r'([\u4e00-\u9fff]+)')
    parts = []
    last_end = 0
    for match in pattern.finditer(text):
        start, end = match.span()
        if start > last_end:
            parts.append(text[last_end:start])
        chinese = match.group(1)
        try:
            translated = translator.translate(chinese)
        except Exception:
            translated = chinese
        parts.append(translated)
        last_end = end
    if last_end < len(text):
        parts.append(text[last_end:])
    return ''.join(parts)

def process_python_file(filepath: Path):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    new_content = content
    # Process triple double quotes
    def replace_triple(match):
        inner = match.group(1)
        if re.search(r'[\u4e00-\u9fff]', inner):
            translated_inner = translate_chinese(inner)
            return '"""' + translated_inner + '"""'
        return match.group(0)
    new_content = re.sub(r'"""([\s\S]*?)"""', replace_triple, new_content)
    # Triple single quotes
    def replace_triple_single(match):
        inner = match.group(1)
        if re.search(r'[\u4e00-\u9fff]', inner):
            translated_inner = translate_chinese(inner)
            return "'''" + translated_inner + "'''"
        return match.group(0)
    new_content = re.sub(r"'''([\s\S]*?)'''", replace_triple_single, new_content)
    # Single-line strings (avoid f-strings)
    def replace_string(match):
        s = match.group(0)
        # Skip f-strings
        if s.startswith('f') or s.startswith('F'):
            return s
        quote_char = s[0]
        inner = s[1:-1]
        if re.search(r'[\u4e00-\u9fff]', inner):
            translated_inner = translate_chinese(inner)
            return quote_char + translated_inner + quote_char
        return s
    # Double-quoted strings
    new_content = re.sub(r'"(?:[^"\\]|\\.)*"', replace_string, new_content)
    # Single-quoted strings
    new_content = re.sub(r"'(?:[^'\\]|\\.)*'", replace_string, new_content)
    # Comments (lines starting with #)
    lines = new_content.split('\n')
    new_lines = []
    for line in lines:
        stripped = line.lstrip()
        if stripped.startswith('#'):
            # Do not translate shebang or pragma
            if stripped.startswith('#!') or stripped.startswith('# -*-') or stripped.startswith('# coding:'):
                new_lines.append(line)
                continue
            # Translate the comment text (after #)
            comment_text = stripped[1:].strip()
            if re.search(r'[\u4e00-\u9fff]', comment_text):
                translated_comment = translate_chinese(comment_text)
                # Preserve indentation
                indent = line[:len(line)-len(stripped)]
                new_lines.append(indent + '# ' + translated_comment)
            else:
                new_lines.append(line)
        else:
            new_lines.append(line)
    new_content = '\n'.join(new_lines)
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

def process_markdown_file(filepath: Path):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    lines = content.split('\n')
    in_code_block = False
    new_lines = []
    for line in lines:
        if line.strip().startswith('```'):
            in_code_block = not in_code_block
            new_lines.append(line)
            continue
        if in_code_block:
            new_lines.append(line)
        else:
            if re.search(r'[\u4e00-\u9fff]', line):
                new_line = translate_chinese(line)
                new_lines.append(new_line)
            else:
                new_lines.append(line)
    new_content = '\n'.join(new_lines)
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

def main():
    root = Path('backend/scripts')
    if not root.exists():
        print("backend/scripts not found", file=sys.stderr)
        sys.exit(1)
    # Python files
    for pyfile in root.rglob('*.py'):
        process_python_file(pyfile)
    # Markdown files
    for mdfile in root.rglob('*.md'):
        process_markdown_file(mdfile)

if __name__ == '__main__':
    main()