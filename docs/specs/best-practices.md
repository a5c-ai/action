# Best Practices Guide

This document provides recommended patterns, conventions, and best practices for developing and deploying A5C agents.

## Agent Development Best Practices

### 1. Agent Design Principles

#### Single Responsibility Principle
Each agent should have a single, well-defined purpose:

```yaml
# Good - Specific responsibility
---
name: security-scanner
description: Scans code for security vulnerabilities
---

# Bad - Multiple responsibilities
---
name: code-analyzer
description: Reviews code quality, security, performance, and documentation
---
```

#### Composition Over Inheritance
Use multiple specialized agents rather than complex inheritance hierarchies:

```yaml
# Good - Specialized agents
---
name: sql-injection-scanner
from: base-security-agent
---

---
name: xss-scanner
from: base-security-agent
---

# Better - Separate focused agents
---
name: sql-injection-scanner
description: Specialized SQL injection detection
---

---
name: xss-scanner
description: Specialized XSS vulnerability detection
---
```

### 2. Configuration Best Practices

#### Use Descriptive Names
```yaml
# Good
---
name: security-vulnerability-scanner
description: Scans for common security vulnerabilities in web applications
---

# Bad
---
name: sec-scan
description: Security stuff
---
```

#### Set Appropriate Priorities
```yaml
# Critical security issues
priority: 90

# Code quality issues
priority: 60

# Documentation updates
priority: 30
```

#### Configure Reasonable Timeouts
```yaml
# Simple agents
timeout: 15

# Complex analysis agents
timeout: 45

# Comprehensive security scans
timeout: 60
```

### 3. Prompt Engineering Best Practices

#### Structure Your Prompts Clearly
```markdown
You are a [ROLE] responsible for [PRIMARY_FUNCTION].

## Primary Tasks
1. [TASK_1]
2. [TASK_2]
3. [TASK_3]

## Guidelines
- [GUIDELINE_1]
- [GUIDELINE_2]
- [GUIDELINE_3]

## Output Format
[SPECIFY_EXPECTED_OUTPUT]
```

#### Provide Context and Examples
```markdown
## Code Review Guidelines

When reviewing JavaScript code, look for:

### Good Pattern
```javascript
// Proper error handling
try {
  const result = await apiCall();
  return result;
} catch (error) {
  logger.error('API call failed', { error });
  throw new CustomError('Operation failed');
}
```

### Bad Pattern
```javascript
// Poor error handling
const result = await apiCall();
return result;
```
```

#### Include Actionable Instructions
```markdown
## Review Actions

1. **Comment on specific lines** with suggestions
2. **Create GitHub issues** for critical problems
3. **Approve the PR** if all checks pass
4. **Request changes** if issues need fixing

## Comment Format
Use this format for PR comments:
- **Issue**: [Description of the problem]
- **Impact**: [Potential consequences]
- **Solution**: [Suggested fix]
- **Priority**: [High/Medium/Low]
```

### 4. Trigger Configuration Best Practices

#### Use Specific Triggers
```yaml
# Good - Specific triggers
events: ["pull_request.opened", "pull_request.synchronize"]
paths: ["src/**/*.js", "src/**/*.ts"]
labels: ["security", "critical"]

# Bad - Overly broad triggers
events: ["*"]
paths: ["**/*"]
```

#### Combine Triggers Appropriately
```yaml
# Security agent - Multiple relevant triggers
events: ["pull_request"]
labels: ["security"]
paths: ["src/**/*.js", "config/**/*.yml"]
mentions: ["@security-review"]
```

#### Use Appropriate Mentions
```yaml
# Good - Clear and memorable
mentions: ["@security-scan", "@sec-review"]

# Bad - Unclear or too similar
mentions: ["@s", "@security-scanner-agent-v2"]
```

## Development Workflow Best Practices

### 1. Agent Testing

#### Test Locally First
```bash
# Test agent configuration
a5c validate-agent .a5c/agents/security-scanner.agent.md

# Test with mock data
a5c test-agent security-scanner --mock-pr 123

# Test specific triggers
a5c test-triggers --event pull_request --files src/auth.js
```

#### Use Test Agents for Development
```yaml
---
name: test-security-scanner
from: security-scanner
description: Test version of security scanner
environment:
  variables:
    DRY_RUN: "true"
    LOG_LEVEL: "debug"
---
```

### 2. Gradual Deployment

#### Start with Low-Risk Repositories
- Test on development repositories first
- Gradually roll out to production repositories
- Monitor performance and error rates

#### Use Feature Flags
```yaml
---
name: experimental-agent
environment:
  variables:
    FEATURE_FLAG: "experimental_analysis"
---

# In prompt
Only run experimental analysis if FEATURE_FLAG is set to "experimental_analysis"
```

### 3. Version Management

#### Use Semantic Versioning
```yaml
# Major version for breaking changes
version: 2.0.0

# Minor version for new features
version: 1.1.0

# Patch version for bug fixes
version: 1.0.1
```

#### Document Changes
```yaml
---
name: security-scanner
version: 1.2.0
description: Security vulnerability scanner
changelog:
  - "1.2.0: Added XSS detection"
  - "1.1.0: Improved SQL injection detection"
  - "1.0.0: Initial release"
---
```

