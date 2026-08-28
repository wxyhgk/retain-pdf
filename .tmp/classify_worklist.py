import csv
import re
from pathlib import Path

input_path = Path(r'C:\docker-apps\retain-pdf-vi\retain-pdf-vi\.tmp\worklist.csv')
output_path = Path(r'C:\docker-apps\retain-pdf-vi\retain-pdf-vi\.tmp\worklist_classified.csv')

def classify(snippet, section, path):
    snippet = snippet.strip()
    # heuristic classification
    if section.startswith('Comment'):
        return 'comment'
    # UI text: often in JSX, aria-label, title, placeholder
    if any(kw in snippet.lower() for kw in ['aria-label', 'title', 'placeholder', 'role=', 'aria-']):
        return 'ui_text'
    # test messages: often in test files or contain 'test', 'assert'
    if 'test' in path.lower() or 'assert' in snippet or 'expected' in snippet:
        return 'test_message'
    # docs prose: from .md, .rst, etc.
    if path.endswith(('.md', '.rst', '.txt')):
        return 'doc_prose'
    # provider sample text: may contain placeholder like "example" or "sample"
    if 'sample' in snippet.lower() or 'example' in snippet.lower():
        return 'provider_sample_text'
    # contract literal: looks like a key, enum, or serialized value
    if re.match(r'^[A-Z_]+$', snippet) or re.match(r'^[a-z_]+$', snippet) and len(snippet) < 30:
        return 'contract_literal'
    # generated runtime data: contains 'generated', 'runtime'
    if 'generated' in snippet.lower() or 'runtime' in snippet.lower():
        return 'generated_runtime_data'
    # default: manual review
    return 'manual'

with open(input_path, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    rows = list(reader)

classified = []
for row in rows:
    snippet = row['snippet']
    section = row['section']
    path = row['path']
    cat = classify(snippet, section, path)
    row['classification'] = cat
    row['action'] = 'translate' if cat in ('comment', 'ui_text', 'test_message', 'doc_prose') else 'review'
    classified.append(row)

with open(output_path, 'w', newline='', encoding='utf-8') as f:
    fieldnames = list(classified[0].keys())
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(classified)

print(f"Classified {len(classified)} rows to {output_path}")