/**
 * A5C SDK - Main Entry Point
 * 
 * This module exports the main components of the A5C SDK.
 */

// Agent Module Exports
const AgentTriggerEngine = require('./agent/agent-trigger-engine');
const { loadAgentConfigFromFile, resolveAgentInheritance } = require('./agent/agent-loader');
const { validateAgent } = require('./agent/agent-validator');

// Execution Module Exports
const { executeMainAgent } = require('./execution/agent-executor');
const { executeAgent } = require('./execution/agent-execution');
const { processAgentOutput, setOutputs } = require('./execution/output-processor');

// Integration Module Exports
const { 
  getAllMCPServers, 
  createMCPConfigFile, 
  getBuiltinMCPServers,
  validateMCPServerConfig,
  cleanupMCPConfig
} = require('./integration/mcp-manager');
const { loadResource } = require('./integration/resource-handler');

// Utils Module Exports
const { loadConfig, mergeConfigurations } = require('./utils/config');
const { preparePrompt, loadPromptFromUri } = require('./utils/prompt');
const { processFiles } = require('./utils/file-processor');
const { parseFrontmatter, validateCronExpression } = require('./utils/utils');

// SDK Version
const version = '1.0.0';

module.exports = {
  // Agent Module
  AgentTriggerEngine,
  loadAgentConfigFromFile,
  resolveAgentInheritance,
  validateAgent,
  
  // Execution Module
  executeMainAgent,
  executeAgent,
  processAgentOutput,
  setOutputs,
  
  // Integration Module
  getAllMCPServers,
  createMCPConfigFile,
  getBuiltinMCPServers,
  validateMCPServerConfig,
  cleanupMCPConfig,
  loadResource,
  
  // Utils Module
  loadConfig,
  mergeConfigurations,
  preparePrompt,
  loadPromptFromUri,
  processFiles,
  parseFrontmatter,
  validateCronExpression,
  
  // Version
  version
};