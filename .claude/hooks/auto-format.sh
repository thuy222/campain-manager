#!/usr/bin/env bash
# Auto-format hook — runs after Claude Code edits a file.
# Silently formats supported file types with prettier; never fails the tool call.

set +e

FILE_PATH="${1:-}"

# No file path? Nothing to do.
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# File must exist (Edit/Write of a deleted file etc.)
if [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

# Only format known extensions. No-op for anything else (shell scripts, images, etc).
case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx|*.json|*.md)
    ;;
  *)
    exit 0
    ;;
esac

# Resolve repo root so the hook works regardless of cwd.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT" || exit 0

# Format silently; swallow all output and any non-zero exit.
yarn prettier --write --log-level silent "$FILE_PATH" >/dev/null 2>&1 || true

exit 0
