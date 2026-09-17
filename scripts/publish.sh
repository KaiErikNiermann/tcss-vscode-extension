#!/usr/bin/env bash
# Publish a vsix to one registry, retrying a transient failure and treating an
# already-published version as success.
#
# Usage: scripts/publish.sh {marketplace|openvsx} <path to vsix>
#
# Open VSX in particular returns 503 often enough to matter: it took down the
# v1.4.1 release run after the Marketplace publish had already succeeded.
set -euo pipefail

registry="$1"
vsix="$2"
attempts=4

case "$registry" in
  marketplace) publish=(pnpm exec vsce publish --no-dependencies --packagePath "$vsix") ;;
  openvsx)     publish=(pnpm exec ovsx publish "$vsix" --pat "${OVSX_PAT:?OVSX_PAT is not set}") ;;
  *) echo "unknown registry: $registry" >&2; exit 2 ;;
esac

for attempt in $(seq 1 "$attempts"); do
  output=$("${publish[@]}" 2>&1) && { printf '%s\n' "$output"; exit 0; }

  printf '%s\n' "$output"

  if grep -qiE "already exists|already published|version.*already" <<< "$output"; then
    echo "$registry already has this version — nothing to do."
    exit 0
  fi

  if [ "$attempt" -eq "$attempts" ]; then
    echo "$registry publish failed after $attempts attempts." >&2
    exit 1
  fi

  delay=$((attempt * 20))
  echo "$registry publish failed (attempt $attempt/$attempts); retrying in ${delay}s."
  sleep "$delay"
done
