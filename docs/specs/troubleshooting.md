# Troubleshooting Guide

This document provides solutions for common issues encountered when using the A5C agent system.

## Common Issues and Solutions

### 1. Agent Not Triggering

#### Problem: Agent is not being triggered by expected events

**Symptoms:**
- Agent doesn't run when expected
- No status updates or logs
- GitHub events don't trigger agent

**Diagnostic Steps:**
1. Check agent configuration syntax
2. Verify trigger patterns
3. Check event type matching
4. Validate file path patterns

**Solutions:**

##### Check Configuration Syntax
```yaml
# Ensure YAML is valid
---
name: my-agent
events: ["pull_request"]  # Array format
paths: ["src/**/*.js"]    # Glob patterns
mentions: ["@my-agent"]   # Include @ symbol
---
```

##### Verify Event Types
```yaml
# Use specific event subtypes
events:
  - pull_request.opened
  - pull_request.synchronize
  - push

# Not just:
events: ["pull_request"]
```

##### Check File Path Patterns
```yaml
# Correct glob patterns
paths:
  - "src/**/*.js"      # All JS files in src
  - "**/*.md"          # All markdown files
  - "config/*.yml"     # YAML files in config dir

# Common mistakes:
paths:
  - "src/*.js"         # Only files directly in src
  - "*.md"             # Only markdown files in root
```

##### Validate Mentions
```yaml
# Include @ in mentions
mentions: ["@agent-name", "@alias"]

# Common mistake:
mentions: ["agent-name"]  # Missing @
```

### 2. Configuration Errors

#### Problem: Agent configuration is invalid or not loading

**Symptoms:**
- Configuration validation errors
- Agent fails to start
- Missing required fields

**Diagnostic Steps:**
1. Validate YAML syntax
2. Check required fields
3. Verify inheritance chains
4. Test configuration loading

**Solutions:**

##### YAML Syntax Issues
```yaml
# Good - Proper YAML
---
name: agent-name
description: "Agent description"
events: ["pull_request"]
mcp_servers:
  - filesystem
  - github
---

# Bad - YAML syntax errors
---
name: agent-name
description: Agent description with "quotes" problem
events: [pull_request]  # Missing quotes
mcp_servers:
- filesystem
- github  # Inconsistent indentation
---
```

##### Required Fields
```yaml
# Always include required fields
---
name: agent-name          # Required
version: 1.0.0           # Recommended
description: "..."        # Recommended
mentions: ["@agent"]      # If using mentions
---
```

##### Inheritance Issues
```yaml
# Check inheritance chain
---
name: child-agent
from: parent-agent  # Ensure parent exists
---
{{base-prompt}}    # Use in content section
```

### 3. Permission and Authentication Issues

#### Problem: Agent cannot perform GitHub operations

**Symptoms:**
- "Permission denied" errors
- GitHub API failures
- Cannot create issues or comments

**Diagnostic Steps:**
1. Check GitHub token permissions
2. Verify repository access
3. Check organization settings
4. Validate action permissions

**Solutions:**

##### GitHub Token Permissions
```yaml
# Required GitHub token permissions
permissions:
  contents: read
  issues: write
  pull-requests: write
  actions: read
```

##### Repository Access
```bash
# Check if token has repository access
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/repos/owner/repo
```

##### Organization Settings
- Check if organization allows GitHub Actions
- Verify third-party access settings
- Ensure repository is not restricted

### 4. Agent Execution Failures

#### Problem: Agent starts but fails during execution

**Symptoms:**
- Agent reports failure
- Timeout errors
- Runtime exceptions

**Diagnostic Steps:**
1. Check agent logs
2. Review execution timeout
3. Verify MCP server connectivity
4. Check resource limits

**Solutions:**

##### Timeout Issues
```yaml
# Increase timeout for complex agents
timeout: 60  # 60 minutes

# Or optimize agent logic
max_turns: 10  # Limit conversation turns
```

##### MCP Server Issues
```yaml
# Verify MCP server configuration
mcp_servers:
  - filesystem
  - github
  - agent-reporter  # Always include for status reporting
```

##### Resource Limits
```yaml
# Monitor resource usage
environment:
  variables:
    NODE_OPTIONS: "--max-old-space-size=4096"
```

### 5. Agent Communication Issues

#### Problem: Agents cannot communicate with GitHub or report status

**Symptoms:**
- No status updates
- Cannot create issues/comments
- MCP server errors

**Diagnostic Steps:**
1. Check MCP server configuration
2. Verify GitHub API connectivity
3. Test status reporting
4. Check network connectivity

**Solutions:**

##### MCP Server Configuration
```json
{
  "mcp": {
    "servers": {
      "github": {
        "enabled": true,
        "auth_token": "${GITHUB_TOKEN}"
      },
      "agent-reporter": {
        "enabled": true,
        "log_level": "info"
      }
    }
  }
}
```

##### GitHub API Testing
```bash
# Test GitHub API connectivity
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/user
```

##### Status Reporting Test
```javascript
// Test status reporting in agent
await mcp.call("agent-reporter", "report_log", {
  agentId: "test-agent",
  level: "info",
  message: "Test log message"
});
```

### 6. Performance Issues

#### Problem: Agents are slow or timing out

**Symptoms:**
- Long execution times
- Timeout errors
- High resource usage

**Diagnostic Steps:**
1. Profile agent execution
2. Check file processing efficiency
3. Review API call patterns
4. Monitor resource usage

**Solutions:**

##### Optimize File Processing
```yaml
# Limit file processing
paths:
  - "src/**/*.js"     # Be specific
  - "!src/**/*.test.js"  # Exclude test files
  - "!node_modules/**"   # Exclude dependencies
```

