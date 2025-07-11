# MCP Server Integration Specification

**Version**: 1.0.0  
**Status**: Stable  
**Last Updated**: 2025-07-11

## Overview

This specification defines how A5C agents integrate with Model Context Protocol (MCP) servers. MCP servers provide standardized interfaces for agents to interact with external systems, report status, and coordinate activities.

## MCP Architecture

### What is MCP?

Model Context Protocol (MCP) is a standardized protocol for Large Language Models (LLMs) to interact with external systems and services. In the A5C system, MCP servers provide:

- **Standardized APIs**: Consistent interfaces across all integrations
- **Type Safety**: Structured data exchange with validation
- **Security**: Controlled access and permission management
- **Extensibility**: Custom servers for specialized functionality

### MCP Server Types

1. **Built-in Servers**: Core functionality provided by A5C
2. **Custom Servers**: User-defined servers for specific needs
3. **Third-party Servers**: Community-contributed servers

## Built-in MCP Servers

### Agent Reporter Server

The `agent-reporter` MCP server handles agent status reporting and logging.

#### Available Methods

| Method | Description | Parameters |
|--------|-------------|------------|
| `report_started` | Report agent start | `agentId`, `config` |
| `report_progress` | Update progress | `agentId`, `progress`, `total`, `message` |
| `report_completed` | Report completion | `agentId`, `result`, `summary` |
| `report_failed` | Report failure | `agentId`, `error`, `context` |
| `report_log` | Log messages | `agentId`, `level`, `message`, `context` |

#### Usage Example

```yaml
# In agent configuration
mcp_servers:
  - "agent-reporter"
```

```javascript
// In agent prompt
// Use the agent-reporter MCP server to report status
await mcp.call('report_started', {
  agentId: 'security-reviewer',
  config: { task: 'security-analysis' }
});
```

### GitHub Server

The `github` MCP server provides GitHub API integration.

#### Available Methods

| Method | Description | Parameters |
|--------|-------------|------------|
| `create_pull_request` | Create PR | `owner`, `repo`, `title`, `head`, `base`, `body` |
| `create_issue` | Create issue | `owner`, `repo`, `title`, `body`, `labels` |
| `add_issue_comment` | Add comment | `owner`, `repo`, `issue_number`, `body` |
| `get_file_contents` | Get file | `owner`, `repo`, `path`, `branch` |
| `create_or_update_file` | Update file | `owner`, `repo`, `path`, `content`, `message` |
| `search_repositories` | Search repos | `query`, `page`, `per_page` |
| `list_issues` | List issues | `owner`, `repo`, `state`, `labels` |
| `merge_pull_request` | Merge PR | `owner`, `repo`, `pull_number`, `merge_method` |

#### Usage Example

```yaml
# In agent configuration
mcp_servers:
  - "github"
```

```javascript
// In agent prompt
// Use the github MCP server to create a pull request
await mcp.call('mcp__github__create_pull_request', {
  owner: 'a5c-ai',
  repo: 'action',
  title: 'Security fixes',
  head: 'security-fixes',
  base: 'main',
  body: 'Automated security fixes'
});
```

## Custom MCP Servers

### Creating Custom Servers

Custom MCP servers extend A5C functionality for specific use cases.

#### Server Configuration

```json
{
  "mcpServers": {
    "security-scanner": {
      "command": "node",
      "args": ["./mcp-servers/security-scanner.js"]
    },
    "slack-integration": {
      "command": "python",
      "args": ["./mcp-servers/slack_server.py"]
    }
  }
}
```

#### Server Implementation

```javascript
// security-scanner.js
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

const server = new Server({
  name: 'security-scanner',
  version: '1.0.0'
});

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'scan_vulnerabilities',
      description: 'Scan code for security vulnerabilities',
      inputSchema: {
        type: 'object',
        properties: {
          files: { type: 'array', items: { type: 'string' } },
          severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] }
        },
        required: ['files']
      }
    }
  ]
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  if (name === 'scan_vulnerabilities') {
    const results = await scanFiles(args.files, args.severity);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(results, null, 2)
        }
      ]
    };
  }
  
  throw new Error(`Unknown tool: ${name}`);
});
```

### Server Registration

#### Local Registration

```yaml
# In .a5c/mcps.json
{
  "mcpServers": {
    "security-scanner": {
      "command": "node",
      "args": ["./mcp-servers/security-scanner.js"],
      "env": {
        "SECURITY_DB_URL": "https://api.security-db.com"
      }
    }
  }
}
```

#### Global Registration

```yaml
# In default-config.yml
mcp_servers:
  built_in:
    - "agent-reporter"
    - "github"
  custom:
    - "security-scanner"
    - "slack-integration"
```

## Server Integration Patterns

### Tool-Based Integration

```javascript
// Agent calls MCP server tools
const vulnerabilities = await mcp.call('security-scanner', 'scan_vulnerabilities', {
  files: ['src/auth.js', 'src/user.js'],
  severity: 'medium'
});
```

### Resource-Based Integration

```javascript
// Agent accesses MCP server resources
const config = await mcp.readResource('security-scanner', 'config://scan-rules');
const database = await mcp.readResource('security-scanner', 'db://vulnerabilities');
```

### Prompt-Based Integration

```javascript
// Agent uses MCP server prompts
const analysisPrompt = await mcp.getPrompt('security-scanner', 'vulnerability-analysis', {
  language: 'javascript',
  severity: 'high'
});
```

## Configuration Management

### Server Configuration

```yaml
mcp_servers:
  - name: "security-scanner"
    config:
      api_key: "${SECURITY_SCANNER_API_KEY}"
      endpoint: "https://api.security-scanner.com"
      timeout: 30000
      retries: 3
  - name: "github"
    config:
      token: "${GITHUB_TOKEN}"
      base_url: "https://api.github.com"
```

