# Agent Activation Methods

This document specifies all the ways agents can be triggered and activated in the A5C system.

## Overview

The A5C agent system supports multiple activation methods that can be combined to create sophisticated triggering logic. Agents can be activated by:

1. **GitHub Events** - Repository events like pushes, pull requests, issues
2. **Mentions** - @mentions in commits, comments, or code
3. **Labels** - GitHub issue or pull request labels
4. **Branches** - Git branch patterns
5. **File Paths** - File change patterns
6. **Schedules** - Cron-based time triggers
7. **Manual Triggers** - Workflow dispatch events

## GitHub Events

### Supported Events

| Event | Description | Trigger Context |
|-------|-------------|----------------|
| `push` | Code pushed to repository | Commit messages, changed files |
| `pull_request` | Pull request events | PR description, files changed |
| `issues` | Issue events | Issue title, body, labels |
| `issue_comment` | Comments on issues | Comment body, issue context |
| `pull_request_review` | PR review events | Review comments, approval status |
| `release` | Release events | Release notes, version tags |
| `schedule` | Scheduled triggers | Cron expression |
| `workflow_dispatch` | Manual triggers | Input parameters |

### Event Subtypes

```yaml
events:
  - pull_request.opened
  - pull_request.synchronize
  - pull_request.closed
  - issues.opened
  - issues.edited
  - issues.labeled
  - push
  - release.published
```

### Configuration Example

```yaml
---
name: pr-reviewer
events: ["pull_request.opened", "pull_request.synchronize"]
---
```

## Mention-Based Activation

### Mention Patterns

Agents can be activated by mentions in:
- **Commit messages**: `@agent-name fix security issues`
- **Code comments**: `// @agent-name: optimize this function`
- **Issue comments**: `@agent-name please review this`
- **PR descriptions**: `@agent-name check for compliance`

### Mention Configuration

```yaml
mentions:
  - "@code-review"
  - "@security-scan"
  - "@review-bot"
```

### Mention Detection

The system searches for mentions in:
- Commit messages
- PR/issue titles and bodies
- Code comments (all languages)
- Diff content
- Review comments

### Code Comment Formats

```javascript
// @agent-name: description
/* @agent-name: multi-line description */
# @agent-name: python comment
<!-- @agent-name: HTML comment -->
```

## Label-Based Activation

### Label Matching

```yaml
labels:
  - "security"
  - "bug"
  - "critical"
  - "needs-review"
```

### Label Logic

- **Any Match**: Agent triggers if any specified label is present
- **Case Insensitive**: Labels are matched case-insensitively
- **Partial Match**: Supports partial label matching

### Advanced Label Logic

```yaml
labels:
  all_of: ["security", "critical"]  # All labels must be present
  any_of: ["bug", "feature"]        # Any label can be present
  none_of: ["wip", "draft"]         # None of these labels
```

## Branch-Based Activation

### Branch Patterns

```yaml
branches:
  - "main"
  - "develop"
  - "feature/*"
  - "hotfix/*"
  - "release/v*"
```

### Pattern Matching

- **Exact Match**: `main`, `develop`
- **Wildcard**: `feature/*`, `*/urgent`
- **Regex**: `/^feature\/[A-Z]+-\d+$/`

### Branch Context

The system provides:
- Source branch (for PRs)
- Target branch (for PRs)
- Current branch (for pushes)
- Previous branch (for branch changes)

## File Path-Based Activation

### Path Patterns

```yaml
paths:
  - "src/**/*.js"
  - "src/**/*.ts"
  - "*.md"
  - "docs/**/*"
  - "config/*.yml"
```

### Glob Patterns

- `**` - Match any directory depth
- `*` - Match any file/directory name
- `?` - Match single character
- `[abc]` - Match any of the characters
- `{js,ts}` - Match any of the extensions

### Path Matching Logic

```yaml
paths:
  include:
    - "src/**/*.js"
    - "src/**/*.ts"
  exclude:
    - "src/**/*.test.js"
    - "src/**/*.spec.ts"
```

## Schedule-Based Activation

### Cron Expressions

```yaml
schedule: "0 9 * * 1-5"  # Weekdays at 9 AM
```

### Cron Format

```
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6) (Sunday to Saturday)
│ │ │ │ │
│ │ │ │ │
* * * * *
```

### Schedule Examples

```yaml
# Daily at 2 AM
schedule: "0 2 * * *"

# Weekdays at 9 AM
schedule: "0 9 * * 1-5"

# Every 6 hours
schedule: "0 */6 * * *"

# First day of month
schedule: "0 0 1 * *"
```

