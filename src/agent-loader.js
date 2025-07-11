const fs = require('fs');
const path = require('path');
const core = require('@actions/core');
const frontmatter = require('front-matter');
const { loadPromptFromUri } = require('./prompt');
const { loadResource } = require('./resource-handler');
const Handlebars = require('handlebars');

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
  
  // Process inheritance if 'from' field is present
  if (config.from) {
    core.debug(`🔄 Processing inheritance from: ${config.from}`);
    return await resolveAgentInheritance(config, filePath);
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
  
  // Process inheritance if 'from' field is present
  if (config.from) {
    core.debug(`🔄 Processing inheritance from: ${config.from}`);
    return await resolveAgentInheritance(config, agentUri);
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

// Resolve agent inheritance chain
async function resolveAgentInheritance(config, currentPath, inheritanceChain = []) {
  const agentName = config.name || path.basename(currentPath, '.agent.md');
  
  // Check for circular inheritance
  if (inheritanceChain.includes(agentName)) {
    throw new Error(`Circular inheritance detected: ${inheritanceChain.join(' -> ')} -> ${agentName}`);
  }
  
  // Add current agent to chain for cycle detection
  const newChain = [...inheritanceChain, agentName];
  core.debug(`🔄 Resolving inheritance chain: ${newChain.join(' -> ')}`);
  
  // Load base agent
  const baseAgent = await loadBaseAgent(config.from);
  
  // Recursively resolve base agent inheritance
  let resolvedBaseAgent = baseAgent;
  if (baseAgent.from) {
    core.debug(`🔄 Base agent ${baseAgent.name} also has inheritance, resolving...`);
    resolvedBaseAgent = await resolveAgentInheritance(baseAgent, config.from, newChain);
  }
  
  // Merge configurations (child overrides parent)
  const mergedConfig = mergeAgentConfigs(resolvedBaseAgent, config);
  
  // Process prompt inheritance with base-prompt variable
  if (mergedConfig.prompt_content) {
    mergedConfig.prompt_content = await processPromptInheritance(
      mergedConfig.prompt_content,
      resolvedBaseAgent.prompt_content || ''
    );
  }
  
  core.debug(`✅ Inheritance resolved for ${agentName}`);
  return mergedConfig;
}

// Load base agent from various sources
async function loadBaseAgent(fromSpec) {
  core.debug(`📋 Loading base agent: ${fromSpec}`);
  
  let baseAgentContent;
  
  // Handle different 'from' formats
  if (fromSpec.startsWith('http://') || fromSpec.startsWith('https://') || fromSpec.startsWith('file://')) {
    // Remote or file URI
    baseAgentContent = await loadResource(fromSpec);
  } else if (fromSpec.startsWith('agent://')) {
    // Agent ID lookup
    const agentId = fromSpec.substring(8); // Remove 'agent://'
    const agentPath = `.a5c/agents/${agentId}.agent.md`;
    if (!fs.existsSync(agentPath)) {
      throw new Error(`Base agent not found: ${agentPath}`);
    }
    baseAgentContent = fs.readFileSync(agentPath, 'utf8');
  } else if (fromSpec.includes('/') || fromSpec.includes('\\')) {
    // File path
    if (!fs.existsSync(fromSpec)) {
      throw new Error(`Base agent file not found: ${fromSpec}`);
    }
    baseAgentContent = fs.readFileSync(fromSpec, 'utf8');
  } else {
    // Assume it's an agent ID - try multiple possible locations
    const possiblePaths = [
      `.a5c/agents/${fromSpec}.agent.md`,
      `.a5c/agents/examples/${fromSpec}.agent.md`,
      `${fromSpec}.agent.md`
    ];
    
    let foundPath = null;
    for (const agentPath of possiblePaths) {
      if (fs.existsSync(agentPath)) {
        foundPath = agentPath;
        break;
      }
    }
    
    if (!foundPath) {
      throw new Error(`Base agent not found. Tried: ${possiblePaths.join(', ')}`);
    }
    
    baseAgentContent = fs.readFileSync(foundPath, 'utf8');
  }
  
  // Parse the base agent
  const parsed = frontmatter(baseAgentContent);
  if (!parsed.attributes) {
    throw new Error(`Base agent file must contain YAML frontmatter: ${fromSpec}`);
  }
  
  const baseConfig = parsed.attributes;
  
  // Load prompt content
  if (baseConfig.prompt_uri) {
    core.info(`📝 Loading base agent prompt from URI: ${baseConfig.prompt_uri}`);
    baseConfig.prompt_content = await loadPromptFromUri(baseConfig.prompt_uri, baseConfig);
  } else {
    baseConfig.prompt_content = parsed.body.trim();
  }
  
  return baseConfig;
}

// Merge agent configurations with child taking precedence
function mergeAgentConfigs(baseConfig, childConfig) {
  core.debug(`🔄 Merging configurations: base=${baseConfig.name}, child=${childConfig.name}`);
  
  // Create a deep copy of base config
  const merged = JSON.parse(JSON.stringify(baseConfig));
  
  // Fields that can be overridden
  const overridableFields = [
    'name', 'version', 'category', 'description', 'model', 'max_turns', 'timeout',
    'priority', 'mentions', 'usage_context', 'invocation_context', 'cli_command',
    'mcp_servers', 'trigger_events', 'trigger_labels', 'trigger_branches', 
    'trigger_files', 'trigger_schedule', 'labels', 'branches', 'paths', 
    'activation_cron', 'agent_discovery', 'prompt_uri', 'prompt_content'
  ];
  
  // Override fields from child config
  for (const field of overridableFields) {
    if (childConfig[field] !== undefined) {
      merged[field] = childConfig[field];
      core.debug(`🔄 Overriding ${field} from child config`);
    }
  }
  
  // Special handling for array fields - merge instead of override
  const arrayFields = ['trigger_events', 'trigger_labels', 'trigger_branches', 'trigger_files', 'mcp_servers'];
  for (const field of arrayFields) {
    if (baseConfig[field] && childConfig[field]) {
      // Merge arrays and remove duplicates
      merged[field] = [...new Set([...baseConfig[field], ...childConfig[field]])];
      core.debug(`🔄 Merging array field ${field}`);
    }
  }
  
  // Remove the 'from' field as it's no longer needed
  delete merged.from;
  
  return merged;
}

// Process prompt inheritance with base-prompt variable support
async function processPromptInheritance(childPrompt, basePrompt) {
  core.debug(`🔄 Processing prompt inheritance with base-prompt variable`);
  
  // Check if the child prompt uses the base-prompt variable
  if (childPrompt.includes('{{base-prompt}}') || childPrompt.includes('{{{base-prompt}}}')) {
    core.debug(`🔄 Child prompt uses base-prompt variable, substituting...`);
    
    // Create template context with base-prompt
    const templateContext = {
      'base-prompt': basePrompt
    };
    
    // Compile and render the template
    const template = Handlebars.compile(childPrompt);
    const renderedPrompt = template(templateContext);
    
    core.debug(`✅ Prompt inheritance processed successfully`);
    return renderedPrompt;
  }
  
  // If no base-prompt variable is used, just return the child prompt
  core.debug(`🔄 No base-prompt variable found, using child prompt as-is`);
  return childPrompt;
}

module.exports = {
  loadAgentConfigFromFile,
  loadAgentConfig,
  generateAgentDiscoveryContext
}; 