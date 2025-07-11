# Agent Configuration Format Specification

**Version**: 1.0.0  
**Status**: Stable  
**Last Updated**: 2025-07-11

## Overview

This specification defines the complete format for A5C agent configuration files. Agent configurations use YAML front matter followed by the agent's prompt content, providing both metadata and executable instructions in a single file.

## File Format

### Basic Structure

```yaml
---
# Agent Metadata (YAML Front Matter)
name: agent-name
version: 1.0.0
category: agent-category
description: Agent description
# ... additional metadata
---

# Agent Prompt (Markdown Content)
Your agent prompt content goes here...
```

### File Extensions

- **Standard**: `.agent.md` (recommended)
- **Alternative**: `.agent.yaml`, `.agent.yml`

## Metadata Schema

### Required Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `name` | string | Unique agent identifier | `"code-reviewer"` |
| `version` | string | Semantic version | `"1.2.3"` |
| `category` | string | Agent category | `"development"` |
| `description` | string | Brief agent description | `"Performs code review analysis"` |

### Optional Fields

| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `model` | string | LLM model to use | `"claude-3-5-sonnet-20241022"` |
| `max_turns` | integer | Maximum conversation turns | `10` |
| `timeout` | integer | Timeout in minutes | `30` |
| `priority` | integer | Agent priority (1-100) | `50` |
| `verbose` | boolean | Enable verbose logging | `true` |
| `mentions` | string\|array | Mention patterns | `"@agent-name"` |
| `usage_context` | string | Usage description | `""` |
| `invocation_context` | string | Invocation requirements | `""` |
| `inheritance` | object | Inheritance configuration | `{}` |

### Trigger Configuration

#### Event Triggers

```yaml
trigger_events:
  - "push"
  - "pull_request"
  - "issues"
  - "schedule"
```

#### Label Triggers

```yaml
trigger_labels:
  - "bug"
  - "enhancement"
  - "security"
```

#### Branch Triggers

```yaml
trigger_branches:
  - "main"
  - "develop"
  - "feature/*"
  - "hotfix/*"
```

#### File Path Triggers

```yaml
trigger_file_patterns:
  - "src/**/*.js"
  - "docs/**/*.md"
  - "security/**/*"
```

#### Schedule Triggers

```yaml
trigger_schedule:
  - "0 9 * * 1-5"  # Weekdays at 9 AM
  - "0 0 * * 0"    # Sunday at midnight
```

### MCP Server Configuration

```yaml
mcp_servers:
  - "filesystem"
  - "github"
  - "custom-server"
```

### Tool Configuration

```yaml
tools:
  allowed:
    - "Bash"
    - "Read"
    - "Write"
    - "Grep"
  blocked:
    - "WebSearch"
```

## Inheritance System

### Basic Inheritance

```yaml
inheritance:
  extends: "base-agent"
  
# OR with remote inheritance
inheritance:
  extends: "https://github.com/org/repo/path/to/base-agent.md"
```

### Multi-Level Inheritance

```yaml
inheritance:
  extends: "intermediate-agent"
  
# intermediate-agent.md
inheritance:
  extends: "base-agent"
```

### Template Substitution

```yaml
inheritance:
  extends: "base-template"
  substitutions:
    AGENT_NAME: "my-custom-agent"
    MODEL_TYPE: "claude-3-5-sonnet"
    CUSTOM_PARAM: "value"
```

## Complete Example

