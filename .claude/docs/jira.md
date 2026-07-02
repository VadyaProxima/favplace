# Working with Jira

## Architecture

```
Claude Code  <--SSE-->  mcp-atlassian (localhost:3846)  <--REST API-->  Jira Server
```

The `mcp-atlassian` MCP server starts separately and listens on port 3846. Claude Code connects to it via SSE.

## Jira Server

- **URL:** https://jira.chulakov.org
- **Type:** Jira Server/Data Center

## Setup

### 1. Install uv

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### 2. Start the MCP Server

```bash
JIRA_URL="https://jira.chulakov.org" \
JIRA_USERNAME="your.email@chulakov.com" \
JIRA_API_TOKEN="your_token" \
uvx mcp-atlassian --transport sse --port 3846
```

Or create a script `~/.local/bin/start-jira-mcp.sh` for convenience.

Get the API token in your Jira profile: **Profile → Personal Access Tokens → Create token**.

### 3. Add Configuration to the Project

Create `.claude/.mcp.json`:

```json
{
  "mcpServers": {
    "jira": {
      "type": "sse",
      "url": "http://127.0.0.1:3846/sse"
    }
  }
}
```

### 4. Verify the Connection

In Claude Code run `/login`, then check access:

```
mcp__jira__jira_get_all_projects
```

## Available Tools

| Tool | Description |
|------------|----------|
| `jira_search` | Search by JQL |
| `jira_get_issue` | Get a task |
| `jira_create_issue` | Create a task |
| `jira_update_issue` | Update a task |
| `jira_add_worklog` | Log time |
| `jira_add_comment` | Add a comment |
| `jira_transition_issue` | Change status |
| `jira_get_transitions` | Get available transitions |
| `jira_get_worklog` | Get worklogs |

## Usage Examples

```bash
# Get a task
mcp__jira__jira_get_issue issue_key="PROJ-123"

# Search for in-progress tasks
mcp__jira__jira_search jql="project = PROJ AND status = 'In Progress'"

# Worklogs for today
mcp__jira__jira_search jql="worklogDate = today() AND worklogAuthor = currentUser()"

# Log time
mcp__jira__jira_add_worklog issue_key="PROJ-123" time_spent="2h" comment="Work description"
```

## Time Logging Rules

1. **Maximum 8 hours per day** — before logging, check how much has already been logged today
2. Before adding a worklog, run:
   ```
   mcp__jira__jira_search jql="worklogDate = today() AND worklogAuthor = currentUser()"
   ```
3. If the sum of current worklogs + new worklog > 8h — warn the user and do not log
