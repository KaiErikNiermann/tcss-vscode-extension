#!/usr/bin/env bash
# Re-download the real-world TCSS corpus and record the commits it came from.
#
# The corpus is vendored rather than fetched at test time so the suite is
# hermetic. Re-run this when upstream adds stylesheets worth testing against;
# expect `just test-corpus` to fail afterwards if they use a construct the
# grammar does not handle yet, which is the point of keeping it fresh.
set -euo pipefail

cd "$(dirname "$0")/.."
DEST=test/fixtures/corpus
REPOS=(Textualize/textual Textualize/textual-dev)

command -v gh >/dev/null || { echo "gh is required" >&2; exit 1; }

rm -f "$DEST"/*.tcss
mkdir -p "$DEST"

{
  echo "# TCSS corpus"
  echo
  echo "Real stylesheets, vendored so the parser is tested against what people actually write rather than against fixtures written to match the grammar. Every file parses with zero lexer and parser errors, which \`test/corpus.test.mts\` enforces."
  echo
  echo "Refresh with \`just corpus-refresh\`. Collected $(date -u +%Y-%m-%d)."
  echo
  echo "| Source | Commit | Files |"
  echo "| --- | --- | --- |"
} > "$DEST/README.md"

for repo in "${REPOS[@]}"; do
  sha=$(gh api "repos/$repo/commits/HEAD" --jq '.sha')
  name=${repo#*/}
  count=0
  while read -r path; do
    [ -n "$path" ] || continue
    out="$DEST/${name}__${path//\//__}"
    curl -sfL "https://raw.githubusercontent.com/$repo/$sha/$path" -o "$out"
    count=$((count + 1))
  done < <(gh api "repos/$repo/git/trees/$sha?recursive=1" \
             --jq '.tree[] | select(.path | endswith(".tcss")) | .path')
  echo "| [$repo](https://github.com/$repo) | \`${sha:0:12}\` | $count |" >> "$DEST/README.md"
  echo "$repo @ ${sha:0:12}: $count files"
done

{
  echo
  echo 'All sources are MIT licensed. File names encode their origin path, with `/` replaced by `__`.'
} >> "$DEST/README.md"

echo "corpus written to $DEST"
