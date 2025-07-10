#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');

/**
 * Agent Reporter MCP Server
 * 
 * This MCP server provides tools for agent status reporting and communication
 * between agents and the main agent-execution process.
 */
class AgentReporterMCPServer {
  constructor() {
    this.statusFd = null;
    this.logFd = null;
    
    // Initialize file descriptors from environment
    this.initializeFileDescriptors();
    
    // Create MCP server
    this.server = new Server({
      name: 'agent-reporter',
      version: '1.0.0'
    }, {
      capabilities: {
        tools: {}
      }
    });
    
    // Set up tools
    this.setupTools();
    
    // Set up graceful shutdown
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  /**
   * Initialize file descriptors for communication
   */
  initializeFileDescriptors() {
    try {
      const statusFdNum = process.env.AGENT_STATUS_FD;
      const logFdNum = process.env.AGENT_LOG_FD;
      
      if (statusFdNum) {
        this.statusFd = parseInt(statusFdNum);
        this.log(`Using status FD ${this.statusFd}`);
      }
      
      if (logFdNum) {
        this.logFd = parseInt(logFdNum);
        this.log(`Using log FD ${this.logFd}`);
      }
    } catch (error) {
      this.log(`Error initializing file descriptors: ${error.message}`);
    }
  }

  /**
   * Log to stderr for debugging
   */
  log(message) {
    console.error(`[Agent Reporter MCP] ${message}`);
  }

  /**
   * Set up MCP tools
   */
  setupTools() {
    // Report status tool
    this.server.setRequestHandler({
      method: 'tools/list'
    }, async () => {
      return {
        tools: [
          {
            name: 'report_status',
            description: 'Report agent status back to the main process',
            inputSchema: {
              type: 'object',
              properties: {
                agentId: {
                  type: 'string',
                  description: 'ID of the agent reporting status'
                },
                status: {
                  type: 'string',
                  description: 'Status to report (started, running, completed, failed, progress)',
                  enum: ['started', 'running', 'completed', 'failed', 'progress']
                },
                data: {
                  type: 'object',
                  description: 'Additional data to include with the status report'
                }
              },
              required: ['agentId', 'status']
            }
          },
          {
            name: 'report_log',
            description: 'Report agent logs back to the main process',
            inputSchema: {
              type: 'object',
              properties: {
                agentId: {
                  type: 'string',
                  description: 'ID of the agent reporting the log'
                },
                level: {
                  type: 'string',
                  description: 'Log level',
                  enum: ['info', 'warn', 'error', 'debug']
                },
                message: {
                  type: 'string',
                  description: 'Log message'
                },
                context: {
                  type: 'object',
                  description: 'Additional context for the log entry'
                }
              },
              required: ['agentId', 'level', 'message']
            }
          },
          {
            name: 'report_progress',
            description: 'Report agent progress',
            inputSchema: {
              type: 'object',
              properties: {
                agentId: {
                  type: 'string',
                  description: 'ID of the agent reporting progress'
                },
                progress: {
                  type: 'number',
                  description: 'Current progress value'
                },
                total: {
                  type: 'number',
                  description: 'Total progress value'
                },
                message: {
                  type: 'string',
                  description: 'Progress message'
                }
              },
              required: ['agentId', 'progress', 'total']
            }
          },
          {
            name: 'get_agent_status',
            description: 'Get current agent status',
            inputSchema: {
              type: 'object',
              properties: {
                agentId: {
                  type: 'string',
                  description: 'ID of the agent to get status for'
                }
              },
              required: ['agentId']
            }
          },
          {
            name: 'list_agents',
            description: 'List available agents in the system',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          }
        ]
      };
    });

    // Tool call handler
    this.server.setRequestHandler({
      method: 'tools/call'
    }, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        let result;
        
        switch (name) {
          case 'report_status':
            result = this.reportStatus(args.agentId, args.status, args.data || {});
            break;
          case 'report_log':
            result = this.reportLog(args.agentId, args.level, args.message, args.context || {});
            break;
          case 'report_progress':
            result = this.reportProgress(args.agentId, args.progress, args.total, args.message || '');
            break;
          case 'get_agent_status':
            result = this.getAgentStatus(args.agentId);
            break;
          case 'list_agents':
            result = this.listAgents();
            break;
          default:
            throw new Error(`Unknown tool: ${name}`);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error.message
              }, null, 2)
            }
          ]
        };
      }
    });
  }

  /**
   * Report agent status
   */
  reportStatus(agentId, status, data = {}) {
    if (!this.statusFd) {
      return { success: false, error: 'Status FD not configured' };
    }

    try {
      const statusReport = {
        timestamp: new Date().toISOString(),
        agentId: agentId,
        status: status,
        data: data
      };

      const message = JSON.stringify(statusReport) + '\n';
      fs.writeSync(this.statusFd, message);
      
      return { success: true, message: 'Status reported successfully' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Report agent log
   */
  reportLog(agentId, level, message, context = {}) {
    if (!this.logFd) {
      return { success: false, error: 'Log FD not configured' };
    }

    try {
      const logEntry = {
        timestamp: new Date().toISOString(),
        agentId: agentId,
        level: level,
        message: message,
        context: context
      };

      const logMessage = JSON.stringify(logEntry) + '\n';
      fs.writeSync(this.logFd, logMessage);
      
      return { success: true, message: 'Log reported successfully' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Report agent progress
   */
  reportProgress(agentId, progress, total, message = '') {
    const progressData = {
      progress: progress,
      total: total,
      percentage: total > 0 ? Math.round((progress / total) * 100) : 0,
      message: message
    };

    return this.reportStatus(agentId, 'progress', progressData);
  }

  /**
   * Get agent status
   */
  getAgentStatus(agentId) {
    return {
      success: true,
      agentId: agentId,
      status: 'unknown',
      timestamp: new Date().toISOString(),
      message: 'Status queried successfully'
    };
  }

  /**
   * List available agents
   */
  listAgents() {
    try {
      const agentsDir = path.join('.a5c', 'agents');
      if (!fs.existsSync(agentsDir)) {
        return { success: true, agents: [], count: 0 };
      }

      const files = this.findAgentFiles(agentsDir);
      const agents = files.map(file => {
        const agentId = path.basename(file, '.agent.md');
        const relativePath = path.relative(agentsDir, file);
        
        return {
          id: agentId,
          file: relativePath,
          path: file
        };
      });

      return { 
        success: true, 
        agents: agents,
        count: agents.length
      };
    } catch (error) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * Find agent files recursively
   */
  findAgentFiles(dir, agentFiles = []) {
    try {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const itemPath = path.join(dir, item);
        const stat = fs.statSync(itemPath);
        
        if (stat.isDirectory()) {
          this.findAgentFiles(itemPath, agentFiles);
        } else if (stat.isFile() && item.endsWith('.agent.md')) {
          agentFiles.push(itemPath);
        }
      }
    } catch (error) {
      this.log(`Error reading directory ${dir}: ${error.message}`);
    }
    
    return agentFiles;
  }

  /**
   * Start the MCP server
   */
  async start() {
    this.log(`Agent Reporter MCP Server starting...`);
    this.log(`Status FD: ${this.statusFd || 'not configured'}`);
    this.log(`Log FD: ${this.logFd || 'not configured'}`);

    try {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      this.log('Agent Reporter MCP Server connected and ready');
    } catch (error) {
      this.log(`Failed to start MCP server: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Shutdown the server
   */
  async shutdown() {
    this.log('Agent Reporter MCP Server shutting down...');
    
    try {
      await this.server.close();
    } catch (error) {
      this.log(`Error during shutdown: ${error.message}`);
    }
    
    // Close file descriptors
    if (this.statusFd) {
      try {
        fs.closeSync(this.statusFd);
      } catch (error) {
        // Ignore close errors
      }
    }
    
    if (this.logFd) {
      try {
        fs.closeSync(this.logFd);
      } catch (error) {
        // Ignore close errors
      }
    }
    
    process.exit(0);
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  const server = new AgentReporterMCPServer();
  server.start().catch(error => {
    console.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  });
}

module.exports = AgentReporterMCPServer; 