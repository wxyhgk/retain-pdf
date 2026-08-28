"""Generate batch scripts for Queue 8 manual translation."""
from pathlib import Path
import sys
from collections import defaultdict

sys.path.insert(0, str(Path("backend/scripts").resolve()))
from devtools.scan_chinese_residue import EXCLUDED_PATHS, scan_chinese_residue

r = scan_chinese_residue(Path("."), exclude=tuple(EXCLUDED_PATHS) + ((".tmp",),))

fm = defaultdict(list)
for m in r.matches:
    if m.category == "manual":
        fm[m.path].append((m.line_number, m.snippet))

files_sorted = sorted(fm.items(), key=lambda x: -len(x[1]))

print(f"Total manual files: {len(files_sorted)}")
print(f"Total manual matches: {sum(len(v) for v in fm.values())}")

# Group by directory
by_dir = defaultdict(list)
for path, matches in files_sorted:
    p = Path(path)
    dir_key = str(p.parent) if len(p.parts) > 1 else "root"
    by_dir[dir_key].append((path, len(matches)))

print("\n--- By directory ---")
for d, files in sorted(by_dir.items(), key=lambda x: -sum(n for _, n in x[1])):
    total = sum(n for _, n in files)
    print(f"\n  {d} ({len(files)} files, {total} matches)")
    for p, n in sorted(files, key=lambda x: -x[1])[:10]:
        print(f"    {n:4d}  {Path(p).name}")
    if len(files) > 10:
        print(f"    ... +{len(files) - 10} more files")
