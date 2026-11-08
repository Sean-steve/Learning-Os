#!/usr/bin/env bash
set -euo pipefail

# Run inside a clone of the Learning-Os GitHub repository on
# the phase/1.1-repository-certification branch.
ARCHIVE="${1:-}"
MODE="${2:-}"
if [ -z "$ARCHIVE" ] || [ ! -f "$ARCHIVE" ]; then
  echo "Usage: bash scripts/import-phase1.sh /path/to/learning-os-phase1.zip [--push]" >&2
  exit 2
fi
ROOT="$(git rev-parse --show-toplevel)"
BRANCH="$(git -C "$ROOT" branch --show-current)"
if [ "$BRANCH" != "phase/1.1-repository-certification" ]; then
  echo "Refusing to import on $BRANCH. Checkout phase/1.1-repository-certification." >&2
  exit 2
fi
TEMP="$(mktemp -d)"
trap 'rm -rf "$TEMP"' EXIT
unzip -q "$ARCHIVE" -d "$TEMP"
SOURCE="$TEMP/learning-os-phase1"
if [ ! -d "$SOURCE/apps/web/src" ]; then
  echo "Archive must contain learning-os-phase1/apps/web/src." >&2
  exit 2
fi

# Preserve the GitHub workflow, tests and repo history.
cp -a "$SOURCE"/. "$ROOT"/
cd "$ROOT"
echo "Imported Phase 1 app source. Run:"
echo "  npm install"
echo "  npm run check:phase1"
echo "  npm run typecheck"
echo "  npm run build"
echo "  npm install --no-save --no-package-lock @playwright/test@^1.56.0"
echo "  npx playwright install chromium"
echo "  npx playwright test"

if [ "$MODE" = "--push" ]; then
  git add -A
  git commit -m "feat: import complete Phase 1 Learning OS frontend" || true
  git push -u origin "$BRANCH"
  echo "Pushed the source. Inspect GitHub Actions before merging."
fi
