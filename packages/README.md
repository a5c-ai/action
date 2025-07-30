# A5C Packages

This directory contains the different packages that make up the A5C system:

## a5c-sdk

Core SDK for the A5C system, containing all the core functionality:
- Agent loading and validation
- Agent execution
- MCP integration
- Configuration management
- Utilities

## a5c-action

GitHub Action implementation of A5C, using the core SDK:
- GitHub event handling
- GitHub context extraction
- Agent routing
- GitHub-specific functionality

## a5c-cli

Command Line Interface for A5C, also using the core SDK:
- Command-line tooling
- Local agent execution
- Development utilities
- Testing utilities