## Combined Activation

### Multiple Triggers

```yaml
---
name: comprehensive-agent
events: ["pull_request", "push"]
mentions: ["@comprehensive"]
labels: ["security", "critical"]
branches: ["main", "develop"]
paths: ["src/**/*.js"]
schedule: "0 9 * * 1-5"
---
```

### Trigger Logic

- **OR Logic**: Agent triggers if ANY condition is met
- **Priority**: Event-based triggers have higher priority than scheduled
- **Batching**: Multiple simultaneous triggers are batched

## Activation Context

### Event Context

```json
{
  "event": "pull_request",
  "action": "opened",
  "repository": "org/repo",
  "branch": "feature/new-feature",
  "actor": "username",
  "timestamp": "2025-07-11T08:00:00Z"
}
```

### Trigger Context

```json
{
  "trigger_type": "mention",
  "trigger_source": "commit_message",
  "trigger_content": "@agent-name fix security issues",
  "trigger_location": "commit:abc123",
  "trigger_user": "username"
}
```

### File Context

```json
{
  "changed_files": [
    {
      "path": "src/security.js",
      "status": "modified",
      "additions": 10,
      "deletions": 5
    }
  ],
  "total_changes": 15
}
```

## Priority and Ordering

### Priority System

```yaml
priority: 80  # 0-100, higher = more important
```

### Execution Order

1. **Priority**: Higher priority agents run first
2. **Mention Order**: Mentioned agents run in mention order
3. **Dependency**: Agents with dependencies run after prerequisites
4. **Category**: Security agents run before general agents

### Parallel Execution

```yaml
execution:
  mode: "parallel"  # or "sequential"
  max_concurrent: 3
  timeout: 30
```

## Conditional Activation

### Advanced Conditions

```yaml
conditions:
  - type: file_count
    operator: ">"
    value: 10
  - type: change_size
    operator: "<"
    value: 1000
  - type: user_permission
    value: "write"
  - type: branch_protection
    value: true
```

### Conditional Logic

```yaml
activation:
  mode: "conditional"
  conditions:
    all_of:
      - type: event
        value: "pull_request"
      - type: label
        value: "security"
    any_of:
      - type: file_pattern
        value: "*.js"
      - type: file_pattern
        value: "*.ts"
```

## Activation Debugging

### Debug Mode

```yaml
debug:
  enabled: true
  log_level: "debug"
  trace_triggers: true
```

### Activation Logs

```json
{
  "agent": "security-scanner",
  "activation": {
    "triggered": true,
    "reasons": ["event:pull_request", "label:security"],
    "context": {
      "event": "pull_request.opened",
      "files": ["src/auth.js", "src/crypto.js"]
    }
  }
}
```

## Testing Activation

### Test Configuration

```yaml
test:
  mock_events:
    - event: "pull_request"
      action: "opened"
      files: ["src/test.js"]
  expected_triggers: ["code-reviewer", "security-scanner"]
```

### Activation Testing

```bash
# Test agent activation
a5c test-activation --agent security-scanner --event pull_request

# Test specific trigger
a5c test-trigger --mention "@security-scan" --file src/auth.js
```

## Error Handling

### Activation Failures

- **Invalid Triggers**: Skip invalid trigger configurations
- **Permission Errors**: Log and continue with other agents
- **Timeout Errors**: Cancel activation after timeout
- **Rate Limiting**: Respect GitHub API limits

### Fallback Strategies

```yaml
fallback:
  on_error: "continue"  # or "stop", "retry"
  retry_count: 3
  retry_delay: 5
```

## Performance Considerations

### Optimization Strategies

- **Trigger Caching**: Cache expensive trigger evaluations
- **Batch Processing**: Group similar activations
- **Selective Loading**: Load only needed agents
- **Async Processing**: Process activations asynchronously

### Resource Limits

```yaml
limits:
  max_concurrent_agents: 5
  max_execution_time: 30
  max_memory_usage: "1GB"
  max_api_calls: 100
```

## Migration Guide

### Legacy Activation Methods

Old format:
```yaml
trigger_events: ["pull_request"]
trigger_labels: ["security"]
activation_cron: "0 9 * * 1-5"
```

New format:
```yaml
events: ["pull_request"]
labels: ["security"]
schedule: "0 9 * * 1-5"
```

### Backward Compatibility

The system maintains backward compatibility for:
- Legacy trigger field names
- Old cron expression formats
- Deprecated event types
- Legacy mention patterns