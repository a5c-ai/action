# MCP Server Integration

This document specifies the Model Context Protocol (MCP) server integration in the A5C system.

## Overview

The A5C system uses MCP (Model Context Protocol) servers to provide agents with structured access to external systems and services. MCP servers act as intermediaries between AI agents and various tools, APIs, and resources.

## Built-in MCP Servers

### 1. Agent Reporter MCP Server

**Purpose**: Status reporting and logging for agent execution

**Server ID**: `agent-reporter`

#### Methods

| Method | Description | Parameters |
|--------|-------------|------------|
| `report_started` | Report agent execution start | `agentId`: string, `config`: object |
| `report_progress` | Report execution progress | `agentId`: string, `progress`: number, `total`: number, `message`: string |
| `report_completed` | Report successful completion | `agentId`: string, `result`: object |
| `report_failed` | Report execution failure | `agentId`: string, `error`: object, `context`: object |
| `report_log` | Log messages | `agentId`: string, `level`: string, `message`: string |

#### Configuration

```json
{
  "agent-reporter": {
    "enabled": true,
    "log_level": "info",
    "max_log_size": "10MB",
    "retention_days": 30
  }
}
```

#### Usage Example

```javascript
const result = await mcp.call("agent-reporter", "report_started", {
  agentId: "security-scanner",
  config: {
    version: "1.0.0",
    model: "claude-3-5-sonnet-20241022"
  }
});
```

### 2. GitHub MCP Server

**Purpose**: GitHub API integration for repository operations

**Server ID**: `github`

#### Methods

| Method | Description | Parameters |
|--------|-------------|------------|
| `create_issue` | Create GitHub issue | `owner`, `repo`, `title`, `body`, `labels` |
| `create_pull_request` | Create pull request | `owner`, `repo`, `title`, `body`, `head`, `base` |
| `add_issue_comment` | Add comment to issue/PR | `owner`, `repo`, `issue_number`, `body` |
| `create_pull_request_review` | Review pull request | `owner`, `repo`, `pull_number`, `body`, `event` |
| `get_pull_request` | Get PR details | `owner`, `repo`, `pull_number` |
| `list_pull_requests` | List repository PRs | `owner`, `repo`, `state`, `sort` |
| `get_issue` | Get issue details | `owner`, `repo`, `issue_number` |
| `update_issue` | Update issue | `owner`, `repo`, `issue_number`, `title`, `body`, `state` |
| `merge_pull_request` | Merge pull request | `owner`, `repo`, `pull_number`, `merge_method` |

#### Configuration

```json
{
  "github": {
    "enabled": true,
    "auth_token": "${GITHUB_TOKEN}",
    "api_url": "https://api.github.com",
    "rate_limit": {
      "requests_per_hour": 5000,
      "burst_limit": 100
    }
  }
}
```

#### Usage Example

```javascript
const issue = await mcp.call("github", "create_issue", {
  owner: "org",
  repo: "repo",
  title: "Security vulnerability found",
  body: "Details...",
  labels: ["security", "bug"]
});
```

### 3. Filesystem MCP Server

**Purpose**: File system operations for agents

**Server ID**: `filesystem`

#### Methods

| Method | Description | Parameters |
|--------|-------------|------------|
| `read_file` | Read file contents | `path`: string, `encoding`: string |
| `write_file` | Write file contents | `path`: string, `content`: string, `encoding`: string |
| `list_directory` | List directory contents | `path`: string, `recursive`: boolean |
| `create_directory` | Create directory | `path`: string, `recursive`: boolean |
| `delete_file` | Delete file | `path`: string |
| `move_file` | Move/rename file | `from`: string, `to`: string |
| `file_exists` | Check if file exists | `path`: string |
| `get_file_stats` | Get file statistics | `path`: string |

#### Configuration

```json
{
  "filesystem": {
    "enabled": true,
    "base_path": "/workspace",
    "allowed_paths": [
      "/workspace/src",
      "/workspace/docs",
      "/workspace/tests"
    ],
    "blocked_paths": [
      "/workspace/.git",
      "/workspace/node_modules"
    ],
    "max_file_size": "10MB"
  }
}
```

## Custom MCP Servers

### Creating Custom MCP Servers

```javascript
// custom-security-scanner.js
const { MCPServer } = require('@a5c/mcp-server');

class SecurityScannerMCP extends MCPServer {
  constructor(config) {
    super('security-scanner', config);
  }

  async scan_file(params) {
    const { file_path, rules } = params;
    
    // Perform security scan
    const results = await this.scanFile(file_path, rules);
    
    return {
      file: file_path,
      issues: results.issues,
      severity: results.severity,
      recommendations: results.recommendations
    };
  }

  async get_security_rules(params) {
    const { category } = params;
    return this.getRules(category);
  }
}

module.exports = SecurityScannerMCP;
```

