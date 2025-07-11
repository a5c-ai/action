# Agent Communication Protocols

This document specifies the communication protocols used by agents in the A5C system.

## Overview

The A5C system provides multiple communication channels for agents to:
- Report status and progress
- Communicate with other agents
- Interact with GitHub
- Log information and errors
- Coordinate workflows

## Communication Channels

### 1. Agent Reporter MCP Server

The primary communication channel for status reporting and logging.

#### Methods

| Method | Purpose | Parameters |
|--------|---------|------------|
| `report_started` | Signal agent start | `agentId`, `config` |
| `report_progress` | Report progress | `agentId`, `progress`, `total`, `message` |
| `report_completed` | Signal completion | `agentId`, `result` |
| `report_failed` | Signal failure | `agentId`, `error`, `context` |
| `report_log` | Log messages | `agentId`, `level`, `message` |

#### Status Reporting

```javascript
// Report agent started
await mcp.call("report_started", {
  agentId: "security-scanner",
  config: {
    task: "security-scan",
    version: "1.0.0"
  }
});

// Report progress
await mcp.call("report_progress", {
  agentId: "security-scanner",
  progress: 3,
  total: 10,
  message: "Scanning authentication module"
});

// Report completion
await mcp.call("report_completed", {
  agentId: "security-scanner",
  result: {
    issues_found: 2,
    files_scanned: 15,
    severity: "medium"
  }
});
```

#### Logging

```javascript
// Log levels: debug, info, warn, error
await mcp.call("report_log", {
  agentId: "security-scanner",
  level: "info",
  message: "Found potential SQL injection vulnerability"
});

await mcp.call("report_log", {
  agentId: "security-scanner",
  level: "error",
  message: "Failed to access secure configuration"
});
```

### 2. GitHub MCP Server

Direct GitHub API integration for repository operations.

#### Methods

| Method | Purpose | Parameters |
|--------|---------|------------|
| `create_issue` | Create GitHub issue | `owner`, `repo`, `title`, `body`, `labels` |
| `create_pull_request` | Create pull request | `owner`, `repo`, `title`, `body`, `head`, `base` |
| `add_issue_comment` | Comment on issue | `owner`, `repo`, `issue_number`, `body` |
| `create_pull_request_review` | Review pull request | `owner`, `repo`, `pull_number`, `body`, `event` |
| `update_issue` | Update issue | `owner`, `repo`, `issue_number`, `title`, `body`, `state` |

#### GitHub Operations

```javascript
// Create an issue
await github.call("create_issue", {
  owner: "org",
  repo: "repo",
  title: "Security vulnerability found",
  body: "Details of the security issue...",
  labels: ["security", "bug"]
});

// Comment on pull request
await github.call("add_issue_comment", {
  owner: "org",
  repo: "repo",
  issue_number: 123,
  body: "Security scan completed. 2 issues found."
});
```

### 3. Inter-Agent Communication

#### Commit Message Mentions

Agents can trigger other agents through commit messages:

```bash
git commit -m "Fix security issue @security-reviewer"
```

#### Code Comment Mentions

```javascript
// @code-reviewer: optimize this function
function expensiveOperation() {
  // Complex logic here
}
```

#### Agent Discovery Context

Agents receive information about other available agents:

```json
{
  "available_agents": [
    {
      "name": "security-scanner",
      "category": "security",
      "description": "Scans for security vulnerabilities",
      "mentions": ["@security", "@sec-scan"]
    },
    {
      "name": "code-reviewer",
      "category": "code-review",
      "description": "Reviews code quality",
      "mentions": ["@code-review"]
    }
  ]
}
```

## Communication Patterns

### 1. Status Reporting Pattern