## Performance Best Practices

### 1. Resource Management

#### Set Appropriate Limits
```yaml
# For lightweight agents
max_turns: 5
timeout: 15

# For comprehensive analysis
max_turns: 20
timeout: 60
```

#### Optimize for Parallelization
```yaml
# Use different priorities to control execution order
priority: 80  # High priority agent
priority: 60  # Medium priority agent
priority: 40  # Low priority agent
```

### 2. Efficient Triggering

#### Use Selective Path Triggers
```yaml
# Good - Only trigger on relevant files
paths: ["src/**/*.js", "src/**/*.ts"]

# Bad - Trigger on all files
paths: ["**/*"]
```

#### Combine Related Agents
```yaml
# Instead of separate agents for each language
# Use one multi-language agent
---
name: code-reviewer
paths: ["src/**/*.js", "src/**/*.ts", "src/**/*.py"]
---
```

### 3. Caching and Optimization

#### Use Agent Discovery Wisely
```yaml
agent_discovery:
  enabled: true
  max_agents_in_context: 5  # Limit to essential agents
  include_same_directory: true
  include_external_agents: ["critical-agent"]
```

#### Cache Expensive Operations
```markdown
## Analysis Strategy

1. **Check cache** for previous analysis results
2. **Incremental analysis** for changed files only
3. **Batch operations** when possible
4. **Cache results** for future use
```

## Security Best Practices

### 1. Secret Management

#### Never Hardcode Secrets
```yaml
# Good - Use environment variables
environment:
  secrets:
    - API_KEY
    - DATABASE_PASSWORD

# Bad - Hardcoded secrets
environment:
  variables:
    API_KEY: "sk-1234567890abcdef"
```

#### Use Appropriate Secret Scoping
```yaml
# Repository-level secrets for repo-specific APIs
secrets:
  - REPO_SPECIFIC_API_KEY

# Organization-level secrets for shared services
secrets:
  - SHARED_SERVICE_TOKEN
```

### 2. Permission Management

#### Follow Principle of Least Privilege
```yaml
# Good - Only request needed permissions
mcp_servers:
  - filesystem  # Only if file access needed
  - github      # For GitHub operations

# Bad - Request all permissions
mcp_servers:
  - filesystem
  - github
  - database
  - external-apis
```

#### Validate Permissions
```markdown
## Permission Checks

Before performing sensitive operations:
1. **Verify user permissions** in the repository
2. **Check branch protection** rules
3. **Validate access scope** for the operation
4. **Log permission decisions** for audit
```

### 3. Input Validation

#### Validate All Inputs
```markdown
## Input Validation

Always validate:
- **File paths** to prevent directory traversal
- **User inputs** to prevent injection attacks
- **Configuration values** to prevent misconfiguration
- **API responses** to prevent unexpected data
```

#### Sanitize Outputs
```markdown
## Output Sanitization

When creating GitHub comments or issues:
- **Escape special characters** in code snippets
- **Sanitize user-provided data**
- **Limit output length** to prevent spam
- **Use structured formats** for consistency
```

## Communication Best Practices

### 1. Status Reporting

#### Provide Clear Progress Updates
```javascript
// Good - Descriptive progress messages
await reportProgress(agentId, 1, 5, "Analyzing authentication module");
await reportProgress(agentId, 2, 5, "Checking for SQL injection vulnerabilities");
await reportProgress(agentId, 3, 5, "Scanning for XSS vulnerabilities");

// Bad - Generic progress messages
await reportProgress(agentId, 1, 5, "Processing...");
await reportProgress(agentId, 2, 5, "Still processing...");
```

#### Include Actionable Results
```javascript
// Good - Actionable results
await reportCompleted(agentId, {
  summary: "Security scan completed",
  issues_found: 3,
  critical_issues: 1,
  recommendations: [
    "Fix SQL injection in src/auth.js:42",
    "Add input validation in src/api.js:15",
    "Update dependencies with known vulnerabilities"
  ],
  next_steps: [
    "Review critical issues immediately",
    "Schedule security training",
    "Update security guidelines"
  ]
});
```

### 2. Error Handling

#### Provide Helpful Error Messages
```javascript
// Good - Specific error information
await reportFailed(agentId, {
  error: "ConfigurationError",
  message: "Missing required configuration: security_rules_path",
  context: {
    config_file: ".a5c/config.yml",
    missing_fields: ["security_rules_path"],
    suggestions: ["Add security_rules_path to your configuration"]
  }
});

// Bad - Generic error message
await reportFailed(agentId, {
  error: "Error",
  message: "Something went wrong"
});
```

#### Implement Graceful Degradation
```markdown
## Error Recovery Strategy

When errors occur:
1. **Continue with available data** if possible
2. **Provide partial results** rather than complete failure
3. **Log detailed error information** for debugging
4. **Suggest recovery actions** to users
```

### 3. Agent Collaboration

#### Use Clear Mention Patterns
```markdown
## Agent Collaboration

When triggering other agents:
- Use **specific mentions**: `@security-review` for security review
- Provide **context**: "Security scan found issues @security-review"
- Include **relevant information**: File paths, severity levels
```