### Environment Variables

```yaml
# In agent configuration
environment:
  SECURITY_SCANNER_API_KEY: "${SECURITY_SCANNER_API_KEY}"
  GITHUB_TOKEN: "${GITHUB_TOKEN}"
  SLACK_WEBHOOK_URL: "${SLACK_WEBHOOK_URL}"
```

### Secure Configuration

```yaml
mcp_servers:
  - name: "security-scanner"
    secrets:
      - name: "api_key"
        source: "env"
        key: "SECURITY_SCANNER_API_KEY"
      - name: "private_key"
        source: "file"
        path: "/etc/secrets/scanner-key.pem"
```

## Error Handling

### Server Availability

```javascript
try {
  const result = await mcp.call('security-scanner', 'scan_vulnerabilities', params);
} catch (error) {
  if (error.code === 'SERVER_UNAVAILABLE') {
    // Fallback to alternative scanning method
    const fallbackResult = await alternativeScanning(params);
    return fallbackResult;
  }
  throw error;
}
```

### Retry Mechanisms

```yaml
mcp_servers:
  - name: "security-scanner"
    retry_policy:
      max_retries: 3
      backoff_strategy: "exponential"
      initial_delay: 1000
      max_delay: 30000
    timeout: 60000
```

### Circuit Breaker

```yaml
mcp_servers:
  - name: "external-api"
    circuit_breaker:
      failure_threshold: 5
      recovery_timeout: 60000
      half_open_max_calls: 3
```

## Performance Optimization

### Connection Pooling

```yaml
mcp_servers:
  - name: "database-connector"
    connection_pool:
      max_connections: 10
      min_connections: 2
      idle_timeout: 30000
      connection_timeout: 5000
```

### Caching

```yaml
mcp_servers:
  - name: "external-api"
    cache:
      enabled: true
      ttl: 300000  # 5 minutes
      max_size: 100
      storage: "memory"
```

### Batching

```javascript
// Batch multiple operations
const batch = [
  { tool: 'scan_file', args: { file: 'src/auth.js' } },
  { tool: 'scan_file', args: { file: 'src/user.js' } },
  { tool: 'scan_file', args: { file: 'src/admin.js' } }
];

const results = await mcp.batchCall('security-scanner', batch);
```

## Security Considerations

### Authentication

```yaml
mcp_servers:
  - name: "secure-service"
    auth:
      type: "oauth2"
      client_id: "${OAUTH_CLIENT_ID}"
      client_secret: "${OAUTH_CLIENT_SECRET}"
      scope: "read:data write:results"
```

### Authorization

```yaml
mcp_servers:
  - name: "github"
    permissions:
      - "read:repository"
      - "write:pull_requests"
      - "write:issues"
    restrictions:
      - "no_admin_access"
      - "no_delete_operations"
```

### Data Protection

```yaml
mcp_servers:
  - name: "sensitive-data-processor"
    security:
      encryption: true
      data_classification: "confidential"
      audit_logging: true
      pii_handling: "strict"
```

## Common MCP Server Examples

### Slack Integration

```javascript
// slack-server.js
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  if (name === 'post_message') {
    const response = await fetch(`${SLACK_WEBHOOK_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel: args.channel,
        text: args.message,
        username: 'A5C Agent'
      })
    });
    
    return {
      content: [
        {
          type: 'text',
          text: `Message posted to ${args.channel}`
        }
      ]
    };
  }
});
```

### Database Integration

```javascript
// database-server.js
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  if (name === 'query_vulnerabilities') {
    const results = await db.query(
      'SELECT * FROM vulnerabilities WHERE severity >= ? AND language = ?',
      [args.severity, args.language]
    );
    
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(results, null, 2)
        }
      ]
    };
  }
});
```

### CI/CD Integration

```javascript
// jenkins-server.js
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  if (name === 'trigger_build') {
    const response = await jenkins.build(args.job, args.parameters);
    
    return {
      content: [
        {
          type: 'text',
          text: `Build triggered: ${response.id}`
        }
      ]
    };
  }
});
```

## Best Practices

### Server Design

1. **Single Responsibility**: Each server should have a focused purpose
2. **Idempotent Operations**: Operations should be safe to retry
3. **Error Handling**: Provide meaningful error messages
4. **Documentation**: Include comprehensive tool descriptions

### Integration Patterns

1. **Graceful Degradation**: Handle server unavailability
2. **Timeout Management**: Set appropriate timeouts
3. **Resource Cleanup**: Clean up connections and resources
4. **Monitoring**: Track server performance and errors

### Security

1. **Least Privilege**: Grant minimum necessary permissions
2. **Input Validation**: Validate all inputs from agents
3. **Output Sanitization**: Clean outputs sent to agents
4. **Audit Logging**: Log all security-relevant operations

## Troubleshooting

### Common Issues

| Issue | Symptoms | Solutions |
|-------|----------|-----------|
| Server not found | `SERVER_NOT_FOUND` error | Check server configuration and registration |
| Authentication failed | `AUTH_ERROR` | Verify credentials and permissions |
| Connection timeout | `TIMEOUT_ERROR` | Increase timeout or check network |
| Tool not available | `TOOL_NOT_FOUND` | Check tool name and server implementation |

### Debugging Tools

1. **Server Logs**: Check MCP server logs for errors
2. **Network Monitoring**: Monitor connections and latency
3. **Performance Metrics**: Track call duration and success rates
4. **Error Tracking**: Monitor error patterns and frequencies

## Related Specifications

- [Agent Communication Protocols](agent-communication.md)
- [GitHub Integration](github-integration.md)
- [System Architecture](system-architecture.md)
- [Security Model](security-model.md)

---

*This specification is part of the A5C Agent System Documentation*