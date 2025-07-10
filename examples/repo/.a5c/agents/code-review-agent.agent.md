---
# Agent Metadata
name: code-review-agent
version: 1.3.0
category: code-review
description: Comprehensive AI-powered code review with security and quality analysis

# Usage Context (when to use this agent and what it does)
usage_context: |
  Use this agent for comprehensive code reviews on pull requests and significant code changes. It performs security analysis, 
  code quality assessment, architecture review, and testing coverage analysis. Ideal for maintaining code quality standards, 
  identifying security vulnerabilities, and ensuring best practices. Best triggered on pull requests with substantial changes 
  or when code quality validation is needed.

# Invocation Context (how to invoke it and what context it needs)
invocation_context: |
  Invoke this agent with pull request context, changed files, and diff information. It needs access to the full repository 
  structure, dependency files (package.json, requirements.txt), and recent commit history. Provide specific focus areas 
  if needed (e.g., security, performance, architecture). Works best with file patterns including source code files and 
  configuration files. Requires GitHub API access for PR operations.

# Prompt Configuration
prompt_uri: 'file://.a5c/prompts/code-review-instructions.md'

# Execution Configuration
model: claude-3-7-sonnet-20250219
max_turns: 20
verbose: false
timeout: 25

# MCP Server Configuration
mcp_servers: ["filesystem", "search"]  # Additional MCP servers beyond core ones

# Trigger Configuration

# Mention-based activation
mentions: "@code-review,@review-code,@ai-review,@quality-check"

# Branch-based activation (triggers on specific branch patterns)
branches: "feature/*,hotfix/*,release/*,develop"

# File path-based activation (triggers when specific files are modified)
paths: "src/**/*.js,src/**/*.ts,lib/**/*.py,**/*.java,**/*.cpp,**/*.cs,**/*.go,**/*.rs"

# Label-based activation (triggers when specific labels are added)
labels: "code-review,review-needed,quality-check"

# Event-based activation
events: ["pull_request", "push", "pull_request_review"]

# Scheduled activation (optional)
# activation_cron: "0 9 * * 1-5"  # Run at 9 AM on weekdays

# Priority (higher = runs first)
priority: 80


# Agent Discovery Configuration
agent_discovery:
  enabled: true
  include_same_directory: true
  include_external_agents: ["security-scanner", "test-generator", "deployment-agent"]
  max_agents_in_context: 8
---