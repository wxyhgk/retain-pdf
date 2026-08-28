from pathlib import Path
import sys
from collections import Counter, defaultdict

sys.path.insert(0, str(Path("backend/scripts").resolve()))
from devtools.scan_chinese_residue import EXCLUDED_PATHS, scan_chinese_residue

r = scan_chinese_residue(Path("."), exclude=tuple(EXCLUDED_PATHS) + ((".tmp",),))

cat_files = defaultdict(set)
cat_ext = defaultdict(lambda: Counter())
for m in r.matches:
    cat_files[m.category].add(m.path)
    cat_ext[m.category].update([Path(m.path).suffix])

print(f"Scanned: {r.scanned_files} files")
print(f"Total matches: {len(r.matches)}")
print(f"Files with matches: {len(set(m.path for m in r.matches))}")

for cat in sorted(cat_files.keys()):
    print(f"\n=== {cat} ({len(cat_files[cat])} files) ===")
    for ext, n in cat_ext[cat].most_common():
        print(f"  {ext}: {n}")
