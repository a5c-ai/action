# A5C Agent Examples

This directory contains example agent configurations and workflows for the A5C Agent System.

## Overview

The A5C Agent System provides:
- **Intelligent agent routing**: Automatically route GitHub events to appropriate AI agents
- **Mention-based activation**: Agents triggered by mentions in commits, issues, PRs, and code comments
- **Single workflow**: One workflow handles all agents through intelligent routing all defined in the .a5c/config.yml file and in each agent file (.a5c/agents/agent-name.agent.md)

## Getting Started

1. **Set up the workflow**: Copy `.github/workflows/a5c.yml` to your repository
2. **Create agent files**: Add `.agent.md` files to the `.a5c/agents/` directory
3. **Configure**: Modify `.a5c/config.yml` to customize behavior
4. **Deploy**: Push to GitHub and the system will automatically handle routing

## Directory Structure

```
your-repo/
├── .a5c/
│   ├── config.yml
│   ├── mcps.json
│   └── agents/
│       ├── code-review-agent.agent.md
│       ├── security-scanner.agent.md
│       ├── deployment-agent.agent.md
│       └── security/
│           └── vulnerability-scanner.agent.md
├── .github/
│   └── workflows/
│       └── a5c.yml
... 
```

## Creating New Agents

See the individual agent files for detailed configuration examples and the main README for comprehensive documentation. 

## Agent Communication

Agents can communicate through:
- **Commit messages**: `git commit -m "Fix bug @security-scanner @code-review"`
- **Issue comments**: Mention agents in issue discussions
- **PR comments**: Mention agents in pull request reviews
- **Code comments**: `// @security-scanner: Check this function`

## Configuration Examples

See the individual agent files for detailed configuration examples and the main README for comprehensive documentation. 