```javascript
// Standard status reporting flow
async function executeAgent(agentId, config) {
  // 1. Report started
  await reportStarted(agentId, config);
  
  try {
    // 2. Report progress during execution
    await reportProgress(agentId, 0, 5, "Initializing");
    
    // 3. Do work and report progress
    await doWork();
    await reportProgress(agentId, 3, 5, "Processing files");
    
    // 4. Complete work
    const result = await finishWork();
    await reportProgress(agentId, 5, 5, "Completed");
    
    // 5. Report completion
    await reportCompleted(agentId, result);
    
  } catch (error) {
    // Report failure
    await reportFailed(agentId, error, { context: "execution" });
  }
}
```

### 2. Collaborative Pattern

```javascript
// Agent A triggers Agent B
async function agentA() {
  const result = await analyzeCode();
  
  if (result.needsSecurityReview) {
    // Trigger security agent via commit
    await git.commit("Code analysis complete @security-reviewer");
  }
  
  await reportCompleted("agent-a", result);
}
```

### 3. Pipeline Pattern

```javascript
// Sequential agent execution
async function pipelineExecution() {
  // Step 1: Code analysis
  await executeAgent("code-analyzer");
  
  // Step 2: Security scan (triggered by analyzer)
  // Agent will be triggered via mention
  
  // Step 3: Final review (triggered by security scan)
  // Chain continues based on results
}
```

## Message Formats

### Status Message Format

```json
{
  "timestamp": "2025-07-11T08:00:00Z",
  "agent_id": "security-scanner",
  "type": "status",
  "status": "in_progress",
  "progress": {
    "current": 3,
    "total": 10,
    "percentage": 30
  },
  "message": "Scanning authentication module",
  "context": {
    "file": "src/auth.js",
    "line": 42
  }
}
```

### Log Message Format

```json
{
  "timestamp": "2025-07-11T08:00:00Z",
  "agent_id": "security-scanner",
  "type": "log",
  "level": "warn",
  "message": "Potential SQL injection found",
  "context": {
    "file": "src/database.js",
    "line": 127,
    "severity": "medium"
  }
}
```

### Result Message Format

```json
{
  "timestamp": "2025-07-11T08:00:00Z",
  "agent_id": "security-scanner",
  "type": "result",
  "status": "completed",
  "result": {
    "issues_found": 2,
    "files_scanned": 15,
    "execution_time": "45s",
    "recommendations": [
      "Fix SQL injection in database.js:127",
      "Update authentication method in auth.js:42"
    ]
  },
  "artifacts": [
    {
      "type": "report",
      "path": "/tmp/security-report.json",
      "description": "Detailed security analysis report"
    }
  ]
}
```

## Real-time Communication

### File Descriptors

Agents use named pipes for real-time communication:

```javascript
// Environment variables set by system
const statusFD = process.env.AGENT_STATUS_FD;
const logFD = process.env.AGENT_LOG_FD;

// Write status updates
fs.writeSync(statusFD, JSON.stringify({
  status: "in_progress",
  message: "Processing file 3 of 10"
}));

// Write log messages
fs.writeSync(logFD, JSON.stringify({
  level: "info",
  message: "Found security issue in auth.js"
}));
```

### WebSocket Communication

For real-time dashboard updates:

```javascript
// WebSocket connection for live updates
const ws = new WebSocket('ws://dashboard.a5c.ai/agents');

ws.send(JSON.stringify({
  type: 'agent_status',
  agent_id: 'security-scanner',
  status: 'in_progress',
  progress: 0.6
}));
```

## Error Handling

### Error Reporting

```javascript
// Report errors with context
await reportFailed(agentId, {
  error: "FileNotFoundError",
  message: "Configuration file not found",
  stack: error.stack,
  context: {
    file: "config.yml",
    attempted_paths: ["/etc/config.yml", "./config.yml"]
  }
});
```

### Retry Logic

```javascript
// Automatic retry for transient errors
async function withRetry(operation, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      await reportLog(agentId, "warn", 
        `Operation failed, retrying (${i + 1}/${maxRetries})`);
      await delay(1000 * Math.pow(2, i)); // Exponential backoff
    }
  }
}
```

