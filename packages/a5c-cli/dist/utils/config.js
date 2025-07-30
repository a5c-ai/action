/**
 * CLI Config Utility
 * 
 * This module provides utilities for working with A5C configurations in the CLI.
 */

const fs = require('fs');
const path = require('path');
const { loadConfig } = require('@a5c/sdk');

/**
 * Find A5C config file in the current directory or parent directories
 * @param {string} startDir - Directory to start searching from
 * @returns {string|null} - Path to config file or null if not found
 */
function findConfigFile(startDir = process.cwd()) {
  let currentDir = startDir;
  
  // Look for .a5c/config.yml or .a5c/config.yaml
  while (currentDir !== path.parse(currentDir).root) {
    const configPath1 = path.join(currentDir, '.a5c', 'config.yml');
    const configPath2 = path.join(currentDir, '.a5c', 'config.yaml');
    
    if (fs.existsSync(configPath1)) {
      return configPath1;
    }
    
    if (fs.existsSync(configPath2)) {
      return configPath2;
    }
    
    // Move up one directory
    currentDir = path.dirname(currentDir);
  }
  
  return null;
}

/**
 * Load A5C config for CLI
 * @param {string} configPath - Optional path to config file
 * @returns {Promise<Object>} - Configuration object
 */
async function loadCLIConfig(configPath) {
  // If configPath is provided, use it
  if (configPath && fs.existsSync(configPath)) {
    return loadConfig(configPath);
  }
  
  // Otherwise try to find config file
  const foundConfigPath = findConfigFile();
  
  if (foundConfigPath) {
    return loadConfig(foundConfigPath);
  }
  
  // Return default config if no config file found
  return {
    defaults: {}
  };
}

module.exports = {
  findConfigFile,
  loadCLIConfig
};