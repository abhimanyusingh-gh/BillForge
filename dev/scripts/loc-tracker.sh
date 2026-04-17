#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUTPUT_FILE="$REPO_ROOT/docs/loc-tracker/loc-history.json"
SAMPLE_RATE="${SAMPLE_RATE:-1}"
UPDATE_MODE=false

for arg in "$@"; do
  case "$arg" in
    --update) UPDATE_MODE=true ;;
    --sample=*) SAMPLE_RATE="${arg#*=}" ;;
  esac
done

export REPO_ROOT OUTPUT_FILE SAMPLE_RATE UPDATE_MODE

python3 << 'PYEOF'
import subprocess, json, sys, os, re

repo_root = os.environ.get("REPO_ROOT", "")
output_file = os.environ.get("OUTPUT_FILE", "")
sample_rate = int(os.environ.get("SAMPLE_RATE", "1"))
update_mode = os.environ.get("UPDATE_MODE", "false") == "true"

if not repo_root or not output_file:
    print("Error: REPO_ROOT or OUTPUT_FILE not set", file=sys.stderr)
    sys.exit(1)

SOURCE_EXTS = {'.ts', '.tsx', '.js', '.jsx', '.css', '.html', '.json', '.sh'}
EXCLUDE_PATTERNS = [
    'node_modules/', 'dist/', '.yarn/', 'docs/',
]
EXCLUDE_SUFFIXES = ['.lock', '.map', '.d.ts']
EXCLUDE_FILES = {'.gitignore', '.eslintrc', '.prettierrc'}
IMAGE_EXTS = {'.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot'}

def is_source(path):
    _, ext = os.path.splitext(path)
    if ext in IMAGE_EXTS:
        return False
    if ext not in SOURCE_EXTS:
        return False
    return True

def should_exclude(path):
    for pat in EXCLUDE_PATTERNS:
        if pat in path:
            return True
    for suf in EXCLUDE_SUFFIXES:
        if path.endswith(suf):
            return True
    basename = os.path.basename(path)
    for ef in EXCLUDE_FILES:
        if basename.startswith(ef):
            return True
    if basename.startswith('tsconfig') and basename.endswith('.json'):
        return True
    return False

def is_included(path):
    return is_source(path) and not should_exclude(path)

def git(*args):
    result = subprocess.run(
        ['git', '-C', repo_root] + list(args),
        capture_output=True, text=True
    )
    return result.stdout

def count_lines_in_blob(commit, filepath):
    try:
        result = subprocess.run(
            ['git', '-C', repo_root, 'show', f'{commit}:{filepath}'],
            capture_output=True, text=True
        )
        if result.returncode != 0:
            return 0
        return result.stdout.count('\n')
    except:
        return 0

def get_file_list(commit, prefix=None):
    if prefix:
        raw = git('ls-tree', '-r', '--name-only', commit, '--', prefix)
    else:
        raw = git('ls-tree', '-r', '--name-only', commit)
    return [f for f in raw.strip().split('\n') if f]

def count_category(commit, prefix):
    files = get_file_list(commit, prefix)
    total = 0
    for f in files:
        if is_included(f):
            total += count_lines_in_blob(commit, f)
    return total

def count_tests(commit):
    files = get_file_list(commit, 'backend/src')
    total = 0
    for f in files:
        if re.search(r'\.test\.tsx?$', f):
            total += count_lines_in_blob(commit, f)
    return total

def count_total(commit):
    files = get_file_list(commit)
    total = 0
    for f in files:
        if is_included(f):
            total += count_lines_in_blob(commit, f)
    return total

def get_commits():
    raw = git('log', '--reverse', '--format=%H %aI %s')
    commits = []
    for line in raw.strip().split('\n'):
        if not line.strip():
            continue
        parts = line.split(' ', 2)
        if len(parts) < 3:
            parts.append('')
        commits.append({
            'hash': parts[0],
            'date': parts[1].split('T')[0],
            'message': parts[2] if len(parts) > 2 else '',
        })
    return commits

def process_commit(c):
    h = c['hash']
    backend = count_category(h, 'backend/src')
    frontend = count_category(h, 'frontend/src')
    tests = count_tests(h)
    total = count_total(h)
    return {
        'commit': h[:7],
        'date': c['date'],
        'message': c['message'],
        'backend': backend,
        'frontend': frontend,
        'tests': tests,
        'total': total,
    }

if update_mode and os.path.exists(output_file):
    with open(output_file) as f:
        existing = json.load(f)

    if existing:
        last_short = existing[-1]['commit']
        full_hash = git('log', '--all', '--format=%H', f'--grep={last_short}').strip().split('\n')
        last_full = None
        for fh in full_hash:
            if fh.startswith(last_short):
                last_full = fh
                break

        if not last_full:
            last_full = git('rev-parse', last_short).strip()

        raw_new = git('log', '--reverse', '--format=%H %aI %s', f'{last_full}..HEAD')
        new_commits = []
        for line in raw_new.strip().split('\n'):
            if not line.strip():
                continue
            parts = line.split(' ', 2)
            if len(parts) < 3:
                parts.append('')
            new_commits.append({
                'hash': parts[0],
                'date': parts[1].split('T')[0],
                'message': parts[2] if len(parts) > 2 else '',
            })

        if not new_commits:
            print(f"No new commits since {last_short}. loc-history.json is up to date.")
            sys.exit(0)

        print(f"Found {len(new_commits)} new commit(s) to process.")
        new_entries = []
        for i, c in enumerate(new_commits):
            print(f"  [{i+1}/{len(new_commits)}] {c['hash'][:7]} {c['message']}")
            entry = process_commit(c)
            new_entries.append(entry)

        combined = existing + new_entries
        os.makedirs(os.path.dirname(output_file), exist_ok=True)
        with open(output_file, 'w') as f:
            json.dump(combined, f, indent=2)
        print(f"Updated {len(new_entries)} entries. Total: {len(combined)}")
        sys.exit(0)

all_commits = get_commits()
total_count = len(all_commits)
print(f"Total commits: {total_count}, sample rate: every {sample_rate}th commit")

sampled = []
for i, c in enumerate(all_commits):
    if i % sample_rate == 0 or i == total_count - 1:
        sampled.append(c)

if len(sampled) > 1 and sampled[-1]['hash'] == sampled[-2]['hash']:
    sampled.pop()

print(f"Processing {len(sampled)} commits...")

entries = []
for i, c in enumerate(sampled):
    print(f"  [{i+1}/{len(sampled)}] {c['hash'][:7]} {c['message']}")
    entry = process_commit(c)
    entries.append(entry)

os.makedirs(os.path.dirname(output_file), exist_ok=True)
with open(output_file, 'w') as f:
    json.dump(entries, f, indent=2)
print(f"\nWritten {len(entries)} entries to {output_file}")
PYEOF
