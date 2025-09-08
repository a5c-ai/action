const fs = require('fs');
const path = require('path');
const yaml = require('../node_modules/js-yaml');
const core = require('@actions/core');
const { deepMerge } = require('./utils');
const { loadResource } = require('./resource-handler');

// Load configuration files
async function loadConfig() {
  try {
    const configPath = core.getInput('config_file') || '.a5c/config.yml';
    const configUri = core.getInput('config_uri') || null;
    
    // Load user config
    let userConfig = {};
    
    if (configUri) {
      // Load from remote URI using resource handler
      core.info(`📋 Loading configuration from URI: ${configUri}`);
      const configContent = await loadResource(configUri);
      userConfig = yaml.load(configContent) || {};
      core.info(`📋 Loaded user configuration from URI: ${configUri}`);
    } else if (isRemoteUri(configPath)) {
      // Config path is a URI
      core.info(`📋 Loading configuration from URI: ${configPath}`);
      const configContent = await loadResource(configPath);
      userConfig = yaml.load(configContent) || {};
      core.info(`📋 Loaded user configuration from URI: ${configPath}`);
    } else if (fs.existsSync(configPath)) {
      // Load from local file
      const userConfigContent = fs.readFileSync(configPath, 'utf8');
      userConfig = yaml.load(userConfigContent) || {};
      core.info(`📋 Loaded user configuration from local file: ${configPath}`);
      core.debug(`📋 User configuration: ${JSON.stringify(userConfig)}`);
    } else {
      core.info(`📋 No user configuration found at: ${configPath}, using defaults`);
    }
    
    // Load built-in default configuration
    const defaultConfig = loadDefaultConfig();
    
    // Merge configurations with user config taking precedence
    const mergedConfig = deepMerge(defaultConfig, userConfig);
    
    core.info(`📋 Configuration loaded successfully`);
    
    return mergedConfig;
  } catch (error) {
    core.warning(`Error loading configuration: ${error.message}`);
    return loadDefaultConfig();
  }
}

// Load built-in default configuration
function loadDefaultConfig() {
  const defaultConfigPath = path.join(__dirname, '..', 'default-config.yml');
  const defaultConfigContent = fs.readFileSync(defaultConfigPath, 'utf8');
  return yaml.load(defaultConfigContent) || {};
}

// Legacy function - kept for backwards compatibility
async function loadGlobalConfig(configPath) {
  return loadConfig();
}

// Check if a path is a remote URI
function isRemoteUri(path) {
  return path.startsWith('http://') || 
         path.startsWith('https://') || 
         path.startsWith('file://');
}

// Legacy function - kept for backwards compatibility
function mergeConfigurations(globalConfig, agentConfig) {
  return deepMerge(globalConfig, agentConfig);
}

module.exports = {
  loadConfig,
  loadGlobalConfig,
  mergeConfigurations,
  isRemoteUri
}; 