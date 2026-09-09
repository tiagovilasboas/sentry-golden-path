# Cursor adapter

Optional. [AGENTS.md](../../AGENTS.md) is the source of truth for every harness.

To use this kit inside Cursor, copy [`sentry-golden-path.mdc`](sentry-golden-path.mdc) to `.cursor/rules/` in the **app** repo you are instrumenting — not as a second policy file that diverges from AGENTS.md.

Do not add Cursor-only secrets, DSNs, or org slugs here.