```yaml
---
name: security-reviewer
version: 2.1.0
category: security
description: Advanced security code review agent with vulnerability detection
model: claude-3-5-sonnet-20241022
max_turns: 15
timeout: 20
priority: 80
verbose: true
mentions: 
  - "@security-reviewer"
  - "@sec-review"
usage_context: |
  This agent performs comprehensive security analysis of code changes,
  including vulnerability detection, secure coding practices, and
  compliance checking.
invocation_context: |
  Requires repository access and security scanning permissions.
  Best used on pull requests and security-related changes.

# Trigger Configuration
trigger_events:
  - "pull_request"
  - "push"
trigger_labels:
  - "security"
  - "vulnerability"
  - "compliance"
trigger_branches:
  - "main"
  - "develop"
  - "security/*"
trigger_file_patterns:
  - "src/**/*.js"
  - "src/**/*.ts"
  - "src/**/*.py"
  - "security/**/*"
  - "auth/**/*"

# MCP Server Configuration
mcp_servers:
  - "filesystem"
  - "github"
  - "security-scanner"

# Tool Configuration
tools:
  allowed:
    - "Bash"
    - "Read"
    - "Write"
    - "Grep"
    - "WebFetch"
  blocked:
    - "WebSearch"

# Inheritance
inheritance:
  extends: "base-security-agent"
  substitutions:
    SCAN_DEPTH: "comprehensive"
    COMPLIANCE_LEVEL: "strict"
---

# Security Code Review Agent

You are a specialized security code review agent with advanced vulnerability detection capabilities.

## Core Responsibilities

1. **Vulnerability Detection**: Identify security vulnerabilities in code
2. **Secure Coding Practices**: Verify adherence to security best practices
3. **Compliance Checking**: Ensure code meets security compliance requirements
4. **Risk Assessment**: Evaluate and categorize security risks

## Analysis Framework

### Security Categories
- **Authentication & Authorization**
- **Input Validation & Sanitization**
- **Cryptography & Data Protection**
- **Dependency Security**
- **Infrastructure Security**

### Severity Levels
- **Critical**: Immediate security risk
- **High**: Significant security concern
- **Medium**: Moderate security issue
- **Low**: Minor security improvement
- **Info**: Security recommendation

## Reporting Format

Provide findings in structured format:

```markdown
## Security Analysis Report

### Summary
- Total Issues: X
- Critical: X | High: X | Medium: X | Low: X

### Detailed Findings

#### [SEVERITY] Issue Title
**File**: `path/to/file.js:line`
**Category**: Authentication
**Description**: Detailed description of the issue
**Recommendation**: Specific remediation steps
**References**: [CWE-XXX](https://cwe.mitre.org/data/definitions/XXX.html)
```

Use the agent-reporter MCP server for status updates and GitHub MCP server for PR interactions.
```

## Validation Rules

### Naming Conventions
- Agent names: `kebab-case` (e.g., `security-reviewer`)
- No spaces or special characters except hyphens
- Maximum 50 characters

### Version Format
- Must follow semantic versioning (e.g., `1.2.3`)
- Pre-release versions allowed (e.g., `1.2.3-alpha.1`)

### Required Content
- Agent files must contain both metadata and prompt content
- Prompt content must be non-empty
- Description must be between 10-200 characters

## Error Handling

### Common Validation Errors

| Error | Description | Solution |
|-------|-------------|----------|
| `INVALID_YAML` | Malformed YAML front matter | Fix YAML syntax |
| `MISSING_REQUIRED_FIELD` | Required field missing | Add required metadata |
| `INVALID_VERSION` | Invalid semantic version | Use valid semver format |
| `EMPTY_PROMPT` | No prompt content | Add agent instructions |
| `INVALID_TRIGGER` | Invalid trigger configuration | Check trigger syntax |

### Inheritance Errors

| Error | Description | Solution |
|-------|-------------|----------|
| `PARENT_NOT_FOUND` | Parent agent not found | Verify parent path/URL |
| `CIRCULAR_INHERITANCE` | Circular dependency detected | Remove circular reference |
| `SUBSTITUTION_FAILED` | Template substitution failed | Check substitution syntax |

## Migration Guide

### From Version 0.x to 1.0

1. **Rename fields**:
   - `triggers` → `trigger_events`
   - `allowed_tools` → `tools.allowed`

2. **Update inheritance**:
   ```yaml
   # Old format
   extends: "base-agent"
   
   # New format
   inheritance:
     extends: "base-agent"
   ```

3. **Update mentions**:
   ```yaml
   # Old format
   mentions: "@agent-name"
   
   # New format (still supported)
   mentions: "@agent-name"
   
   # Or array format
   mentions:
     - "@agent-name"
     - "@alt-mention"
   ```

## Best Practices

### Organization
- Group related agents in directories
- Use consistent naming conventions
- Document agent purpose clearly

### Performance
- Set appropriate timeouts for agent complexity
- Use specific file patterns to avoid unnecessary triggers
- Consider agent priority for execution order

### Maintenance
- Version agents with semantic versioning
- Document changes in agent descriptions
- Test inheritance chains thoroughly

## Schema Reference

The complete JSON schema for agent configuration is available at:
- [agent-config-schema.json](schemas/agent-config-schema.json)

## Related Specifications

- [Agent Activation Methods](agent-activation-methods.md)
- [Agent Inheritance System](agent-inheritance.md)
- [MCP Server Integration](mcp-server-integration.md)

---

*This specification is part of the A5C Agent System Documentation*