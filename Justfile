set shell := ["bash", "-eu", "-o", "pipefail", "-c"]

# List recipes
default:
    @just --list

# --- Development setup ---

# Install dependencies and wire up the pre-push hook
dev:
    pnpm install
    git config core.hooksPath .githooks
    @echo "Development environment ready!"

# --- Langium ---

# Regenerate the parser, AST and module from src/language/tcss.langium
generate:
    pnpm run langium:generate

# Regenerate on every grammar change
generate-watch:
    pnpm run langium:watch

# Fail if the committed generated sources are stale relative to the grammar
generate-check: generate
    #!/usr/bin/env bash
    set -euo pipefail
    if ! git diff --quiet -- src/language/generated; then
        echo "error: src/language/generated is stale — run 'just generate' and commit" >&2
        git --no-pager diff --stat -- src/language/generated >&2
        exit 1
    fi
    echo "generated sources are up to date"

# --- TypeScript ---

# Bundle the extension host entry point and the language server into out/
build:
    pnpm run build

# Rebuild on every change
build-watch:
    pnpm run watch

# Type check everything: sources, tests and configs
typecheck:
    pnpm run typecheck

# Lint
lint:
    pnpm run lint

# Fix what the linter can fix
lint-fix:
    pnpm run lint:fix

# --- Tests ---

# Run the whole suite
test:
    pnpm run test

# Re-run on change
test-watch:
    pnpm run test:watch

# Coverage report over src/
coverage:
    pnpm run coverage

# Property-based fuzzing; pass a case count, e.g. `just fuzz 50000`
fuzz runs="2000":
    FUZZ_RUNS={{runs}} FUZZ_SEED=0 pnpm exec vitest run test/fuzz.test.mts

# A long unseeded fuzz session, for when the grammar changes shape
fuzz-hard:
    @just fuzz 100000

# Parse every vendored real-world stylesheet
test-corpus:
    pnpm exec vitest run test/corpus.test.mts

# Re-download the corpus from upstream and record the commits it came from
corpus-refresh:
    ./scripts/refresh-corpus.sh

# --- Combined ---

# Everything CI runs, in the order it runs it
check: generate-check lint typecheck test

# Remove build output and dependencies
clean:
    rm -rf out coverage node_modules ./*.vsix

# --- Local install ---

# Build, package and install into VS Code or VSCodium for live testing
#
# Override the editor with EDITOR_CLI=codium. The upstream extension is removed
# first: both inject a grammar into Python, so running the two together
# reintroduces the very bug this fork fixes.
install-local: build
    #!/usr/bin/env bash
    set -euo pipefail
    editor="${EDITOR_CLI:-}"
    if [ -z "$editor" ]; then
      for candidate in code codium code-oss vscodium; do
        if command -v "$candidate" >/dev/null 2>&1; then editor="$candidate"; break; fi
      done
    fi
    if [ -z "$editor" ]; then
      echo "No editor CLI found (tried code, codium, code-oss, vscodium)." >&2
      echo "Set EDITOR_CLI to the command for your editor and re-run." >&2
      exit 1
    fi
    pnpm exec vsce package --no-dependencies
    vsix=$(ls -t ./*.vsix | head -1)
    if "$editor" --list-extensions | grep -qx "Textualize.textual-syntax-highlighter"; then
      echo "Removing the upstream extension — two Python injections would conflict."
      "$editor" --uninstall-extension Textualize.textual-syntax-highlighter
    fi
    "$editor" --install-extension "$vsix" --force
    echo
    echo "Installed $vsix into $editor — run 'Developer: Reload Window'."

# --- Versioning & Release ---

# Show current version
version:
    @node -p "require('./package.json').version"

# Bump version, commit, tag, push, create GitHub release
release bump="patch":
    #!/usr/bin/env bash
    set -euo pipefail
    current=$(node -p "require('./package.json').version")
    IFS='.' read -r major minor patch <<< "$current"
    case "{{bump}}" in
        major) major=$((major + 1)); minor=0; patch=0 ;;
        minor) minor=$((minor + 1)); patch=0 ;;
        patch) patch=$((patch + 1)) ;;
        *) echo "Invalid bump type: {{bump}} (use major, minor, or patch)"; exit 1 ;;
    esac
    just _release "$major.$minor.$patch"

# Release with an explicit version
release-version version:
    @just _release "{{version}}"

# Re-tag HEAD and re-trigger the release workflow for an existing version
rerun version:
    #!/usr/bin/env bash
    set -euo pipefail
    version=$(just _normalize-version "{{version}}")
    git push
    git tag -d "v$version" 2>/dev/null || true
    git push --delete origin "v$version" 2>/dev/null || true
    git tag "v$version"
    git push origin "v$version"
    echo "Re-triggered release workflow for v$version"

# Delete and recreate the GitHub release + retag HEAD
rerelease version:
    #!/usr/bin/env bash
    set -euo pipefail
    version=$(just _normalize-version "{{version}}")
    gh release delete "v$version" -y 2>/dev/null || true
    just rerun "$version"

# Internal: bump the manifest, commit, tag, push — the workflow does the publishing
_release version:
    #!/usr/bin/env bash
    set -euo pipefail
    version=$(just _normalize-version "{{version}}")
    just check
    npm version "$version" --no-git-tag-version --allow-same-version
    git add package.json CHANGELOG.md
    git commit -m "chore(release): v$version"
    git push
    git tag "v$version"
    git push origin "v$version"
    echo "Tagged v$version — the release workflow packages it, attaches the vsix and publishes"

# Internal: strip an optional leading 'v' and validate X.Y.Z (prints normalized)
_normalize-version version:
    #!/usr/bin/env bash
    set -euo pipefail
    v="{{version}}"
    v="${v#v}"  # tolerate a v-prefixed arg without producing a 'vv' tag
    if [[ ! "$v" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        echo "error: invalid version '{{version}}' — expected X.Y.Z (a leading 'v' is allowed)" >&2
        exit 1
    fi
    printf '%s' "$v"

# --- Publishing ---

# List exactly what would go into the vsix
publish-vsix-dry: build
    pnpm exec vsce ls --no-dependencies

# Publish to the VS Code Marketplace and Open VSX
#
# Open VSX is what VSCodium and other non-Microsoft builds read; it needs
# OVSX_PAT and a one-time
# `pnpm exec ovsx create-namespace kaierikniermann -p $OVSX_PAT`.
publish-vsix: build
    #!/usr/bin/env bash
    set -euo pipefail
    pnpm exec vsce package --no-dependencies
    vsix=$(ls -t ./*.vsix | head -1)
    pnpm exec vsce publish --no-dependencies --packagePath "$vsix"
    if [ -n "${OVSX_PAT:-}" ]; then
      pnpm exec ovsx publish "$vsix" -p "$OVSX_PAT"
    else
      echo "OVSX_PAT unset — skipping Open VSX; VSCodium users will not see this version." >&2
    fi

# Wait for the release workflow to finish
wait-release:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "Waiting for the release workflow..."
    run_id=$(gh run list --workflow release --limit 1 --json databaseId -q '.[0].databaseId')
    gh run watch "$run_id" --exit-status && \
        echo "Release workflow succeeded" || \
        { echo "Release workflow failed"; exit 1; }