##### Batch API Calls
```markdown
## Optimization Strategy

1. **Batch operations** when possible
2. **Cache results** to avoid redundant work
3. **Process files incrementally**
4. **Use efficient algorithms**
```

##### Resource Management
```yaml
# Configure resource limits
limits:
  memory: "2GB"
  cpu: "2 cores"
  timeout: "45 minutes"
```

### 7. Agent Inheritance Issues

#### Problem: Agent inheritance not working correctly

**Symptoms:**
- Base prompt not included
- Configuration not inherited
- Circular dependency errors

**Diagnostic Steps:**
1. Check inheritance chain
2. Verify base agent exists
3. Test template substitution
4. Check for circular references

**Solutions:**

##### Fix Inheritance Chain
```yaml
# Ensure base agent exists
---
name: child-agent
from: existing-base-agent  # Must exist
---
{{base-prompt}}  # Include in content
```

##### Avoid Circular Dependencies
```yaml
# Bad - Circular reference
# agent-a.agent.md
---
name: agent-a
from: agent-b
---

# agent-b.agent.md
---
name: agent-b
from: agent-a  # Circular!
---
```

##### Test Template Substitution
```markdown
# In child agent
{{base-prompt}}

Additional instructions for child agent...
```

### 8. Debugging Techniques

#### Enable Debug Mode
```yaml
# Enable debugging
debug:
  enabled: true
  log_level: "debug"
  trace_execution: true
  preserve_artifacts: true
```

#### Use Test Agents
```yaml
# Create test version of agent
---
name: test-security-scanner
from: security-scanner
description: Test version with debug logging
environment:
  variables:
    DEBUG: "true"
    LOG_LEVEL: "debug"
---
```

#### Check Agent Logs
```bash
# View agent execution logs
gh run list --repo owner/repo
gh run view RUN_ID --log
```

#### Test Locally
```bash
# Test agent configuration
a5c validate-agent .a5c/agents/my-agent.agent.md

# Test with specific files
a5c test-agent my-agent --files src/example.js
```

### 9. Common Error Messages

#### "Agent not found"
```yaml
# Check agent file location
# Should be in: .a5c/agents/agent-name.agent.md
# Or configured in: .a5c/config.yml
```

#### "Invalid YAML frontmatter"
```yaml
# Ensure proper YAML structure
---
name: agent-name
description: "Valid description"
---
```

#### "Circular dependency detected"
```yaml
# Check inheritance chain
# agent-a → agent-b → agent-c (OK)
# agent-a → agent-b → agent-a (NOT OK)
```

#### "Permission denied"
```yaml
# Check GitHub token permissions
# Verify repository access
# Check organization settings
```

#### "MCP server not available"
```yaml
# Verify MCP server configuration
mcp_servers:
  - github
  - agent-reporter
  - filesystem
```

### 10. Performance Optimization

#### Optimize Agent Discovery
```yaml
agent_discovery:
  enabled: true
  max_agents_in_context: 5  # Limit context size
  include_same_directory: true
  include_external_agents: []  # Only include if needed
```

#### Efficient Path Matching
```yaml
# Use specific patterns
paths:
  - "src/**/*.{js,ts}"  # Multiple extensions
  - "!src/**/*.test.*"  # Exclude test files

# Avoid overly broad patterns
paths:
  - "**/*"  # Too broad
```

#### Batch Operations
```markdown
## Optimization Tips

1. **Process files in batches** rather than one by one
2. **Cache expensive operations** like API calls
3. **Use efficient data structures** for analysis
4. **Implement early termination** when possible
```

### 11. Advanced Troubleshooting

#### Network Issues
```bash
# Test network connectivity
ping api.github.com
curl -I https://api.github.com

# Check proxy settings
echo $HTTP_PROXY
echo $HTTPS_PROXY
```

#### Memory Issues
```yaml
# Increase memory limits
environment:
  variables:
    NODE_OPTIONS: "--max-old-space-size=4096"
```

#### Concurrency Issues
```yaml
# Limit concurrent execution
execution:
  mode: "sequential"  # or "parallel"
  max_concurrent: 3
```

### 12. Getting Help

#### Check Documentation
- Read the [System Architecture](system-architecture.md)
- Review [Agent Configuration](agent-configuration.md)
- Check [Agent Examples](agent-examples.md)

#### Debug Information to Collect
When reporting issues, include:
- Agent configuration file
- Error messages and logs
- GitHub event that triggered the agent
- Repository structure
- A5C system version

#### Community Support
- Create an issue in the repository
- Include debug information
- Provide minimal reproduction case
- Tag with appropriate labels

### 13. Prevention Strategies

#### Configuration Validation
```yaml
# Use validation tools
validation:
  enabled: true
  strict_mode: true
  check_inheritance: true
  validate_patterns: true
```

#### Testing Strategy
```yaml
# Implement comprehensive testing
testing:
  unit_tests: true
  integration_tests: true
  end_to_end_tests: true
  performance_tests: true
```

#### Monitoring
```yaml
# Set up monitoring
monitoring:
  enabled: true
  metrics: ["execution_time", "success_rate", "error_rate"]
  alerts: ["timeout", "failure", "performance_degradation"]
```

#### Regular Maintenance
```yaml
# Schedule regular maintenance
maintenance:
  schedule: "0 2 * * 0"  # Weekly
  tasks:
    - update_dependencies
    - cleanup_artifacts
    - validate_configurations
    - check_performance
```

By following this troubleshooting guide, you should be able to identify and resolve most common issues with the A5C agent system. Remember to check the configuration first, then verify permissions, and finally examine the execution logs for specific error messages.