#!/bin/bash
# Git operations script for Maestria LMS
# Automatically detects repository root and performs common operations

set -e

# Navigate to repository root
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [ -z "$REPO_ROOT" ]; then
  echo "Error: Not in a git repository"
  exit 1
fi

cd "$REPO_ROOT" || exit 1

echo "=== GIT STATUS ==="
git status --short

echo ""
echo "=== STAGING ALL CHANGES ==="
git add -A

echo ""
echo "=== STATUS AFTER STAGE ==="
git status --short

echo ""
echo "=== COMMITTING ==="
# Use provided commit message or default
COMMIT_MSG="${1:-chore: automated commit}"
git commit -m "$COMMIT_MSG"

echo ""
echo "=== LOCAL BRANCHES BEFORE CLEANUP ==="
git branch

echo ""
echo "=== DELETING NON-MAIN BRANCHES ==="
CURRENT_BRANCH=$(git branch --show-current)
for branch in $(git branch --format='%(refname:short)' | grep -v '^main$'); do
  if [ "$branch" = "$CURRENT_BRANCH" ]; then
    echo "Skipping current branch: $branch"
    continue
  fi
  echo "Deleting: $branch"
  git branch -D "$branch" 2>/dev/null || echo "  Skipped (has unmerged commits)"
done

echo ""
echo "=== REMAINING BRANCHES ==="
git branch

echo ""
echo "=== REMOTES ==="
git remote -v

echo ""
echo "=== FETCHING ==="
git fetch origin 2>&1

echo ""
echo "=== PULLING LATEST MAIN ==="
git pull origin main 2>&1 || echo "Pull may need authentication"

echo ""
echo "=== PUSHING ==="
git push origin main 2>&1 || echo "Push may need authentication"

echo ""
echo "=== FINAL STATUS ==="
git status --short
git branch -a

echo ""
echo "=== DONE ==="
