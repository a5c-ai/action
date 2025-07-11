# Agent Communication Protocols Specification

**Version**: 1.0.0  
**Status**: Stable  
**Last Updated**: 2025-07-11

## Overview

This specification defines the communication protocols used by A5C agents for status reporting, inter-agent coordination, and external system integration. The communication system is built on Model Context Protocol (MCP) servers and provides standardized interfaces for all agent interactions.

## Communication Architecture

### MCP Server Foundation

A5C agents communicate through MCP (Model Context Protocol) servers, which provide:

- **Standardized interfaces**: Consistent API across all communication channels
- **Built-in servers**: Core functionality available to all agents
- **Extensibility**: Custom MCP servers for specialized needs
- **Security**: Controlled access and permission management

### Communication Channels

1. **Agent Reporter**: Status updates and logging
2. **GitHub Integration**: Repository operations and interactions
3. **Inter-Agent**: Direct agent-to-agent communication
4. **External Systems**: Third-party service integration

## Agent Reporter MCP Server

The `agent-reporter` MCP server is the primary communication channel for agent status and logging.

### Status Reporting Methods

#### Report Started
```json
{
  "method": "report_started",
  "params": {
    "agentId": "security-reviewer",
    "config": {
      "task": "security-analysis",
      "priority": 80,
      "timeout": 1800
    }
  }
}
```

#### Report Progress
```json
{
  "method": "report_progress",
  "params": {
    "agentId": "security-reviewer",
    "progress": 3,
    "total": 10,
    "message": "Analyzing authentication modules",
    "details": {
      "current_file": "src/auth.js",
      "files_processed": 3,
      "issues_found": 2
    }
  }
}
```

#### Report Completed
```json
{
  "method": "report_completed",
  "params": {
    "agentId": "security-reviewer",
    "result": {
      "status": "success",
      "issues_found": 5,
      "files_processed": 15,
      "critical_issues": 1,
      "recommendations": 8
    },
    "summary": "Security review completed with 5 issues found",
    "execution_time": 420
  }
}
```

#### Report Failed
```json
{
  "method": "report_failed",
  "params": {
    "agentId": "security-reviewer",
    "error": {
      "code": "ANALYSIS_FAILED",
      "message": "Unable to parse configuration file",
      "details": "Invalid YAML syntax in security-config.yml:line 23"
    },
    "context": {
      "file": "security-config.yml",
      "line": 23,
      "operation": "config_parsing"
    }
  }
}
```

### Logging Methods

#### Log Information
```json
{
  "method": "report_log",
  "params": {
    "agentId": "security-reviewer",
    "level": "info",
    "message": "Starting security analysis of 15 files",
    "timestamp": "2025-07-11T08:43:06Z",
    "context": {
      "total_files": 15,
      "file_types": ["js", "ts", "py"]
    }
  }
}
```

#### Log Warning
```json
{
  "method": "report_log",
  "params": {
    "agentId": "security-reviewer",
    "level": "warn",
    "message": "Deprecated authentication method detected",
    "timestamp": "2025-07-11T08:43:06Z",
    "context": {
      "file": "src/auth.js",
      "line": 45,
      "method": "basicAuth"
    }
  }
}
```

#### Log Error
```json
{
  "method": "report_log",
  "params": {
    "agentId": "security-reviewer",
    "level": "error",
    "message": "Critical vulnerability detected",
    "timestamp": "2025-07-11T08:43:06Z",
    "context": {
      "file": "src/auth.js",
      "line": 67,
      "vulnerability": "SQL_INJECTION",
      "severity": "critical"
    }
  }
}
```

#### Log Debug
```json
{
  "method": "report_log",
  "params": {
    "agentId": "security-reviewer",
    "level": "debug",
    "message": "Analyzing function: authenticateUser",
    "timestamp": "2025-07-11T08:43:06Z",
    "context": {
      "function": "authenticateUser",
      "parameters": ["credentials"],
      "return_type": "Promise<User>"
    }
  }
}
```

## GitHub MCP Server