### Server Registration

```yaml
# .a5c/mcp-servers.yml
servers:
  security-scanner:
    class: "./custom-security-scanner.js"
    config:
      rules_path: "./security-rules.json"
      severity_threshold: "medium"
```

### Agent Configuration

```yaml
---
name: security-agent
mcp_servers:
  - filesystem
  - github
  - agent-reporter
  - security-scanner
---
```

## MCP Configuration

### Global Configuration

```yaml
# .a5c/config.yml
mcp:
  enabled: true
  server_timeout: 30000
  max_concurrent_calls: 10
  retry_attempts: 3
  retry_delay: 1000
  
  servers:
    agent-reporter:
      enabled: true
      log_level: "info"
    
    github:
      enabled: true
      auth_token: "${GITHUB_TOKEN}"
      rate_limit:
        requests_per_hour: 5000
    
    filesystem:
      enabled: true
      base_path: "/workspace"
      max_file_size: "10MB"
```

### Agent-Specific Configuration

```yaml
---
name: my-agent
mcp_servers:
  - name: github
    config:
      rate_limit:
        requests_per_hour: 1000
  - name: filesystem
    config:
      allowed_paths: ["/workspace/src"]
  - name: custom-tool
    config:
      api_key: "${CUSTOM_API_KEY}"
---
```

## MCP Server Implementation

### Server Interface

```javascript
class MCPServer {
  constructor(name, config) {
    this.name = name;
    this.config = config;
  }

  // Initialize server
  async initialize() {
    // Setup logic
  }

  // Handle method calls
  async call(method, params) {
    if (typeof this[method] === 'function') {
      return await this[method](params);
    }
    throw new Error(`Method ${method} not found`);
  }

  // Cleanup resources
  async cleanup() {
    // Cleanup logic
  }
}
```

### Method Implementation

```javascript
class DatabaseMCP extends MCPServer {
  async query(params) {
    const { sql, parameters } = params;
    
    // Input validation
    if (!sql) {
      throw new Error('SQL query is required');
    }

    // Execute query
    const result = await this.db.query(sql, parameters);
    
    return {
      rows: result.rows,
      count: result.count,
      execution_time: result.duration
    };
  }

  async insert(params) {
    const { table, data } = params;
    
    // Validate and insert
    const result = await this.db.insert(table, data);
    
    return {
      id: result.insertId,
      affected_rows: result.affectedRows
    };
  }
}
```

## Error Handling

### Standard Error Format

```json
{
  "error": {
    "code": "PERMISSION_DENIED",
    "message": "Access denied to file: /secure/config.json",
    "details": {
      "file": "/secure/config.json",
      "required_permission": "read",
      "current_permission": "none"
    }
  }
}
```

### Error Codes

| Code | Description |
|------|-------------|
| `INVALID_PARAMS` | Invalid parameters provided |
| `PERMISSION_DENIED` | Insufficient permissions |
| `RESOURCE_NOT_FOUND` | Resource not found |
| `RATE_LIMIT_EXCEEDED` | Rate limit exceeded |
| `SERVER_ERROR` | Internal server error |
| `TIMEOUT` | Operation timeout |

### Error Handling Example

```javascript
try {
  const result = await mcp.call("github", "create_issue", params);
} catch (error) {
  if (error.code === 'RATE_LIMIT_EXCEEDED') {
    // Wait and retry
    await sleep(error.retry_after * 1000);
    return await mcp.call("github", "create_issue", params);
  }
  
  // Log error and fail gracefully
  await mcp.call("agent-reporter", "report_log", {
    agentId: "my-agent",
    level: "error",
    message: `GitHub API error: ${error.message}`
  });
}
```

## Security

### Authentication

```javascript
// MCP server with authentication
class SecureMCP extends MCPServer {
  async authenticate(token) {
    // Validate token
    const user = await this.validateToken(token);
    if (!user) {
      throw new Error('Invalid authentication token');
    }
    this.currentUser = user;
    return user;
  }

  async call(method, params) {
    // Check authentication
    if (!this.currentUser) {
      throw new Error('Authentication required');
    }

    // Check permissions
    if (!this.hasPermission(this.currentUser, method)) {
      throw new Error('Insufficient permissions');
    }

    return await super.call(method, params);
  }
}
```

### Authorization

```javascript
// Permission-based access control
class PermissionMCP extends MCPServer {
  constructor(name, config) {
    super(name, config);
    this.permissions = {
      'read_file': ['read'],
      'write_file': ['write'],
      'delete_file': ['admin'],
      'create_issue': ['github_write']
    };
  }

  hasPermission(user, method) {
    const required = this.permissions[method];
    return required && required.every(perm => 
      user.permissions.includes(perm)
    );
  }
}
```

### Input Validation

