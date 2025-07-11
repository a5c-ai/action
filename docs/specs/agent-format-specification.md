# A5C Agent Format Specification

## Overview

This document defines the standard format for A5C agents - autonomous AI agents that operate within the A5C (AI Coordination and Collaboration) ecosystem. A5C agents are defined using markdown files with YAML frontmatter, providing a structured way to specify agent behavior, capabilities, and execution parameters.

## Agent File Structure

### File Naming Convention

Agent files MUST follow the naming pattern:
```
{agent-name}.agent.md
```

Examples:
- `developer-agent.agent.md`
- `security-reviewer.agent.md`
- `code-review-agent.agent.md`

### File Structure

Each agent file consists of two main sections:

1. **YAML Frontmatter**: Configuration and metadata
2. **Markdown Content**: Agent instructions and behavior definition

```markdown
---
# YAML frontmatter with agent configuration
---

# Markdown content with agent instructions
```

## YAML Frontmatter Specification

### Required Fields

#### Core Identity
- **`name`** (string, required): Unique identifier for the agent
  - Must be lowercase, alphanumeric with hyphens
  - Example: `"developer-agent"`

### Optional Fields

#### Core Identity
- **`version`** (string, optional): Semantic version of the agent
  - Must follow semantic versioning (semver)
  - Example: `"1.0.0"`

- **`category`** (string, optional): Agent category for organization
  - Common categories: `code-review`, `security`, `testing`, `documentation`, `deployment`, `development`, `general`
  - Example: `"development"`

- **`description`** (string, optional): Brief description of agent purpose
  - Should be concise and clear
  - Example: `"Comprehensive AI-powered code review with security and quality analysis"`

#### Context Configuration
- **`usage_context`** (string, optional): Multi-line description of when to use this agent
  - Describes the agent's purpose and ideal use cases
  - Should include specific scenarios and triggers

- **`invocation_context`** (string, optional): How to invoke the agent
  - Describes specific invocation methods and required context
  - Useful for complex agents with specific requirements

#### Agent Inheritance
- **`from`** (string, optional): Parent agent to inherit from
  - Enables agent inheritance and composition
  - Example: `"base-reviewer"`

#### Execution Configuration
- **`model`** (string, optional): AI model to use
  - Default: System default model
  - Example: `"claude-3-5-sonnet-20241022"`

- **`max_turns`** (integer, optional): Maximum conversation turns
  - Default: 10
  - Range: 1-50
  - Example: `20`

- **`timeout`** (integer, optional): Timeout in minutes
  - Default: 15
  - Range: 1-60
  - Example: `25`

- **`verbose`** (boolean, optional): Enable verbose logging
  - Default: false
  - Example: `true`

#### Trigger Configuration
- **`events`** (array, optional): GitHub events that trigger the agent
  - Supported events: `push`, `pull_request`, `issues`, `schedule`, `workflow_dispatch`
  - Example: `["pull_request", "push"]`

- **`mentions`** (array, optional): List of mention triggers
  - Used for @-mention based activation
  - Example: `["@code-review", "@review-code", "@ai-review"]`

- **`labels`** (array, optional): GitHub labels that trigger the agent
  - Example: `["security", "critical", "high-risk"]`

- **`branches`** (array, optional): Branch patterns that trigger the agent
  - Supports glob patterns
  - Example: `["main", "develop", "feature/*"]`

- **`paths`** (array, optional): File path patterns that trigger the agent
  - Supports glob patterns
  - Example: `["src/**/*.js", "security/**/*"]`

- **`activation_cron`** (string, optional): Cron expression for scheduled activation
  - Example: `"0 2 * * 1"` (Mondays at 2 AM)

#### System Configuration
- **`priority`** (integer, optional): Agent execution priority
  - Default: 50
  - Range: 1-100 (higher = runs first)
  - Example: `80`

- **`mcp_servers`** (array, optional): Required MCP servers
  - Example: `["filesystem", "github", "search"]`

- **`prompt_uri`** (string, optional): External prompt URI
  - URL to external prompt file
  - Example: `"https://raw.githubusercontent.com/a5c-ai/registry/main/prompts/development/code-review-agent.prompt.md"`

#### Agent Discovery
- **`agent_discovery`** (object, optional): Agent discovery configuration
  - **`enabled`** (boolean): Enable agent discovery
  - **`include_same_directory`** (boolean): Include agents from same directory
  - **`include_external_agents`** (array): External agents to include
  - **`max_agents_in_context`** (integer): Maximum agents in context

## Markdown Content Specification

### Content Structure

The markdown content after the frontmatter contains the agent's instructions and behavior definition. This section should include:

