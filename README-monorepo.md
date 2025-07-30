# A5C - AI Agent System

A5C is a flexible AI agent system for GitHub automation. It provides a modular and extensible platform for AI-powered workflows in GitHub repositories.

## Repository Structure

This repository is organized as a monorepo containing multiple packages:

- **a5c-sdk**: Core SDK containing the core logic of the a5c system
- **a5c-action**: GitHub Action implementation using the a5c-sdk package
- **a5c-cli**: CLI tool for running actions and other utilities

## Features

- **Unified Resource Handler**: Robust loading of prompts, agents, and configurations from local files, HTTP/HTTPS URLs, and file:// URIs with caching and retry logic
- **Multiple CLI Tool Support**: Configurable templates for Claude, Aider, Cursor, and custom tools
- **Agent Discovery**: Automatic agent detection and routing based on events and mentions
- **Remote Agent Support**: Load agents from remote repositories and individual URLs
- **Built-in MCP Servers**: Filesystem, memory, time, search, and GitHub integration built into the action
- **Schedule-based Activation**: Cron-based agent triggering for automated workflows
- **MCP Server Integration**: Support for Model Context Protocol servers with configurable server selection
- **Flexible Configuration**: Hierarchical configuration with built-in defaults and user overrides
- **Mention-based Triggering**: Agents triggered by specific mentions in comments (serial execution by appearance order)
- **Event-based Triggering**: Agents triggered by GitHub events (execution by priority)
- **Structured Output Processing**: Intelligent extraction of structured data from agent responses

## Quick Start

1. **Create the directory structure**:
   ```bash
   mkdir -p .a5c/agents
   ```

2. **Create a configuration file** (`.a5c/config.yml`):
   ```yaml
   defaults:
     cli_command: "cat {{prompt_path}} | claude {{#if mcp_config}}--mcp-config {{mcp_config}}{{/if}} -p 'fulfill the request'"
     
   file_processing:
     include_patterns:
       - "*.js"
       - "*.ts"
       - "*.py"
     exclude_patterns:
       - "node_modules/**"
       - "*.test.js"
   
   # Optional: Remote agents configuration
   remote_agents:
     enabled: true
     cache_timeout: 120     # Cache timeout in minutes (2 hours)
     retry_attempts: 5      # Number of retry attempts
   ```

3. **Create an agent file** (`.a5c/agents/my-agent.agent.md`):
   ```markdown
   ---
   name: My Agent
   category: development
   description: An example agent
   mentions: ["@my-agent"]
   events: ["push", "pull_request", "issue_comment"]
   priority: 10
   ---

   # Main Instructions

   You are an AI agent tasked with helping with development tasks.

   ## Core Responsibilities

   1. Review code changes
   2. Suggest improvements
   3. Fix bugs
   4. Help with documentation
   ```

4. **Use the agent in your GitHub Actions workflow**:
   ```yaml
   name: Run A5C Agents

   on:
     push:
     pull_request:
     issues:
       types: [opened, edited]
     issue_comment:
       types: [created, edited]

   jobs:
     a5c:
       runs-on: ubuntu-latest
       steps:
         - name: Checkout repository
           uses: actions/checkout@v4
           
         - name: Run A5C
           uses: a5c-ai/action@main
   ```

## Documentation

For more detailed documentation, see the [packages directory](./packages) or the individual package READMEs:

- [a5c-sdk](./packages/a5c-sdk/README.md)
- [a5c-action](./packages/a5c-action/README.md)
- [a5c-cli](./packages/a5c-cli/README.md)

## License

MIT