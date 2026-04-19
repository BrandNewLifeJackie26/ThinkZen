@AGENTS.md

# Feature Development Workflow

Before starting any new feature, always create a dedicated git worktree and branch:

```bash
git worktree add .claude/worktrees/<feature-name> -b <feature-name>
```

Work exclusively in that worktree for the duration of the feature. Never implement new features directly on `main`.

Once the PR is merged, clean up the worktree:

```bash
git worktree remove .claude/worktrees/<feature-name>
git branch -d <feature-name>
```

# Pull Request Guidelines

Always follow the PR template in `.github/pull_request_template.md`. For the Validations section:

- **Frontend changes**: paste screenshots demonstrating the UI changes and test results
- **Backend changes**: paste test results (unit/integration) confirming correctness

# Database Migrations

Always name migration files with a meaningful name that describes the migration intent (e.g. `add_session_expires_at_column`, `create_thoughts_table`). Never use generic or auto-generated names.
