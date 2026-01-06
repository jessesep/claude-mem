# Issue Workflow: Fork First, Main Repo When Ready

This document describes the workflow for creating and managing issues, starting on your fork and moving to the main repo when ready.

## Workflow

### 1. Create Issues on Your Fork First

Always create issues on your fork (`jessesep/claude-mem`) first:

```bash
# Create issue on your fork
gh issue create --repo jessesep/claude-mem \
  --title "Your Issue Title" \
  --body "Issue description" \
  --label "enhancement"
```

### 2. Work on Issues Locally

- Track progress in your fork
- Refine issue descriptions
- Add comments and updates
- Link to PRs in your fork

### 3. Move to Main Repo When Ready

When an issue is ready for the main repository:

```bash
# Export issue from fork
gh issue view <issue-number> --repo jessesep/claude-mem \
  --json title,body,labels > /tmp/issue.json

# Create on main repo
gh issue create --repo thedotmack/claude-mem \
  --title "$(cat /tmp/issue.json | jq -r .title)" \
  --body "$(cat /tmp/issue.json | jq -r .body)" \
  --label "$(cat /tmp/issue.json | jq -r '.labels[].name' | tr '\n' ',' | sed 's/,$//')"

# Optionally close the fork issue with a reference
gh issue comment <issue-number> --repo jessesep/claude-mem \
  --body "Moved to main repo: https://github.com/thedotmack/claude-mem/issues/<new-number>"
```

## Helper Script

A helper script can automate this process. See `.github/scripts/move-issue-to-main.sh` (if created).

## Current Issues on Fork

All plugin hooks implementation issues are on your fork:

- #1 - Fix: Missing shebang banner for context-generator
- #2 - Enhancement: Add comprehensive hook execution logging
- #3 - Enhancement: Verify Windows compatibility
- #4 - Documentation: Hook development guide
- #5 - Enhancement: Monitor hook timeouts
- #6 - Enhancement: Cursor hooks testing

View them at: https://github.com/jessesep/claude-mem/issues

## Benefits of This Approach

1. **Iterate freely** - Refine issues without cluttering main repo
2. **Track your work** - Keep issues linked to your fork's PRs
3. **Quality control** - Only move polished issues to main repo
4. **Personal backlog** - Maintain your own issue tracker
