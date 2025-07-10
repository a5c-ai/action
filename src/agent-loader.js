const fs = require('fs');
const path = require('path');
const core = require('@actions/core');
const frontmatter = require('front-matter');
const { loadPromptFromUri } = require('./prompt');
const { loadResource } = require('./resource-handler');

// Load agent configuration from file path
async function loadAgentConfigFromFile(filePath) {
  core.info(`📋 Loading agent configuration from: ${filePath}`);
  
  const agentContent = fs.readFileSync(filePath, 'utf8');
  
  // Parse frontmatter
  const parsed = frontmatter(agentContent);
  if (!parsed.attributes) {
    throw new Error('Agent file must contain YAML frontmatter with configuration');
  }
  
  // Add the prompt content from the body or from prompt_uri
  const config = parsed.attributes;
  
  if (config.prompt_uri) {
    // Load prompt from URI using resource handler
    core.info(`📝 Loading prompt from URI: ${config.prompt_uri}`);
    config.prompt_content = await loadPromptFromUri(config.prompt_uri, config);
  } else {
    // Use the body content as prompt
    config.prompt_content = parsed.body.trim();
  }
  
  return config;
}

// Parse agent URI and load configuration (legacy support)
async function loadAgentConfig(agentUri) {
  core.info(`📋 Loading agent configuration from: ${agentUri}`);
  
  let agentContent;
  
  if (agentUri.startsWith('file://') || agentUri.startsWith('http://') || agentUri.startsWith('https://')) {
    // Use resource handler for URIs
    agentContent = await loadResource(agentUri);
  } else if (agentUri.startsWith('agent://')) {
    // Agent ID lookup
    const agentId = agentUri.substring(8); // Remove 'agent://'
    const agentPath = `.a5c/agents/${agentId}.agent.md`;
    agentContent = fs.readFileSync(agentPath, 'utf8');
  } else {
    // Assume it's a local file path
    agentContent = fs.readFileSync(agentUri, 'utf8');
  }
  
  // Parse frontmatter
  const parsed = frontmatter(agentContent);
  if (!parsed.attributes) {
    throw new Error('Agent file must contain YAML frontmatter with configuration');
  }
  
  // Add the prompt content from the body or from prompt_uri
  const config = parsed.attributes;
  
  if (config.prompt_uri) {
    // Load prompt from URI using resource handler
    core.info(`📝 Loading prompt from URI: ${config.prompt_uri}`);
    config.prompt_content = await loadPromptFromUri(config.prompt_uri, config);
  } else {
    // Use the body content as prompt
    config.prompt_content = parsed.body.trim();
  }
  
  return config;
}

// Generate agent discovery context
async function generateAgentDiscoveryContext(config) {
  if (!config.agent_discovery?.enabled) {
    return [];
  }
  
  core.info('🔍 Generating agent discovery context');
  
  const agentContext = [];
  const maxAgents = config.agent_discovery.max_agents_in_context || 10;
  
  try {
    // Get agents from same directory
    if (config.agent_discovery.include_same_directory) {
      const currentAgentDir = path.dirname(process.env.GITHUB_WORKSPACE || '.');
      const agentsDir = path.join(currentAgentDir, '.a5c', 'agents');
      
      if (fs.existsSync(agentsDir)) {
        const agentFiles = getAllAgentFiles(agentsDir)
          .slice(0, maxAgents);
        
        for (const agentFile of agentFiles) {
          const agentId = path.basename(agentFile, '.agent.md');
          if (agentId === config.name) continue; // Skip self
          
          const agentInfo = await loadAgentInfo(agentFile);
          if (agentInfo) {
            agentContext.push(agentInfo);
          }
        }
      }
    }
    
    // Get explicitly included external agents 
    // @code-review needs review
    if (config.agent_discovery.include_external_agents) {
      for (const agentId of config.agent_discovery.include_external_agents) {
        const agentPath = `.a5c/agents/${agentId}.agent.md`;
        if (fs.existsSync(agentPath)) {
          const agentInfo = await loadAgentInfo(agentPath);
          if (agentInfo) {
            agentContext.push(agentInfo);
          }
        }
      }
    }
    
    return agentContext;
  } catch (error) {
    core.warning(`Error generating agent discovery context: ${error.message}`);
    return [];
  }
}

// Get all agent files recursively from a directory
function getAllAgentFiles(dir) {
  const agentFiles = [];
  
  function scanDirectory(currentDir) {
    try {
      const items = fs.readdirSync(currentDir);
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          scanDirectory(fullPath);
        } else if (stat.isFile() && item.endsWith('.agent.md')) {
          agentFiles.push(fullPath);
        }
      }
    } catch (error) {
      core.warning(`Error scanning directory ${currentDir}: ${error.message}`);
    }
  }
  
  scanDirectory(dir);
  return agentFiles.sort();
}

// Load agent information from file
async function loadAgentInfo(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = frontmatter(content);
    
    if (!parsed.attributes) {
      return null;
    }
    
    const config = parsed.attributes;
    return {
      id: config.name || path.basename(filePath, '.agent.md'),
      name: config.name || 'Unknown Agent',
      description: config.description || 'No description available',
      usage_context: config.usage_context || 'No usage context available',
      invocation_context: config.invocation_context || 'No invocation context available',
      mentions: config.mentions || 'No mentions available',
      category: config.category || 'general'
    };
  } catch (error) {
    core.warning(`Error loading agent info from ${filePath}: ${error.message}`);
    return null;
  }
}

module.exports = {
  loadAgentConfigFromFile,
  loadAgentConfig,
  generateAgentDiscoveryContext
}; 