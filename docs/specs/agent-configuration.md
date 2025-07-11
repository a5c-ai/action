# Agent Configuration Format

This document specifies the complete format for A5C agent configuration files.

## File Structure

Agent files use the `.agent.md` extension and consist of:

1. **YAML Frontmatter** - Configuration metadata
2. **Markdown Body** - Agent prompt content

```markdown
---
# YAML configuration here
---
# Markdown prompt content here
```

## Configuration Schema

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Unique identifier for the agent |

### Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `version` | string | `"1.0.0"` | Agent version |
| `category` | string | `"general"` | Agent category for organization |
| `description` | string | `""` | Human-readable description |
| `from` | string | `null` | Base agent for inheritance |
| `model` | string | `"claude-3-5-sonnet-20241022"` | AI model to use |
| `max_turns` | number | `10` | Maximum conversation turns |
| `timeout` | number | `30` | Execution timeout in minutes |
| `verbose` | boolean | `false` | Enable verbose logging |
| `priority` | number | `50` | Execution priority (0-100) |

### Trigger Configuration

#### Basic Triggers

| Field | Type | Description |
|-------|------|-------------|
| `mentions` | array[string] | Mention patterns (e.g., `["@agent-name", "@alias"]`) |
| `events` | array[string] | GitHub events (e.g., `["pull_request", "push"]`) |
| `labels` | array[string] | GitHub labels (e.g., `["security", "bug"]`) |
| `branches` | array[string] | Branch patterns (e.g., `["main", "feature/*"]`) |
| `paths` | array[string] | File path patterns (e.g., `["src/**/*.js"]`) |
| `schedule` | string | Cron expression (e.g., `"0 9 * * 1-5"`) |

#### Advanced Triggers

```yaml
triggers:
  events:
    - pull_request.opened
    - pull_request.synchronize
    - issues.opened
  conditions:
    - type: file_changed
      patterns: ["src/**/*.js", "*.md"]
    - type: label_present
      labels: ["security", "urgent"]
    - type: branch_matches
      patterns: ["main", "develop", "hotfix/*"]
```

### MCP Server Configuration

| Field | Type | Description |
|-------|------|-------------|
| `mcp_servers` | array[string] | MCP servers to enable |
| `mcp_config` | object | Custom MCP configuration |

**Built-in MCP Servers:**
- `filesystem` - File system operations
- `github` - GitHub API operations
- `agent-reporter` - Status reporting and logging

### Agent Discovery

```yaml
agent_discovery:
  enabled: true
  max_agents_in_context: 10
  include_same_directory: true
  include_external_agents: ["other-agent-id"]
```

### Environment Configuration

```yaml
environment:
  variables:
    CUSTOM_VAR: "value"
  secrets:
    - SECRET_NAME
```

## Configuration Examples

### Basic Agent

```yaml
---
name: code-reviewer
version: 1.0.0
category: code-review
description: Reviews code changes for quality and standards
mentions: ["@code-review", "@review"]
events: ["pull_request"]
mcp_servers: ["filesystem", "github"]
---
You are a code reviewer. Review the provided code changes...
```

### Advanced Agent

```yaml
---
name: security-scanner
version: 2.1.0
category: security
description: Scans for security vulnerabilities
mentions: ["@security", "@sec-scan"]
events: ["pull_request", "push"]
labels: ["security", "critical"]
branches: ["main", "develop", "release/*"]
paths: ["src/**/*.js", "src/**/*.ts", "*.py"]
schedule: "0 2 * * 1-5"
model: "claude-3-5-sonnet-20241022"
max_turns: 15
timeout: 45
priority: 80
mcp_servers: ["filesystem", "github", "security-tools"]
agent_discovery:
  enabled: true
  max_agents_in_context: 5
  include_external_agents: ["compliance-checker"]
environment:
  variables:
    SCAN_LEVEL: "high"
  secrets:
    - SECURITY_API_KEY
---
You are a security scanner. Analyze code for vulnerabilities...
```

## Inheritance System

### Basic Inheritance

```yaml
---
name: specialized-reviewer
from: base-reviewer
description: Specialized version of base reviewer
mentions: ["@spec-review"]
---
{{base-prompt}}

Additional specialized instructions...
```

### Multi-level Inheritance

```yaml
# base-reviewer.agent.md
---
name: base-reviewer
category: code-review
---
You are a code reviewer...

# security-reviewer.agent.md
---
name: security-reviewer
from: base-reviewer
category: security
---
{{base-prompt}}

Focus on security aspects...

# advanced-security-reviewer.agent.md
---
name: advanced-security-reviewer
from: security-reviewer
max_turns: 20
timeout: 60
---
{{base-prompt}}

Perform advanced security analysis...
```

## Configuration Validation

### Required Validations

- `name` must be unique within the system
- `name` must match pattern: `^[a-zA-Z0-9][a-zA-Z0-9-_]*$`
- `mentions` must include at least one mention if specified
- `schedule` must be valid cron expression
- `priority` must be between 0-100

### Warning Validations

- `description` should be provided for documentation
- `version` should follow semantic versioning
- `category` should be one of standard categories
- `timeout` should be reasonable (5-120 minutes)

## File Locations

### Standard Locations

- **Local agents**: `.a5c/agents/*.agent.md`
- **Repository agents**: `agents/*.agent.md`
- **Shared agents**: `.a5c/shared-agents/*.agent.md`

### Remote Agents

```yaml
# Reference remote agents
remote_agents:
  sources:
    repositories:
      - "github.com/org/agent-repo"
      - "github.com/org/another-repo/agents"
```

## Template Variables

### Available in Prompt Content

| Variable | Description |
|----------|-------------|
| `{{base-prompt}}` | Content from inherited agent |
| `{{agent.name}}` | Current agent name |
| `{{config.model}}` | Configured model |
| `{{github.event}}` | GitHub event type |
| `{{github.repository}}` | Repository full name |
| `{{github.ref}}` | Git reference |
| `{{github.actor}}` | GitHub actor |

### Available in Configuration

| Variable | Description |
|----------|-------------|
| `{{env.VARIABLE_NAME}}` | Environment variable |
| `{{config.global.setting}}` | Global configuration setting |

## Best Practices

### Naming Conventions

- Use descriptive, hyphenated names: `security-reviewer`
- Include category in name: `security-code-scanner`
- Avoid special characters except hyphens and underscores
- Keep names under 50 characters

### Configuration Organization

- Group related agents in subdirectories
- Use inheritance for common functionality
- Keep configuration minimal and focused
- Document complex configurations

### Performance Considerations

- Set appropriate timeouts for agent complexity
- Use priority to control execution order
- Limit agent discovery scope
- Cache expensive operations

## Migration Guide

### From v1.0 to v2.0

- `trigger_events` → `events`
- `trigger_labels` → `labels`
- `trigger_branches` → `branches`
- `trigger_paths` → `paths`
- `activation_cron` → `schedule`

### Backward Compatibility

The system maintains backward compatibility for:
- Legacy field names (with warnings)
- Old configuration formats
- Existing agent files

## Error Handling

### Configuration Errors

- **Syntax errors**: YAML parsing failures
- **Validation errors**: Invalid field values
- **Reference errors**: Missing inherited agents
- **Circular dependencies**: Inheritance loops

### Runtime Errors

- **Timeout errors**: Agent execution timeouts
- **Model errors**: AI model failures
- **MCP errors**: Server communication failures
- **GitHub errors**: API rate limits or permissions