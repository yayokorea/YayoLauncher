#!/usr/bin/env bash
# Usage: changelog.sh <tag>
# Prints release notes for <tag>, built from commit subjects since the previous v* tag.
# Commits are grouped by conventional-commit prefix; unprefixed commits go to "기타 변경".
set -euo pipefail

TAG="${1:?usage: changelog.sh <tag>}"
REPO="${GITHUB_REPOSITORY:-yayokorea/YayoLauncher}"
VERSION="${TAG#v}"

PREV="$(git describe --tags --abbrev=0 --match 'v*' "${TAG}^" 2>/dev/null || true)"
if [ -n "$PREV" ]; then RANGE="${PREV}..${TAG}"; else RANGE="$TAG"; fi

# Skip merge commits and bare version bumps like "5.0.1".
SUBJECTS="$(git log "$RANGE" --no-merges --pretty=format:'%s' | grep -vE '^[0-9]+\.[0-9]+\.[0-9]+([-.][0-9A-Za-z.]+)?$' || true)"

section() {
  local title="$1" pattern="$2" lines
  lines="$(printf '%s\n' "$SUBJECTS" | grep -iE "$pattern" | sed -E 's/^[a-z]+(\([^)]*\))?!?:[[:space:]]*//I; s/^/- /' || true)"
  if [ -n "$lines" ]; then printf '### %s\n\n%s\n\n' "$title" "$lines"; fi
}

OTHERS="$(printf '%s\n' "$SUBJECTS" | grep -viE '^(feat|fix|perf|style|ui|refactor|docs|chore|ci|build|test)(\([^)]*\))?!?:' | grep -v '^$' | sed 's/^/- /' || true)"

cat <<EOF
## YayoLauncher ${VERSION}

EOF

section "✨ 새 기능" '^feat(\([^)]*\))?!?:'
section "🐛 버그 수정" '^fix(\([^)]*\))?!?:'
section "🎨 디자인" '^(style|ui)(\([^)]*\))?!?:'
section "⚡ 성능 · 리팩터링" '^(perf|refactor)(\([^)]*\))?!?:'
section "🔧 빌드 · 기타" '^(docs|chore|ci|build|test)(\([^)]*\))?!?:'
if [ -n "$OTHERS" ]; then printf '### 📝 기타 변경\n\n%s\n\n' "$OTHERS"; fi

cat <<EOF
### 📦 설치

| 플랫폼 | 파일 |
| --- | --- |
| Windows | \`YayoLauncher-Setup-${VERSION}.exe\` |
| macOS | \`YayoLauncher-${VERSION}.dmg\` |
| Linux | \`YayoLauncher-${VERSION}.AppImage\`, \`.deb\`, \`.rpm\` |

설치된 런처는 실행할 때 새 버전을 자동으로 확인합니다. (macOS와 Linux deb/rpm은 수동 업데이트)

EOF

if [ -n "$PREV" ]; then
  echo "**Full Changelog**: https://github.com/${REPO}/compare/${PREV}...${TAG}"
fi
