# Working with GitLab

## Architecture

```
Claude Code  <--stdio-->  efficient-gitlab-mcp-server  <--REST API-->  GitLab Server
```

The MCP server starts automatically via npx when Claude Code starts.

## GitLab Server

- **URL:** https://gitlab.chulakov.org
- **Type:** GitLab Self-Managed

## Setup

### 1. Get a Personal Access Token

1. Go to GitLab → **Settings → Access Tokens**
2. Create a token with permissions:
   - `api` — full API access
   - `read_repository` — read repositories
   - `write_repository` — write to repositories (optional)

### 2. Add Configuration to the Project

In the `~/.claude.json` file, add to the `projects.<project_path>.mcpServers` section:

```json
{
  "gitlab": {
    "type": "stdio",
    "command": "npx",
    "args": ["-y", "efficient-gitlab-mcp-server"],
    "env": {
      "GITLAB_PERSONAL_ACCESS_TOKEN": "glpat-xxxxxxxxxxxx",
      "GITLAB_API_URL": "https://gitlab.chulakov.org"
    }
  }
}
```

Or create `.claude/.mcp.json` in the project root:

```json
{
  "mcpServers": {
    "gitlab": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "efficient-gitlab-mcp-server"],
      "env": {
        "GITLAB_PERSONAL_ACCESS_TOKEN": "glpat-xxxxxxxxxxxx",
        "GITLAB_API_URL": "https://gitlab.chulakov.org"
      }
    }
  }
}
```

### 3. Verify the Connection

```bash
# List categories
mcp__gitlab__list_categories

# List projects
mcp__gitlab__execute_tool toolName="list_projects"
```

## Available Categories and Tools

### Repositories (9 tools)

| Tool | Description |
|------------|----------|
| `search_repositories` | Search projects |
| `get_file_contents` | Get file contents |
| `create_repository` | Create a project |
| `fork_repository` | Fork a project |
| `create_branch` | Create a branch |
| `get_repository_tree` | Get file tree |
| `create_or_update_file` | Create/update a file |
| `push_files` | Push multiple files |
| `get_branch_diffs` | Get diff between branches |

### Merge Requests (13 tools)

| Tool | Description |
|------------|----------|
| `list_merge_requests` | List project MRs |
| `get_merge_request` | MR details |
| `create_merge_request` | Create an MR |
| `update_merge_request` | Update an MR |
| `merge_merge_request` | Merge an MR |
| `get_merge_request_diffs` | Get MR diff |
| `mr_discussions` | MR discussions |
| `create_merge_request_thread` | Create a thread |
| `resolve_merge_request_thread` | Resolve a thread |
| `create_merge_request_note` | Add a comment |
| `update_merge_request_note` | Update a comment |
| `delete_merge_request_note` | Delete a comment |
| `get_merge_request_notes` | List comments |

### Issues (12 tools)

| Tool | Description |
|------------|----------|
| `list_issues` | List project issues |
| `my_issues` | Issues assigned to me |
| `get_issue` | Issue details |
| `create_issue` | Create an issue |
| `update_issue` | Update an issue |
| `delete_issue` | Delete an issue |
| `list_issue_links` | Links between issues |
| `create_issue_link` | Create a link |
| `delete_issue_link` | Delete a link |
| `list_issue_discussions` | Issue discussions |
| `create_issue_note` | Add a comment |
| `update_issue_note` | Update a comment |

### Projects (9 tools)

| Tool | Description |
|------------|----------|
| `list_projects` | List available projects |
| `get_project` | Project details |
| `list_project_members` | Project members |
| `list_labels` | Project labels |
| `get_label` | Get a label |
| `create_label` | Create a label |
| `update_label` | Update a label |
| `delete_label` | Delete a label |
| `list_group_projects` | Group projects |

### Commits (3 tools)

| Tool | Description |
|------------|----------|
| `list_commits` | List commits |
| `get_commit` | Commit details |
| `get_commit_diff` | Commit diff |

### Search (3 tools)

| Tool | Description |
|------------|----------|
| `global_search` | Global search |
| `project_search` | Search within a project |
| `group_search` | Search within a group |

## Usage Examples

```bash
# Get tool schema
mcp__gitlab__get_tool_schema toolName="list_merge_requests"

# List projects
mcp__gitlab__execute_tool toolName="list_projects" params={}

# Project MRs (opened)
mcp__gitlab__execute_tool toolName="list_merge_requests" params={"project_id": "123", "state": "opened"}

# MRs assigned to me
mcp__gitlab__execute_tool toolName="list_merge_requests" params={"project_id": "123", "scope": "assigned_to_me", "state": "opened"}

# Global MR search
mcp__gitlab__execute_tool toolName="global_search" params={"scope": "merge_requests", "search": "fix", "state": "opened"}

# File contents
mcp__gitlab__execute_tool toolName="get_file_contents" params={"project_id": "123", "path": "README.md"}
```

