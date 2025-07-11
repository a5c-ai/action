# Agent Activation Methods Specification

**Version**: 1.0.0  
**Status**: Stable  
**Last Updated**: 2025-07-11

## Overview

This specification defines all methods by which A5C agents can be activated and triggered. The A5C system supports multiple activation patterns to provide flexible and responsive automation.

## Activation Types

### 1. Event-Based Activation

Agents are triggered by GitHub events and repository activities.

#### GitHub Events

```yaml
trigger_events:
  - "push"                 # Code pushed to repository
  - "pull_request"         # PR opened, updated, or closed
  - "issues"               # Issue created, updated, or closed
  - "issue_comment"        # Comment on issue or PR
  - "schedule"             # Scheduled execution
  - "workflow_dispatch"    # Manual trigger
  - "release"              # Release created or published
  - "deployment"           # Deployment event
  - "repository_dispatch"  # External webhook trigger
```

#### Event Filtering

```yaml
trigger_events:
  - event: "pull_request"
    actions:
      - "opened"
      - "synchronize"
      - "reopened"
  - event: "issues"
    actions:
      - "opened"
      - "labeled"
```

### 2. Mention-Based Activation

Agents are triggered by mentions in various contexts.

#### Code Comment Mentions

```javascript
// @security-reviewer: Check this authentication logic
function authenticateUser(credentials) {
  // Implementation here
}
```

```python
# @code-reviewer: Optimize this function
def process_data(data):
    # Implementation here
```

```java
/* @performance-reviewer: This loop needs optimization */
for (int i = 0; i < items.size(); i++) {
    // Implementation here
}
```

#### Commit Message Mentions

```bash
git commit -m "Add user authentication @security-reviewer"
git commit -m "Refactor database queries @performance-reviewer @code-reviewer"
```

#### PR/Issue Comment Mentions

```markdown
@documentation-agent please update the README for this new feature
@security-reviewer can you check this for vulnerabilities?
```

#### Mention Configuration

```yaml
mentions:
  - "@agent-name"
  - "@short-name"
  - "@alt-mention"

# OR with patterns
mentions:
  - pattern: "@{agent-name}"
  - pattern: "@{category}-review"
  - pattern: "review-{agent-name}"
```

### 3. Label-Based Activation

Agents are triggered when specific labels are applied to issues or PRs.

#### Basic Label Triggers

```yaml
trigger_labels:
  - "bug"
  - "enhancement"
  - "security"
  - "performance"
  - "documentation"
```

#### Label Combinations

```yaml
trigger_labels:
  - label: "bug"
    requires_all: ["priority-high", "component-auth"]
  - label: "security"
    requires_any: ["vulnerability", "audit"]
  - label: "enhancement"
    excludes: ["wont-fix", "duplicate"]
```

### 4. Branch-Based Activation

Agents are triggered by changes to specific branches or branch patterns.

#### Branch Patterns

```yaml
trigger_branches:
  - "main"                 # Exact branch name
  - "develop"              # Exact branch name
  - "feature/*"            # Wildcard pattern
  - "hotfix/*"             # Wildcard pattern
  - "release/v*"           # Wildcard pattern
  - "!experimental/*"      # Exclusion pattern
```

#### Branch Rules

```yaml
trigger_branches:
  - branch: "main"
    events: ["push", "pull_request"]
  - branch: "feature/*"
    events: ["pull_request"]
    target_branch: "develop"
```

### 5. File Path-Based Activation

Agents are triggered by changes to specific files or directories.

#### File Patterns

```yaml
trigger_file_patterns:
  - "src/**/*.js"          # JavaScript files in src/
  - "docs/**/*.md"         # Markdown files in docs/
  - "security/**/*"        # Any files in security/
  - "*.yml"                # YAML files in root
  - "package.json"         # Specific file
  - "!node_modules/**"     # Exclusion pattern
```

#### Advanced File Triggers

```yaml
trigger_file_patterns:
  - pattern: "src/**/*.{js,ts}"
    events: ["push", "pull_request"]
    min_changes: 5
  - pattern: "docs/**/*.md"
    events: ["push"]
    authors: ["docs-team"]
```

### 6. Schedule-Based Activation

Agents are triggered at specific times using cron expressions.

#### Cron Expressions

```yaml
trigger_schedule:
  - "0 9 * * 1-5"          # Weekdays at 9 AM
  - "0 0 * * 0"            # Sunday at midnight
  - "*/15 * * * *"         # Every 15 minutes
  - "0 2 1 * *"            # First day of month at 2 AM
```

#### Schedule Configuration

```yaml
trigger_schedule:
  - cron: "0 9 * * 1-5"
    timezone: "UTC"
    description: "Daily security scan"
  - cron: "0 0 * * 0"
    timezone: "America/New_York"
    description: "Weekly report generation"
```

## Activation Context

### Context Information

When an agent is activated, it receives context about the trigger:

