"""Generate batch scripts for Queue 6 comment translation."""
from pathlib import Path
import sys
from collections import defaultdict

sys.path.insert(0, str(Path("backend/scripts").resolve()))
from devtools.scan_chinese_residue import EXCLUDED_PATHS, scan_chinese_residue

r = scan_chinese_residue(Path("."), exclude=tuple(EXCLUDED_PATHS) + ((".tmp",),))

fm = defaultdict(list)
for m in r.matches:
    if m.category == "comment":
        fm[m.path].append((m.line_number, m.snippet))

# Sort files by match count descending
files_sorted = sorted(fm.items(), key=lambda x: -len(x[1]))

print(f"Total comment files: {len(files_sorted)}")
print(f"Total comment matches: {sum(len(v) for v in fm.values())}")

# Group into batches of ~10 files
batch_size = 10
for i in range(0, len(files_sorted), batch_size):
    batch = files_sorted[i:i+batch_size]
    total = sum(len(v) for _, v in batch)
    print(f"\n--- Batch {i // batch_size + 1} ({len(batch)} files, {total} matches) ---")
    for path, matches in batch:
        print(f"  {len(matches):4d}  {path}")