```javascript
// Input validation and sanitization
class ValidatedMCP extends MCPServer {
  validateParams(method, params) {
    const schema = this.getSchema(method);
    
    // Validate required fields
    for (const field of schema.required) {
      if (!(field in params)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate types
    for (const [field, type] of Object.entries(schema.types)) {
      if (field in params && typeof params[field] !== type) {
        throw new Error(`Invalid type for ${field}: expected ${type}`);
      }
    }

    // Sanitize inputs
    return this.sanitizeParams(params);
  }
}
```

## Performance Optimization

### Connection Pooling

```javascript
// Connection pooling for database MCP
class DatabaseMCP extends MCPServer {
  constructor(name, config) {
    super(name, config);
    this.pool = new ConnectionPool(config.database);
  }

  async query(params) {
    const connection = await this.pool.acquire();
    try {
      return await connection.query(params.sql, params.parameters);
    } finally {
      this.pool.release(connection);
    }
  }
}
```

### Caching

```javascript
// Result caching
class CachedMCP extends MCPServer {
  constructor(name, config) {
    super(name, config);
    this.cache = new Map();
    this.cacheTTL = config.cache_ttl || 300000; // 5 minutes
  }

  async call(method, params) {
    const cacheKey = `${method}:${JSON.stringify(params)}`;
    
    // Check cache
    if (this.cache.has(cacheKey)) {
      const { data, timestamp } = this.cache.get(cacheKey);
      if (Date.now() - timestamp < this.cacheTTL) {
        return data;
      }
    }

    // Execute and cache
    const result = await super.call(method, params);
    this.cache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    return result;
  }
}
```

## Testing MCP Servers

### Unit Testing

```javascript
// Test MCP server methods
describe('GitHubMCP', () => {
  let mcp;

  beforeEach(() => {
    mcp = new GitHubMCP('github', {
      auth_token: 'test-token',
      api_url: 'https://api.github.com'
    });
  });

  test('create_issue', async () => {
    const result = await mcp.create_issue({
      owner: 'test-org',
      repo: 'test-repo',
      title: 'Test issue',
      body: 'Test body'
    });

    expect(result).toHaveProperty('id');
    expect(result.title).toBe('Test issue');
  });

  test('error handling', async () => {
    await expect(mcp.create_issue({})).rejects.toThrow('Missing required field: title');
  });
});
```

### Integration Testing

```javascript
// Test MCP server integration
describe('MCP Integration', () => {
  test('agent uses MCP server', async () => {
    const agent = new TestAgent();
    const result = await agent.execute();

    expect(result.mcp_calls).toContain('github:create_issue');
    expect(result.mcp_calls).toContain('agent-reporter:report_completed');
  });
});
```

## Monitoring and Observability

### Metrics Collection

```javascript
// MCP server metrics
class MetricsMCP extends MCPServer {
  constructor(name, config) {
    super(name, config);
    this.metrics = {
      calls: new Map(),
      errors: new Map(),
      latency: new Map()
    };
  }

  async call(method, params) {
    const start = Date.now();
    
    // Increment call count
    const callKey = `${this.name}:${method}`;
    this.metrics.calls.set(callKey, (this.metrics.calls.get(callKey) || 0) + 1);

    try {
      const result = await super.call(method, params);
      
      // Record latency
      const latency = Date.now() - start;
      this.metrics.latency.set(callKey, latency);
      
      return result;
    } catch (error) {
      // Record error
      this.metrics.errors.set(callKey, (this.metrics.errors.get(callKey) || 0) + 1);
      throw error;
    }
  }
}
```

### Health Checks

```javascript
// Health check endpoint
class HealthCheckMCP extends MCPServer {
  async health_check() {
    return {
      status: 'healthy',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
  }

  async ready_check() {
    // Check dependencies
    const checks = await Promise.all([
      this.checkDatabase(),
      this.checkExternalAPI(),
      this.checkFileSystem()
    ]);

    return {
      ready: checks.every(check => check.ok),
      checks: checks
    };
  }
}
```

## Migration Guide

### Legacy to MCP Migration

Old agent code:
```javascript
// Legacy direct API calls
const octokit = new Octokit({ auth: token });
const issue = await octokit.rest.issues.create({
  owner: 'org',
  repo: 'repo',
  title: 'Title'
});
```

New MCP-based code:
```javascript
// MCP server calls
const issue = await mcp.call('github', 'create_issue', {
  owner: 'org',
  repo: 'repo',
  title: 'Title'
});
```

### Configuration Migration

```yaml
# Old configuration
github:
  token: "${GITHUB_TOKEN}"
  api_url: "https://api.github.com"

# New MCP configuration
mcp:
  servers:
    github:
      enabled: true
      auth_token: "${GITHUB_TOKEN}"
      api_url: "https://api.github.com"
```