## Security Considerations

### Authentication

```javascript
// Agents authenticate using GitHub tokens
const github = new GitHub({
  auth: process.env.GITHUB_TOKEN,
  userAgent: `A5C-Agent/${agentId}`
});
```

### Authorization

```javascript
// Check permissions before operations
const permissions = await github.repos.getCollaboratorPermissionLevel({
  owner: 'org',
  repo: 'repo',
  username: context.actor
});

if (permissions.data.permission !== 'admin') {
  await reportFailed(agentId, {
    error: "InsufficientPermissions",
    message: "Agent requires admin permissions"
  });
  return;
}
```

### Rate Limiting

```javascript
// Respect GitHub API rate limits
const rateLimiter = new RateLimiter({
  tokensPerInterval: 5000,
  interval: 'hour'
});

await rateLimiter.removeTokens(1);
const result = await github.issues.create(params);
```

## Communication Best Practices

### 1. Structured Logging

```javascript
// Use structured logging for better parsing
await reportLog(agentId, "info", "Security scan started", {
  files: fileList.length,
  scan_type: "full",
  rules: ruleSet.name
});
```

### 2. Progressive Status Updates

```javascript
// Provide meaningful progress updates
const files = await getFilesToProcess();
for (let i = 0; i < files.length; i++) {
  await reportProgress(agentId, i, files.length, 
    `Processing ${files[i].name}`);
  await processFile(files[i]);
}
```

### 3. Rich Result Context

```javascript
// Include actionable information in results
await reportCompleted(agentId, {
  summary: "Security scan completed",
  issues: {
    critical: 1,
    high: 3,
    medium: 5,
    low: 12
  },
  files_processed: 42,
  recommendations: [
    {
      type: "fix",
      priority: "critical",
      file: "src/auth.js",
      line: 127,
      message: "Fix SQL injection vulnerability",
      suggested_fix: "Use parameterized queries"
    }
  ],
  next_actions: [
    "Review critical issues immediately",
    "Schedule security training for team",
    "Update security guidelines"
  ]
});
```

## Testing Communication

### Mock MCP Servers

```javascript
// Mock agent-reporter for testing
const mockReporter = {
  report_started: jest.fn(),
  report_progress: jest.fn(),
  report_completed: jest.fn(),
  report_failed: jest.fn(),
  report_log: jest.fn()
};
```

### Communication Testing

```javascript
// Test agent communication flow
test('agent communication flow', async () => {
  const agent = new SecurityScanner();
  
  await agent.execute();
  
  expect(mockReporter.report_started).toHaveBeenCalledWith({
    agentId: "security-scanner",
    config: expect.any(Object)
  });
  
  expect(mockReporter.report_progress).toHaveBeenCalled();
  expect(mockReporter.report_completed).toHaveBeenCalled();
});
```

## Monitoring and Observability

### Metrics Collection

```javascript
// Collect agent metrics
const metrics = {
  execution_time: Date.now() - startTime,
  files_processed: fileCount,
  issues_found: issueCount,
  api_calls: apiCallCount,
  memory_usage: process.memoryUsage()
};

await reportCompleted(agentId, { metrics });
```

### Distributed Tracing

```javascript
// Add tracing context
const trace = require('./tracing');

await trace.withSpan(`agent-${agentId}`, async (span) => {
  span.setAttributes({
    'agent.id': agentId,
    'agent.version': config.version,
    'agent.category': config.category
  });
  
  await executeAgent();
});
```

## Migration Guide

### Legacy Communication

Old pattern:
```javascript
// Legacy file-based communication
fs.writeFileSync('/tmp/agent-status.json', JSON.stringify(status));
```

New pattern:
```javascript
// Modern MCP-based communication
await mcp.call("report_progress", status);
```

### Backward Compatibility

The system maintains compatibility for:
- Legacy status file formats
- Old logging patterns
- Deprecated API endpoints
- Legacy GitHub webhook formats