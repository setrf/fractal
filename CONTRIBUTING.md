# Contributing

## Workflow Rules

These rules are required for all changes in this repository:

1. Update docs and inline comments alongside code changes.
2. Commit early and often in small, reviewable chunks.
3. Push commits to `origin` after each commit.

## Docs and Comment Expectations

- If behavior changes, update `README.md` and/or `CHANGELOG.md`.
- Keep code comments accurate when logic changes.
- Prefer concise comments that explain intent, not obvious syntax.

## Git Hooks

This repo uses a tracked pre-commit hook in `.githooks/pre-commit` to enforce docs updates when code changes are staged.

Enable hooks locally:

```bash
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit
```

## Recommended Commit Rhythm

- Make a commit when a single concern is complete.
- Keep commit messages specific and imperative.
- Push immediately after each commit.
