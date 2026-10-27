# Notes for Claude

## Git workflow
- Claude can push but cannot delete remote branches, so never create one-off branches.
- Use the single reusable branch `claude-work` to run CI (`.github/workflows/ci.yml`) before changes reach `main`:
  1. `git checkout -B claude-work origin/main`, then commit.
  2. `git push --force origin claude-work` and wait for the "Checks" run to pass (`gh run list -b claude-work`).
  3. Fast-forward `main` to it and push: `git checkout main && git merge --ff-only claude-work && git push origin main`.
- Pushing to `main` triggers the deploy workflow (data refresh + GitHub Pages).
- Juan also edits from his Mac, so always pull/rebase on `origin/main` first.
