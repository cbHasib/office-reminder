#!/usr/bin/env bash
# Bumps the version in all three places the desktop app reads it from,
# optionally commits + tags + pushes in one shot.
#
# Usage:
#   ./scripts/bump-version.sh 0.1.1            # just edit the files, no commit
#   ./scripts/bump-version.sh 0.1.1 --release  # edit + commit + tag + push

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "Usage: $0 <semver> [--release]   e.g. $0 0.1.1 --release" >&2
  exit 1
fi

NEW="$1"
RELEASE=0
[ "${2:-}" = "--release" ] && RELEASE=1

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PKG="$ROOT/apps/desktop/package.json"
TOML="$ROOT/apps/desktop/src-tauri/Cargo.toml"
CONF="$ROOT/apps/desktop/src-tauri/tauri.conf.json"

node -e "
  const fs = require('fs');
  const p = '${PKG}';
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  j.version = '${NEW}';
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
  console.log('  ✓ updated', p);
"

python3 - <<PY
import re, pathlib
p = pathlib.Path("${TOML}")
text = p.read_text()
new = re.sub(r'(^\[package\][\s\S]*?\nversion\s*=\s*")[^"]+(")',
             lambda m: m.group(1) + "${NEW}" + m.group(2),
             text, count=1, flags=re.MULTILINE)
p.write_text(new)
print(f"  ✓ updated {p}")
PY

node -e "
  const fs = require('fs');
  const p = '${CONF}';
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  j.version = '${NEW}';
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
  console.log('  ✓ updated', p);
"

if [ "$RELEASE" -eq 1 ]; then
  echo
  echo "Staging all pending changes and tagging v${NEW}…"
  git add -A
  # Only commit if there's actually something staged. `git diff --cached --quiet`
  # exits 1 when there are staged changes, 0 when clean.
  if ! git diff --cached --quiet; then
    git commit -m "release: v${NEW}"
  else
    echo "  (no file changes to commit — tagging the current HEAD)"
  fi
  # If the tag already exists locally, bail out clearly.
  if git rev-parse "v${NEW}" >/dev/null 2>&1; then
    echo
    echo "✗ Tag v${NEW} already exists locally. Delete it with:" >&2
    echo "    git tag -d v${NEW} && git push origin :refs/tags/v${NEW}" >&2
    exit 1
  fi
  git tag "v${NEW}"
  git push origin HEAD --tags
  echo
  REPO_URL=$(git remote get-url origin | sed -E 's|.*github.com[:/](.+)\.git|\1|')
  echo "✓ Pushed. Workflow run at: https://github.com/${REPO_URL}/actions"
else
  echo
  echo "Bumped to ${NEW}. Next steps:"
  echo "  git add -A && git commit -m \"release: v${NEW}\""
  echo "  git tag v${NEW} && git push origin main --tags"
  echo
  echo "Or just re-run with --release to do all of the above automatically."
fi
