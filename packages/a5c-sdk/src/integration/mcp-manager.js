const fs = require('fs');
const path = require('path');
const os = require('os');
const core = require('@actions/core');
const github = require('@actions/github');
const { spawn } = require('child_process');
const { loadMCPConfig } = require('./config');

// Global MCP server registry
const mcpServers = new Map();

// Built-in MCP servers - embedded in the action
const BUILTIN_MCP_SERVERS = {
  'agent-reporter': {
    command: "node",
    args: [path.join(__dirname, 'agent-reporter-mcp.js')],
    env: {
      NODE_ENV: "production",
      GITHUB_TOKEN: "${GITHUB_TOKEN}",
      GITHUB_REPOSITORY: "${GITHUB_REPOSITORY}",
      AGENT_STATUS_FD: "${AGENT_STATUS_FD}",
      AGENT_LOG_FD: "${AGENT_LOG_FD}"
    },
    description: "Agent status reporting and communication server"
  },
  github: {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    env: {
      GITHUB_TOKEN: "${GITHUB_TOKEN}"
    },
    description: "GitHub API integration for repositories, issues, and PRs"
  }
};

/**
 * Get all available MCP servers (built-in + user-defined)
 * @param {string} userConfigPath - Path to user MCP configuration file
 * @returns {object} - Combined MCP servers configuration
 */
function getAllMCPServers(userConfigPath = null) {
  const allServers = { ...BUILTIN_MCP_SERVERS };
  
  // Load user-defined servers if config file exists
  if (userConfigPath && fs.existsSync(userConfigPath)) {
    try {
      const userConfig = JSON.parse(fs.readFileSync(userConfigPath, 'utf8'));
      
      if (userConfig.mcpServers) {
        // Merge user servers with built-in servers (user servers take precedence)
        Object.assign(allServers, userConfig.mcpServers);
        core.info(`📋 Loaded ${Object.keys(userConfig.mcpServers).length} user-defined MCP server(s)`);
      }
    } catch (error) {
      core.warning(`Failed to load user MCP configuration from ${userConfigPath}: ${error.message}`);
    }
  }
  
  core.info(`📋 Available MCP servers: ${Object.keys(allServers).join(', ')}`);
  return allServers;
}

/**
 * Create a temporary MCP configuration file with selected servers
 * @param {string[]} serverNames - Names of servers to include
 * @param {object} globalConfig - Global configuration object
 * @returns {Promise<string|null>} - Path to temporary MCP config file
 */
async function createMCPConfigFile(serverNames, globalConfig) {
  // Ensure serverNames is an array (can be empty)
  if (!serverNames) {
    serverNames = [];
  }
  
  try {
    // Get all available servers
    const userConfigPath = globalConfig.mcp_config_path;
    const allServers = getAllMCPServers(userConfigPath);
    
    // Always include default MCP servers
    const selectedServers = {};
    const defaultServers = ['github', 'agent-reporter'];
    
    // Add default servers first
    for (const serverName of defaultServers) {
      if (allServers[serverName]) {
        selectedServers[serverName] = allServers[serverName];
      }
    }
    
    // Filter to only requested servers (in addition to defaults)
    const missingServers = [];
    
    for (const serverName of serverNames) {
      if (allServers[serverName]) {
        selectedServers[serverName] = allServers[serverName];
      } else {
        missingServers.push(serverName);
      }
    }
    
    if (missingServers.length > 0) {
      core.warning(`Requested MCP servers not found: ${missingServers.join(', ')}`);
    }
    
    if (Object.keys(selectedServers).length === 0) {
      core.warning('No valid MCP servers found for the requested list');
      return null;
    }
    
    // Create temporary config file
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `mcp-config-${Date.now()}.json`);
    
    const tempConfig = {
      mcpServers: selectedServers
    };
    
    fs.writeFileSync(tempFile, JSON.stringify(tempConfig, null, 2));
    
    core.info(`📝 Created temporary MCP config: ${tempFile}`);
    core.info(`📋 Included servers: ${Object.keys(selectedServers).join(', ')}`);
    
    return tempFile;
  } catch (error) {
    core.warning(`Failed to create MCP config: ${error.message}`);
    return null;
  }
}

/**
 * Get built-in MCP servers list
 * @returns {object} - Built-in MCP servers
 */
function getBuiltinMCPServers() {
  return { ...BUILTIN_MCP_SERVERS };
}

/**
 * Validate MCP server configuration
 * @param {object} serverConfig - Server configuration to validate
 * @returns {boolean} - True if valid
 */
function validateMCPServerConfig(serverConfig) {
  if (!serverConfig || typeof serverConfig !== 'object') {
    return false;
  }
  
  // Must have command and args
  if (!serverConfig.command || !Array.isArray(serverConfig.args)) {
    return false;
  }
  
  return true;
}

/**
 * Clean up temporary MCP configuration file
 * @param {string} filePath - Path to temporary file
 */
function cleanupMCPConfig(filePath) {
  if (!filePath) return;
  
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      core.info(`🧹 Cleaned up temporary MCP config: ${filePath}`);
    }
  } catch (error) {
    core.warning(`Failed to cleanup MCP config ${filePath}: ${error.message}`);
  }
}

module.exports = {
  getAllMCPServers,
  createMCPConfigFile,
  getBuiltinMCPServers,
  validateMCPServerConfig,
  cleanupMCPConfig,
  BUILTIN_MCP_SERVERS
}; 