The `github` MCP server provides GitHub API integration for repository operations.

### Repository Operations

#### Create Pull Request
```json
{
  "method": "mcp__github__create_pull_request",
  "params": {
    "owner": "a5c-ai",
    "repo": "action",
    "title": "Security fixes identified by security-reviewer",
    "head": "security-fixes",
    "base": "main",
    "body": "## Security Analysis Results\n\nFixed 5 security issues identified in the latest scan..."
  }
}
```

#### Create Issue
```json
{
  "method": "mcp__github__create_issue",
  "params": {
    "owner": "a5c-ai",
    "repo": "action",
    "title": "Critical security vulnerability in authentication module",
    "body": "**Severity**: Critical\n**File**: src/auth.js:67\n**Issue**: SQL injection vulnerability",
    "labels": ["security", "critical", "vulnerability"]
  }
}
```

#### Add Comment
```json
{
  "method": "mcp__github__add_issue_comment",
  "params": {
    "owner": "a5c-ai",
    "repo": "action",
    "issue_number": 123,
    "body": "Security analysis completed. Found 5 issues requiring attention."
  }
}
```

### File Operations

#### Create or Update File
```json
{
  "method": "mcp__github__create_or_update_file",
  "params": {
    "owner": "a5c-ai",
    "repo": "action",
    "path": "security-report.md",
    "content": "# Security Analysis Report\n\n...",
    "message": "Add security analysis report",
    "branch": "security-analysis"
  }
}
```

#### Get File Contents
```json
{
  "method": "mcp__github__get_file_contents",
  "params": {
    "owner": "a5c-ai",
    "repo": "action",
    "path": "src/auth.js",
    "branch": "main"
  }
}
```

## Inter-Agent Communication

### Mention-Based Communication

Agents communicate with each other through mentions in commit messages and comments.

#### Commit Message Mentions
```bash
git commit -m "Fix authentication bug @security-reviewer @code-reviewer"
```

#### Code Comment Mentions
```javascript
// @performance-reviewer: This function needs optimization after security fixes
function processData(data) {
  // Implementation
}
```

### Agent Coordination

#### Sequential Execution
```yaml
# Agent A completes, then triggers Agent B
name: agent-a
post_execution:
  mentions:
    - "@agent-b"
    - "@agent-c"
```

#### Parallel Execution
```yaml
# Multiple agents work simultaneously
name: coordinator-agent
triggers:
  - "@security-reviewer"
  - "@performance-reviewer"
  - "@code-reviewer"
coordination: "parallel"
```

#### Conditional Execution
```yaml
# Agent B only runs if Agent A finds issues
name: agent-a
post_execution:
  conditions:
    - if: "issues_found > 0"
      then: "@remediation-agent"
    - if: "critical_issues > 0"
      then: "@security-escalation-agent"
```

## External System Integration

### Custom MCP Servers

Agents can integrate with external systems through custom MCP servers.

#### Security Scanner Integration
```yaml
mcp_servers:
  - "security-scanner"
  - "vulnerability-database"
  - "compliance-checker"
```

#### CI/CD Integration
```yaml
mcp_servers:
  - "jenkins-integration"
  - "docker-registry"
  - "deployment-manager"
```

### Third-Party APIs

#### Slack Integration
```json
{
  "method": "mcp__slack__post_message",
  "params": {
    "channel": "#security-alerts",
    "message": "Critical security issue detected in repository",
    "attachments": [
      {
        "title": "Security Analysis Report",
        "text": "5 issues found, 1 critical"
      }
    ]
  }
}
```

#### Email Notifications
```json
{
  "method": "mcp__email__send_notification",
  "params": {
    "to": ["security-team@company.com"],
    "subject": "Security Alert: Critical Vulnerability Detected",
    "body": "A critical security vulnerability has been detected...",
    "priority": "high"
  }
}
```

## Communication Patterns

### Request-Response Pattern

