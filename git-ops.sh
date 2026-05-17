#!/bin/bash
cd M:/GitHub/maestria-lms || exit 1

echo "=== GIT STATUS ==="
git status --short

echo ""
echo "=== STAGING FILES ==="
git add src/lib/auth.ts src/components/LessonPage.tsx src/components/ProfilePage.tsx

echo ""
echo "=== STATUS AFTER STAGE ==="
git status --short

echo ""
echo "=== COMMITTING ==="
git commit -m "$(cat <<'EOF'
fix: heatmap crash, quiz NaN, bookmark IDs, and improve course progress UI

- Fix undefined totalWeeks/weekSize causing ProfilePage heatmap crash
- Fix unsafe type casting in auth.ts session callback preventing null dereference
- Add NaN guard for quiz answer checking when correctAnswer is invalid
- Replace raw cuid ID fallback in bookmarks with proper loading state
- Enhance enrolled course cards with color-coded progress bars and completion icons
EOF
)"

echo ""
echo "=== LOCAL BRANCHES BEFORE CLEANUP ==="
git branch

echo ""
echo "=== DELETING NON-MAIN BRANCHES ==="
for branch in $(git branch --format='%(refname:short)' | grep -v '^main$'); do
  echo "Deleting: $branch"
  git branch -D "$branch" 2>/dev/null || git branch -d "$branch" 2>/dev/null || echo "  Skipped (current branch or protected)"
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
echo "=== DELETING REMOTE NON-MAIN BRANCHES ==="
for branch in $(git branch -r --format='%(refname:short)' | grep 'origin/' | grep -v 'origin/main$' | grep -v 'origin/HEAD' | sed 's|origin/||'); do
  echo "Deleting remote: $branch"
  git push origin --delete "$branch" 2>&1 || echo "  Skipped (protected or already deleted)"
done

echo ""
echo "=== FINAL STATUS ==="
git status --short
git branch -a

echo ""
echo "=== DONE ==="
