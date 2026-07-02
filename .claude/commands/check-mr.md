---
allowed-tools: mcp__gitlab__*
description: Code review of an MR by URL (check-mr)
---

Perform a code review for a Merge Request.

## Input

URL: $ARGUMENTS

## Algorithm

### 1. Parse the URL

Extract from the URL:
- `project_path` — path to the project (e.g. `templates/nextjs-template`)
- `merge_request_iid` — MR number

URL format: `https://gitlab.chulakov.org/<project_path>/-/merge_requests/<iid>`

### 2. Get MR Information

```
mcp__gitlab__execute_tool toolName="get_merge_request" params={"project_id": "<project_path>", "merge_request_iid": <iid>}
```

Output a brief summary:
- Title and description
- Author and reviewer
- Status (opened/merged/closed)
- Branches (source → target)
- Number of changes

### 3. Get Diffs

```
mcp__gitlab__execute_tool toolName="get_merge_request_diffs" params={"project_id": "<project_path>", "merge_request_iid": <iid>}
```

### 4. Perform Code Review

Check the code against project documentation:
- `.claude/docs/code-style.md` — code style
- `.claude/docs/accessibility.md` — accessibility
- `.claude/docs/naming.md` — naming conventions

Categorize issues:
- **Critical** — bugs, security violations
- **Accessibility** — accessibility issues
- **Code style** — code style violations
- **Semantics** — HTML semantics
- **Minor** — minor improvements

### 5. Get Current Discussions

```
mcp__gitlab__execute_tool toolName="mr_discussions" params={"project_id": "<project_path>", "merge_request_iid": <iid>}
```

Check:
- Which threads are resolved, which are unresolved
- Whether resolved threads match the current code (was the issue fixed)
- Are there new issues not covered by comments

### 6. Compile the Report

Output:
1. MR summary
2. Found issues with file and line references
3. Status of current discussions
4. List of actions:
   - New comments to create
   - Resolved threads to reopen (if the issue was not fixed)

### 7. Request Confirmation

**IMPORTANT:** Before creating new comments or reopening resolved threads — ALWAYS ask the user for confirmation via AskUserQuestion.

Options:
- "Leave all comments" — create new + reopen
- "Only new" — create only new comments
- "Only reopen" — reopen resolved threads
- "Do not leave" — only show the report

### 8. Execute Actions

After confirmation:
- Create new threads via `create_merge_request_thread`
- Add comments to resolved threads to reopen them via `create_merge_request_note`

## Comment Format

**Rules:**
- Write in a human, friendly tone — not dry
- Explain "why", not just "what"
- Friendly tone, without being preachy
- Propose solution options

**Template:**

```markdown
<Description of the problem and why it matters>

```<language>
<Proposed fix>
```
```

**Example:**

```markdown
Screen readers won't be able to describe this button — alt is missing. You can add:

\`\`\`tsx
alt="Play video"
\`\`\`
```

## Example Call

```
/mr https://gitlab.chulakov.org/templates/nextjs-template/-/merge_requests/39
```
