#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "=== Git Status ==="
git status --short

echo ""
echo "=== Adding changed files ==="
git add -A

echo ""
echo "=== Committing ==="
git commit -m "fix: add quiz answer checking and fix JSON parse crash in LessonPage

- Add interactive quiz answer validation with visual feedback
- Fix potential JSON.parse crash when assignment.options is invalid
- Add proper error handling for quiz option parsing
- Show correct/incorrect answer highlighting after submission"

echo ""
echo "=== Pushing to origin main ==="
git push origin main

echo ""
echo "=== Deleting non-main local branches ==="
for branch in $(git branch | grep -v 'main' | sed 's/^[* ]*//'); do
  echo "Deleting branch: $branch"
  git branch -D "$branch" 2>/dev/null || echo "Skipped: $branch"
done

echo ""
echo "=== Final status ==="
git branch -a
git status --short

echo ""
echo "=== DONE ==="