```javascript
// Agent A requests analysis from Agent B
const response = await mcp.call('mcp__agent__request_analysis', {
  agentId: 'security-reviewer',
  files: ['src/auth.js', 'src/user.js'],
  analysisType: 'security'
});
```

### Event-Driven Pattern

```javascript
// Agent subscribes to events from other agents
mcp.subscribe('agent.security-reviewer.completed', (event) => {
  if (event.result.critical_issues > 0) {
    // Trigger escalation
    mcp.call('mcp__agent__trigger', {
      agentId: 'security-escalation-agent',
      context: event.result
    });
  }
});
```

### Pub-Sub Pattern

```javascript
// Agent publishes status updates
mcp.publish('agent.code-reviewer.status', {
  status: 'analyzing',
  progress: 0.6,
  current_file: 'src/main.js'
});

// Other agents subscribe to updates
mcp.subscribe('agent.*.status', (event) => {
  console.log(`Agent ${event.agentId}: ${event.status}`);
});
```

## Error Handling

### Communication Errors

```json
{
  "method": "report_failed",
  "params": {
    "agentId": "security-reviewer",
    "error": {
      "code": "COMMUNICATION_ERROR",
      "message": "Failed to connect to GitHub API",
      "details": "Rate limit exceeded: 403 Forbidden"
    },
    "retry_strategy": {
      "max_retries": 3,
      "backoff": "exponential",
      "delay": 5000
    }
  }
}
```

### Retry Mechanisms

```yaml
communication:
  retry_policy:
    max_retries: 3
    backoff_strategy: "exponential"
    initial_delay: 1000
    max_delay: 30000
  timeout: 30000
  circuit_breaker:
    failure_threshold: 5
    recovery_timeout: 60000
```

## Security Considerations

### Authentication

```yaml
mcp_servers:
  - name: "github"
    auth:
      type: "token"
      token: "${GITHUB_TOKEN}"
  - name: "security-scanner"
    auth:
      type: "api_key"
      key: "${SECURITY_SCANNER_API_KEY}"
```

### Authorization

```yaml
permissions:
  github:
    - "read:repository"
    - "write:pull_requests"
    - "write:issues"
  security-scanner:
    - "scan:files"
    - "read:vulnerabilities"
```

### Data Protection

```yaml
communication:
  encryption: true
  sensitive_data_handling:
    - "mask_credentials"
    - "encrypt_payloads"
    - "audit_access"
```

## Performance Optimization

### Batching Operations

```javascript
// Batch multiple GitHub operations
const batch = [
  { method: 'create_issue', params: { ... } },
  { method: 'add_comment', params: { ... } },
  { method: 'add_label', params: { ... } }
];

await mcp.batchCall('mcp__github__batch', { operations: batch });
```

### Connection Pooling

```yaml
mcp_servers:
  - name: "github"
    connection_pool:
      max_connections: 10
      idle_timeout: 30000
      connection_timeout: 5000
```

### Caching

```yaml
communication:
  cache:
    enabled: true
    ttl: 300000  # 5 minutes
    storage: "memory"
```

## Best Practices

### Status Reporting

1. **Report early and often**: Use `report_started` at the beginning
2. **Provide meaningful progress**: Update progress with descriptive messages
3. **Include context**: Add relevant details to help with debugging
4. **Handle failures gracefully**: Always report failures with context

### Inter-Agent Communication

1. **Use specific mentions**: Target the right agent for the task
2. **Provide context**: Include relevant information in mentions
3. **Avoid circular dependencies**: Design communication flows carefully
4. **Monitor communication patterns**: Track agent interactions

### External Integration

1. **Handle rate limits**: Implement proper retry mechanisms
2. **Secure credentials**: Use environment variables for sensitive data
3. **Validate responses**: Check external API responses
4. **Monitor performance**: Track external call latency

## Related Specifications

- [MCP Server Integration](mcp-server-integration.md)
- [GitHub Integration](github-integration.md)
- [Agent Configuration Format](agent-config-format.md)
- [System Architecture](system-architecture.md)

---

*This specification is part of the A5C Agent System Documentation*