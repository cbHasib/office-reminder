#!/usr/bin/env bash
# Bumps the version in all three places the desktop app reads it from.
# Usage:  ./scripts/bump-version.sh 0.1.1

set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: $0 <semver>   e.g. $0 0.1.1" >&2
  exit 1
fi

NEW="$1"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

PKG="$ROOT/apps/desktop/package.json"
TOML="$ROOT/apps/desktop/src-tauri/Cargo.toml"
CONF="$ROOT/apps/desktop/src-tauri/tauri.conf.json"

# package.json
node -e "
  const fs = require('fs');
  const p = '${PKG}';
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  j.version = '${NEW}';
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
  console.log('  ✓ updated', p);
"

# Cargo.toml — replace the top-level version line under [package]
python3 - <<PY
import re, pathlib
p = pathlib.Path("${TOML}")
text = p.read_text()
# Match the FIRST 'version = "..."' line after [package]
new = re.sub(r'(^\[package\][\s\S]*?\nversion\s*=\s*")[^"]+(")',
             lambda m: m.group(1) + "${NEW}" + m.group(2),
             text, count=1, flags=re.MULTILINE)
p.write_text(new)
print(f"  ✓ updated {p}")
PY

# tauri.conf.json
node -e "
  const fs = require('fs');
  const p = '${CONF}';
  const j = JSON.parse(fs.readFileSync(p, 'utf8'));
  j.version = '${NEW}';
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
  console.log('  ✓ updated', p);
"

echo
echo "Bumped to ${NEW}. Next steps:"
echo "  git add -A"
echo "  git commit -m \"release: v${NEW}\""
echo "  git tag v${NEW}"
echo "  git push origin main --tags"
