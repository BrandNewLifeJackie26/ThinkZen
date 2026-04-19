@AGENTS.md

# Feature Development Workflow

Before starting any new feature, always create a dedicated git worktree and branch:

```bash
git worktree add .claude/worktrees/<feature-name> -b <feature-name>
```

Work exclusively in that worktree for the duration of the feature. Never implement new features directly on `main`.

# Database Migrations

Always name migration files with a meaningful name that describes the migration intent (e.g. `add_session_expires_at_column`, `create_thoughts_table`). Never use generic or auto-generated names.
