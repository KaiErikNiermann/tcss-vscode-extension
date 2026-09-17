#!/usr/bin/env bash
# Print the CHANGELOG.md section for a version, for use as GitHub release notes.
#
# Usage: scripts/changelog-section.sh 1.4.0
set -euo pipefail

version="${1#v}"
cd "$(dirname "$0")/.."

section=$(awk -v want="## $version" '
  $0 == want { capture = 1; next }
  capture && /^## / { exit }
  capture { print }
' CHANGELOG.md)

if [ -z "$(printf '%s' "$section" | tr -d '[:space:]')" ]; then
  echo "error: no '## $version' section in CHANGELOG.md" >&2
  exit 1
fi

# Trim leading and trailing blank lines so the release body does not open on one.
printf '%s\n' "$section" | sed -e '/./,$!d' | tac | sed -e '/./,$!d' | tac
