---
allowed-tools: mcp__jira__*, Bash(git:*)
description: Automatic time logging to Jira tasks
---

Automatically log time to Jira tasks based on today's activity.

## 1. Documentation

Read `.claude/docs/jira.md` to understand the API and logging rules.

## 2. Active Tasks

Get all tasks assigned to the current user that are in progress:

```
mcp__jira__jira_search jql="assignee = currentUser() AND status in ('In work', 'In progress', 'In Work', 'In Progress')" fields="summary,status,project,timetracking" limit=20
```

Remember the project(s) from the results — they will be needed for forming descriptions.

## 3. Analyze Today's Work

Analyze git activity:

```
git log --since="00:00" --oneline --all
```

```
git diff --stat HEAD~5
```

```
git status --short
```

Determine:
- Which files/components were changed
- Which tasks are mentioned in commits (look for the pattern PROJ-123)
- Nature of the work (development, fix, refactoring, review)

## 4. Check Logged Time

Find out how much time has already been logged today:

```
mcp__jira__jira_search jql="worklogDate = today() AND worklogAuthor = currentUser()" fields="summary,worklog" limit=50
```

For each found task, get the worklogs and sum up the time for today.

**Rule:** Maximum 8 hours per day. If 8h is already logged — report this and do not log more.

## 5. Time Distribution

Based on:
- Active tasks
- Git activity (which tasks are mentioned, which files were changed)
- Remaining time (8h - already logged)

Propose a distribution:

```
| Task       | Time | Description                       |
|------------|------|-----------------------------------|
| PROJ-123   | 3h   | Development of Header component   |
| PROJ-456   | 2h   | Bug fixes in authorization form   |
| PROJ-789   | 1h   | Code review MR #42                |
```

**Description rules:**
- Specific about what was done (not "work on task")
- In Russian
- Brief, 5-10 words

## 6. Confirmation

**MANDATORY** — ask for confirmation via AskUserQuestion:

- "Log as proposed"
- "Change the distribution" — ask for clarification
- "Cancel"

## 7. Logging

After confirmation, for each task:

```
mcp__jira__jira_add_worklog issue_key="PROJ-123" time_spent="3h" comment="Work description"
```

Output a summary:
- How much was logged
- Which tasks
- How much remains until 8h

## Arguments

If `$ARGUMENTS` is provided:
- A number (e.g. `6`) — log the specified number of hours instead of 8
- A task key (e.g. `PROJ-123`) — log only to this task
