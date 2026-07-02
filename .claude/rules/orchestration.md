---
paths: src/**/*.tpl, src/**/*.twig, src/**/ds.json
---

# Orchestration via Sub-agents

## Agent Triggers

| Agent | When to use | Triggers |
|-------|------------|----------|
| **ds-inspector** | Before fixing — diagnose visually, determine scope | QA issues list, "check what's wrong", unclear DS vs section scope |
| **landing-inspector** | Problem on external URL | URL with problem, "fix issues from this landing" |
| **ds-fixer** | After diagnosis — fix problems. Provide `problem` + `expected` + `company` | Confirmed problem, QA output, "fix/repair/align", explicit .tpl changes |
| **twig-sync** | After ANY change to `src/index.ds.css.twig` | Main twig changed, new CSS var in `:root`, `.container`/`.footer`/`.header` updated |
| **section-remover** | Removing a section — don't delete manually | "remove section", "delete template" |
| **template-creator** | Creating template from HTML code | "create template", "add section", HTML code provided |
| **/audit-ds** | Cross-company consistency audit | "audit", "check consistency", before major export |

**ds-fixer also triggers for explicit .tpl changes** — even "change X to Y in template Z" goes through ds-fixer for before/after visual verification.

## Orchestration Flows

### Flow 1: Fix by List of Issues — `/fix-issues`

**Automated command** — runs the full pipeline:

```
/fix-issues minimal "buttons too small, cards have no shadow, h2 in FAQ too large"
/fix-issues avito --from-report app/docs/reports/20260319/analysis.md
```

Pipeline: diagnosis → parallel fixes → visual verification → commit.

**Manual equivalent** (when you need more control):

1. ds-inspector → structured task list
2. Split into DS-level and section-level tasks
3. ds-fixer agents in PARALLEL (one message, multiple Task calls)
4. Review: ✅ → commit, ⚠️/❌ → refine and retry
5. `/commit`

### Flow 2: Fix by Landing Page URL

1. landing-inspector → mapped task list
2. Review mapped problems
3. ds-fixer in PARALLEL for confirmed problems
4. Compare with landing screenshots
5. `/commit`

### Flow 3: Fix by Localhost URL

1. ds-inspector → confirm problem + scope
2. ds-fixer in PARALLEL based on output
3. Review → `/commit`

### Flow 4: Explicit Template Changes

1. Categorize: ≤5 templates → ds-fixer each; 6+ identical → Bash/sed
2. For targeted: ds-fixer in PARALLEL with before/after screenshots
3. For mass: Bash/sed, then ds-inspector to verify
4. `/commit`

## Orchestration Protocol

### Task Decomposition

One fix per DS-level group or section type. Don't combine unrelated changes.

### Parallel Execution

All independent fixes in **a single message** via Task tool:

```
subagent_type: ds-fixer
prompt: |
  company: minimal
  target: stats/numbers-row
  problem: numbers appear as regular text — too small
  expected: large accent numbers, ~2-3rem, bold, primary color
```

Typical parallel groups:
- Multiple section types with same problem → each type = separate agent
- Independent visual fixes → each = separate agent
- Global + local fixes → global separately, local in parallel

### ds-fixer Prompt

Required: `company`, `problem`, `expected`
Optional: `target` (path), `scope: global` (for twig/ds.json)

### Review Results

- ✅ → collect for commit
- ⚠️/❌ → run ds-fixer again with refined prompt

### Company Isolation

For avito/pik/jti/yandex/sandbox/vtb/dds — **only modify their files**. Don't touch `minimal` — it's the base library (443 templates).

### What NOT to Delegate

- Template creation from scratch → do yourself
- `template.json` / `templates.json` edits → do yourself
- `pages/*.html` changes → do yourself
- DS architecture decisions → decide yourself, delegate implementation
- Mass mechanical replacements (10+ files, same pattern) → Bash/sed, then ds-inspector to verify