## Code Review Comments

### Get MR Discussions

```bash
# IMPORTANT: always specify per_page: 100 and check all pages!
mcp__gitlab__execute_tool toolName="mr_discussions" params={
  "project_id": "group/project",
  "merge_request_iid": 39,
  "per_page": 100
}
```

Returns a list of threads with fields:
- `id` — thread ID
- `notes` — array of comments in the thread
- `notes[].resolved` — whether the comment is resolved
- `notes[].position` — attachment to a code line

### Create a Thread Attached to a Line

```bash
mcp__gitlab__execute_tool toolName="create_merge_request_thread" params={
  "project_id": "group/project",
  "merge_request_iid": 39,
  "body": "**Bug:** Problem description\n\n```tsx\nfixed code\n```",
  "position": {
    "base_sha": "abc123",
    "start_sha": "abc123",
    "head_sha": "def456",
    "position_type": "text",
    "new_path": "app/src/components/Video.tsx",
    "new_line": 42
  }
}
```

**Position parameters:**
| Parameter | Description |
|----------|----------|
| `base_sha` | Base commit SHA (from `diff_refs.base_sha` of the MR) |
| `start_sha` | Start commit SHA (from `diff_refs.start_sha` of the MR) |
| `head_sha` | Head commit SHA (from `diff_refs.head_sha` of the MR) |
| `position_type` | `text` for code, `image` for images |
| `new_path` | Path to the file in the new version |
| `new_line` | Line number in the new file |
| `old_path` | Path to the file in the old version (for changed lines) |
| `old_line` | Line number in the old file (for deleted lines) |

### Add a Comment to an Existing Thread

```bash
mcp__gitlab__execute_tool toolName="create_merge_request_note" params={
  "project_id": "group/project",
  "merge_request_iid": 39,
  "body": "Comment text"
}
```

### Resolve/Reopen a Thread

```bash
mcp__gitlab__execute_tool toolName="resolve_merge_request_thread" params={
  "project_id": "group/project",
  "merge_request_iid": 39,
  "discussion_id": "thread_id_here",
  "resolved": true
}
```

### Comment Format for Code Review

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

## /mr Command

For automated code review, use the command:

```
/mr https://gitlab.chulakov.org/group/project/-/merge_requests/123
```

The command:
1. Gets MR details and diffs
2. Performs review against docs (code-style, accessibility, naming)
3. Checks current discussions
4. Requests confirmation before creating comments

## Pagination — CRITICAL

**By default the API returns only 20 records per page!**

When working with `mr_discussions`, `list_merge_requests`, `list_issues` and other list operations:

1. **Always specify `per_page: 100`** to get the maximum number of records
2. **Check multiple pages** — if there are more than 100 records, request `page: 2`, `page: 3`, etc.
3. **Count unresolved threads** via jq after getting the data

### Example of Correctly Getting All MR Discussions

```bash
# Page 1 (up to 100 records)
mcp__gitlab__execute_tool toolName="mr_discussions" params={
  "project_id": "group/project",
  "merge_request_iid": 85,
  "per_page": 100,
  "page": 1
}

# Page 2 (if present)
mcp__gitlab__execute_tool toolName="mr_discussions" params={
  "project_id": "group/project",
  "merge_request_iid": 85,
  "per_page": 100,
  "page": 2
}
```

### Counting Unresolved Threads

If the result is saved to a file, use jq:

```bash
cat result.txt | jq -r '.[0].text' | jq '[.[] | select(.notes[0].resolvable == true and .notes[0].resolved == false)] | length'
```

**Typical mistake:** get the first 20 discussions, see that all are resolved, and conclude the work is done — while in reality there are 50+ unresolved threads on the next pages.

## Limitations

- **No MR filtering by reviewer** — `list_merge_requests` only supports `scope: created_by_me | assigned_to_me | all`
- For MRs where you are a reviewer, use the GitLab Web UI: `https://gitlab.chulakov.org/dashboard/merge_requests?reviewer_username=USERNAME`

## API Navigation

1. `list_categories` — view categories
2. `list_tools` — view tools in a category
3. `get_tool_schema` — get tool schema with parameters
4. `execute_tool` — execute a tool