1. **Agent Role Definition**: Clear description of the agent's role and responsibilities
2. **Specific Instructions**: Detailed instructions for the agent's behavior
3. **Output Format**: Expected output format and structure
4. **Examples**: Examples of expected behavior (optional)

### Template Variables

Agents can use template variables in their content:

- **`{{base-prompt}}`**: Include content from parent agent (when using `from` field)
- **`{{agent-name}}`**: Current agent's name
- **`{{version}}`**: Current agent's version

### Example Content Structure

```markdown
---
# YAML frontmatter here
---

# Agent Role
You are a {role description} agent responsible for {responsibilities}.

## Core Responsibilities
1. **First Responsibility**: Description
2. **Second Responsibility**: Description

## Instructions
{Detailed instructions for the agent}

## Output Format
{Expected output format}

## Examples
{Optional examples of expected behavior}
```

## Agent Inheritance

### Inheritance Model

A5C agents support inheritance through the `from` field, allowing agents to:
- Inherit configuration from parent agents
- Extend or override parent behavior
- Create specialized versions of base agents

### Inheritance Rules

1. **Configuration Inheritance**: Child agents inherit all configuration from parent
2. **Configuration Override**: Child agents can override any parent configuration
3. **Content Inheritance**: Use `{{base-prompt}}` to include parent content
4. **Additive Behavior**: Child agents typically extend parent behavior

### Example Inheritance

```yaml
---
name: security-reviewer
from: base-reviewer
category: security
priority: 80
---

{{base-prompt}}

## Additional Security Analysis
{Additional security-specific instructions}
```

## Validation Rules

### Required Field Validation
- All required fields must be present
- Field values must match specified types and constraints

### Naming Validation
- Agent names must be unique within their scope
- File names must match the `name` field

### Version Validation
- Versions must follow semantic versioning
- Version increments should reflect change significance

### Content Validation
- Markdown content must be valid
- Template variables must be properly formatted

## Best Practices

### Agent Design
1. **Single Responsibility**: Each agent should have a clear, focused purpose
2. **Composability**: Design agents to work well with others
3. **Specificity**: Use specific, actionable instructions
4. **Consistency**: Follow consistent patterns and conventions

### Configuration
1. **Appropriate Timeouts**: Set reasonable timeouts for agent complexity
2. **Precise Triggers**: Use specific triggers to avoid unnecessary activations
3. **Proper Priorities**: Set priorities to ensure correct execution order
4. **Resource Management**: Specify only required MCP servers

### Documentation
1. **Clear Context**: Provide clear usage and invocation context
2. **Comprehensive Instructions**: Include all necessary behavior instructions
3. **Examples**: Provide examples for complex behaviors
4. **Version History**: Document significant changes in version updates

## Migration Guide

### From Legacy Formats
If migrating from legacy agent formats:

1. **Extract Configuration**: Move configuration to YAML frontmatter
2. **Standardize Naming**: Ensure file names follow the convention
3. **Add Required Fields**: Ensure all required fields are present
4. **Validate Format**: Use validation tools to ensure compliance

### Version Updates
When updating agent versions:

1. **Increment Version**: Update version following semantic versioning
2. **Document Changes**: Note significant changes in description or comments
3. **Test Compatibility**: Ensure backward compatibility when possible
4. **Update Dependencies**: Update any dependent agents as needed

## Examples

### Basic Agent

```yaml
---
name: simple-reviewer
version: 1.0.0
category: code-review
description: Simple code review agent
usage_context: |
  Basic code review for pull requests.
  Performs standard code quality checks.
---

You are a code review agent. Please analyze code for:
1. Code quality and best practices
2. Basic security issues
3. Functionality correctness
```

### Advanced Agent with Inheritance

```yaml
---
name: advanced-security-reviewer
version: 1.0.0
from: security-reviewer
category: security
description: Advanced security review with threat analysis
priority: 100
mentions: ["@advanced-security", "@threat-analysis"]
mcp_servers: ["filesystem", "github", "search", "memory"]
events: ["pull_request", "push", "schedule"]
labels: ["security", "critical", "high-risk"]
activation_cron: "0 2 * * 1"
max_turns: 20
timeout: 30
agent_discovery:
  enabled: true
  include_same_directory: true
  include_external_agents: ["security-scanner", "vulnerability-db"]
  max_agents_in_context: 8
---

{{base-prompt}}

## Advanced Threat Analysis
Perform additional AI-powered threat detection and analysis.
```

## Conclusion

This specification provides a comprehensive framework for creating standardized A5C agents. By following these guidelines, developers can create consistent, interoperable agents that integrate seamlessly with the A5C ecosystem.

For questions or clarifications, please refer to the A5C documentation or open an issue in the appropriate repository.