#### Coordinate with Related Agents
```yaml
# Use consistent categories and priorities
category: security
priority: 85  # High priority for security

# Reference related agents
agent_discovery:
  include_external_agents: ["compliance-checker", "vulnerability-scanner"]
```

## Monitoring and Observability

### 1. Logging Best Practices

#### Use Structured Logging
```javascript
// Good - Structured logging
await reportLog(agentId, "info", "Security scan started", {
  files: fileList.length,
  scan_type: "comprehensive",
  rules_version: "2.1.0"
});

// Bad - Unstructured logging
await reportLog(agentId, "info", "Starting security scan with 15 files");
```

#### Include Relevant Context
```javascript
// Include file paths, line numbers, and other context
await reportLog(agentId, "warn", "Potential SQL injection detected", {
  file: "src/database.js",
  line: 127,
  function: "getUserData",
  severity: "high",
  pattern: "string concatenation in SQL query"
});
```

### 2. Metrics Collection

#### Track Key Metrics
```javascript
// Track performance metrics
const metrics = {
  execution_time: Date.now() - startTime,
  files_analyzed: fileCount,
  issues_found: issueCount,
  lines_of_code: locCount,
  memory_usage: process.memoryUsage()
};

await reportCompleted(agentId, { metrics });
```

#### Monitor Agent Health
```yaml
# Configure health checks
health_checks:
  enabled: true
  interval: 300  # 5 minutes
  timeout: 30
  metrics:
    - execution_time
    - success_rate
    - error_rate
```

## Troubleshooting Best Practices

### 1. Debugging Strategies

#### Enable Debug Mode
```yaml
# Development configuration
debug:
  enabled: true
  log_level: "debug"
  trace_execution: true
  preserve_artifacts: true
```

#### Use Test Scenarios
```yaml
# Create test scenarios for debugging
test_scenarios:
  - name: "sql_injection_test"
    files: ["test/fixtures/vulnerable.js"]
    expected_issues: 2
  - name: "clean_code_test"
    files: ["test/fixtures/clean.js"]
    expected_issues: 0
```

### 2. Common Issues and Solutions

#### Configuration Issues
```yaml
# Common configuration problems and solutions
common_issues:
  missing_mentions:
    problem: "Agent not triggered by mentions"
    solution: "Add mentions array to configuration"
  
  path_mismatch:
    problem: "Agent not triggered by file changes"
    solution: "Check path patterns match actual file paths"
  
  permission_denied:
    problem: "Agent cannot perform GitHub operations"
    solution: "Verify GitHub token has required permissions"
```

#### Performance Issues
```markdown
## Performance Optimization

Common performance issues:
1. **Timeout errors**: Increase timeout or optimize agent logic
2. **Memory usage**: Process files in batches
3. **API rate limits**: Implement rate limiting and caching
4. **Slow execution**: Profile and optimize critical paths
```

## Migration and Maintenance

### 1. Upgrading Agents

#### Version Compatibility
```yaml
# Maintain backward compatibility
compatibility:
  min_version: "1.0.0"
  max_version: "2.0.0"
  deprecated_features:
    - "legacy_trigger_format"
  migration_guide: "docs/migration-v2.md"
```

#### Migration Strategy
```markdown
## Migration Process

1. **Test new version** in development environment
2. **Deploy to staging** for integration testing
3. **Gradual rollout** to production repositories
4. **Monitor performance** and error rates
5. **Rollback plan** if issues occur
```

### 2. Maintenance Practices

#### Regular Health Checks
```yaml
# Schedule regular maintenance
maintenance:
  schedule: "0 2 * * 0"  # Weekly on Sunday
  tasks:
    - update_dependencies
    - cleanup_old_artifacts
    - validate_configurations
    - check_performance_metrics
```

#### Documentation Updates
```markdown
## Documentation Maintenance

Keep documentation current:
- **Update examples** when configuration changes
- **Add new features** to documentation
- **Remove deprecated** features and examples
- **Update troubleshooting** guides with new issues
```

## Quality Assurance

### 1. Testing Standards

#### Test Coverage
```yaml
# Ensure comprehensive testing
testing:
  unit_tests: true
  integration_tests: true
  end_to_end_tests: true
  performance_tests: true
  security_tests: true
```

#### Test Automation
```yaml
# Automate testing in CI/CD
ci_cd:
  test_on_pr: true
  test_on_push: true
  performance_benchmarks: true
  security_scans: true
```

### 2. Code Review Process

#### Agent Review Checklist
- [ ] Configuration follows best practices
- [ ] Prompt is clear and actionable
- [ ] Security considerations addressed
- [ ] Performance optimized
- [ ] Error handling implemented
- [ ] Documentation updated
- [ ] Tests included

#### Review Automation
```yaml
# Automated reviews for agents
---
name: agent-reviewer
mentions: ["@agent-review"]
paths: ["**/*.agent.md"]
---
You are an agent reviewer. Check that agent configurations follow best practices...
```

These best practices will help ensure that your A5C agents are reliable, maintainable, and effective in automating your development workflows.