```json
{
  "trigger_type": "mention",
  "trigger_source": "code_comment",
  "trigger_location": "src/auth.js:45",
  "trigger_content": "@security-reviewer: Check this authentication logic",
  "repository": "owner/repo",
  "branch": "feature/auth-improvements",
  "commit": "abc123def456",
  "author": "developer",
  "event": "push",
  "timestamp": "2025-07-11T08:43:06Z"
}
```

### Activation Priority

When multiple agents are triggered simultaneously:

1. **Priority Field**: Agents with higher priority values execute first
2. **Dependency Order**: Agents wait for dependencies to complete
3. **Resource Limits**: System limits concurrent agent execution

```yaml
priority: 80  # Higher values = higher priority (1-100)
```

## Multi-Trigger Agents

Agents can respond to multiple trigger types:

```yaml
name: comprehensive-reviewer
trigger_events:
  - "pull_request"
  - "push"
trigger_labels:
  - "needs-review"
  - "security"
trigger_branches:
  - "main"
  - "develop"
trigger_file_patterns:
  - "src/**/*.js"
  - "src/**/*.ts"
mentions:
  - "@comprehensive-reviewer"
  - "@full-review"
```

## Conditional Activation

### Conditional Logic

```yaml
activation_conditions:
  - if: "event == 'pull_request' && author != 'bot'"
    then: "activate"
  - if: "branch startsWith 'feature/' && files.changed > 10"
    then: "activate"
  - if: "labels contains 'wip'"
    then: "skip"
```

### Time-Based Conditions

```yaml
activation_conditions:
  - if: "hour >= 9 && hour <= 17"  # Business hours only
    then: "activate"
  - if: "day_of_week in ['saturday', 'sunday']"
    then: "skip"
```

## Activation Examples

### Security Review Agent

```yaml
name: security-reviewer
trigger_events:
  - "pull_request"
trigger_labels:
  - "security"
  - "vulnerability"
trigger_file_patterns:
  - "src/**/*.js"
  - "src/**/*.ts"
  - "auth/**/*"
  - "security/**/*"
mentions:
  - "@security-reviewer"
  - "@sec-review"
```

### Documentation Agent

```yaml
name: docs-updater
trigger_events:
  - "push"
trigger_branches:
  - "main"
trigger_file_patterns:
  - "src/**/*.js"
  - "src/**/*.ts"
  - "!docs/**/*"  # Exclude docs changes
mentions:
  - "@docs-updater"
trigger_schedule:
  - "0 2 * * 1"  # Weekly documentation review
```

### Performance Monitor

```yaml
name: performance-monitor
trigger_events:
  - "pull_request"
trigger_labels:
  - "performance"
trigger_file_patterns:
  - "src/**/*.js"
  - "src/**/*.ts"
  - "benchmarks/**/*"
mentions:
  - "@performance-monitor"
  - "@perf-check"
activation_conditions:
  - if: "files.changed > 5"
    then: "activate"
```

## Best Practices

### Trigger Efficiency

1. **Use specific patterns**: Avoid overly broad triggers
2. **Combine conditions**: Use multiple trigger types for precision
3. **Set appropriate priorities**: Ensure important agents run first
4. **Consider resource usage**: Limit concurrent activations

### Trigger Maintenance

1. **Regular review**: Periodically review trigger patterns
2. **Monitor activation frequency**: Adjust triggers if too frequent
3. **Test trigger combinations**: Verify multi-trigger scenarios
4. **Document trigger rationale**: Explain why specific triggers are used

### Performance Optimization

1. **File pattern efficiency**: Use specific patterns over wildcards
2. **Event filtering**: Filter events at the source when possible
3. **Conditional activation**: Use conditions to reduce unnecessary runs
4. **Schedule distribution**: Spread scheduled runs across time

## Troubleshooting

### Common Issues

| Issue | Symptoms | Solutions |
|-------|----------|-----------|
| Agent not triggering | No activation on expected events | Check trigger patterns, verify permissions |
| Too many activations | Agent runs too frequently | Refine triggers, add conditions |
| Wrong activation context | Agent receives incorrect context | Verify trigger configuration |
| Delayed activation | Agent starts later than expected | Check priority settings, resource limits |

### Debugging Tools

1. **Activation logs**: Review agent activation history
2. **Trigger testing**: Test trigger patterns manually
3. **Context inspection**: Examine activation context data
4. **Performance monitoring**: Track activation frequency and duration

## Migration Guide

### From Legacy Trigger Format

```yaml
# Old format (deprecated)
triggers:
  - "pull_request"
  - "@agent-name"

# New format
trigger_events:
  - "pull_request"
mentions:
  - "@agent-name"
```

### Adding New Trigger Types

When adding new trigger types to existing agents:

1. **Test thoroughly**: Verify new triggers work as expected
2. **Monitor impact**: Watch for unexpected activations
3. **Document changes**: Update agent documentation
4. **Version agents**: Increment version numbers

## Related Specifications

- [Agent Configuration Format](agent-config-format.md)
- [Agent Communication Protocols](agent-communication.md)
- [Event-Based Triggers](event-based-triggers.md)
- [Mention-Based Triggers](mention-based-triggers.md)

---

*This specification is part of the A5C Agent System Documentation*