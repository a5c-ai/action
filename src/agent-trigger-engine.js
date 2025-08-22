const fs = require('fs');
const path = require('path');
const core = require('@actions/core');
const github = require('@actions/github');
const { loadResource } = require('./resource-handler');
const { parseFrontmatter, validateCronExpression } = require('./utils');

/**
 * AgentRouter - Enhanced with async path trigger support for PR file detection
 * 
 * Key async pattern updates:
 * - getTriggeredAgents() now async to support API-based path triggers
 * - checkAllTriggers() now async to support async path checking
 * - checkPathTriggers() now async to support GitHub API calls
 * - getChangedFiles() now async to fetch PR files from GitHub API
 * 
 * Features:
 * - PR file detection via GitHub API
 * - PR merge detection in push events
 * - Caching for repeated API calls (5-minute TTL)
 * - Rate limiting awareness and graceful degradation
 * - API usage metrics tracking
 * - Robust merge commit message parsing
 */
class AgentRouter {
  constructor(config = {}) {
    this.agents = new Map();
    this.config = config;
    
    // Enhanced rate limiting
    this.rateLimiter = {
      requests: new Map(),
      windowMs: 60000, // 1 minute
      maxRequests: 60, // GitHub API rate limit considerations
      
      isAllowed(key) {
        const now = Date.now();
        const windowStart = now - this.windowMs;
        
        if (!this.requests.has(key)) {
          this.requests.set(key, []);
        }
        
        const requests = this.requests.get(key);
        const validRequests = requests.filter(time => time > windowStart);
        this.requests.set(key, validRequests);
        
        if (validRequests.length >= this.maxRequests) {
          return false;
        }
        
        validRequests.push(now);
        return true;
      }
    };
    
    // Enhanced caching with TTL
    this.cache = new Map();
    this.cacheTTL = 300000; // 5 minutes
    this.lastCacheClean = Date.now();
  }

  // Clean expired cache entries
  cleanCache() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.cacheTTL) {
        this.cache.delete(key);
      }
    }
  }

  // Get from cache with TTL check
  getFromCache(key) {
    // Clean cache periodically (every 5 minutes) when accessed
    const now = Date.now();
    if (now - this.lastCacheClean > 300000) { // 5 minutes
      this.cleanCache();
      this.lastCacheClean = now;
    }
    
    const entry = this.cache.get(key);
    if (entry && (now - entry.timestamp) < this.cacheTTL) {
      return entry.data;
    }
    return null;
  }

  // Set cache entry
  setCache(key, data) {
    this.cache.set(key, {
      data: data,
      timestamp: Date.now()
    });
  }

  // Load all agents from various sources
  async loadAgents() {
    await this.loadLocalAgents();
    await this.loadRemoteAgents();
    core.info(`📋 Loaded ${this.agents.size} total agent(s)`);
    for (const agent of this.agents.values()) {
      core.debug(`Agent Data: ${JSON.stringify(agent, null, 2)}`);
    }
  }

  // Load agents from local .a5c/agents directory
  async loadLocalAgents() {
    const agentsDir = path.join('.a5c', 'agents');
    
    if (!fs.existsSync(agentsDir)) {
      core.debug(`Agents directory not found: ${agentsDir}`);
      return;
    }

    const agentFiles = this.findAgentFiles(agentsDir);
    
    if (agentFiles.length === 0) {
      core.debug(`No agent files found in ${agentsDir}`);
      return;
    }

    core.info(`📂 Found ${agentFiles.length} agent file(s) in ${agentsDir}`);

    for (const agentFile of agentFiles) {
      await this.loadAgent(agentFile);
    }
  }

  // Load agents from remote sources
  async loadRemoteAgents() {
    const remoteConfig = this.config.remote_agents;
    
    if (!remoteConfig || !remoteConfig.enabled) {
      core.debug('Remote agents not enabled, skipping loading remote agents');
      return;
    }

    core.info('🌐 Loading remote agents...');
    
    try {
      // Load individual agents
      if (remoteConfig.sources?.individual) {
        core.info(`📋 Loading ${remoteConfig.sources.individual.length} individual remote agent(s)`);
        for (const individualConfig of remoteConfig.sources.individual) {
          await this.loadIndividualAgent(individualConfig, remoteConfig);
        }
      }

      // Load repository agents
      if (remoteConfig.sources?.repositories) {
        core.info(`📋 Loading agents from ${remoteConfig.sources.repositories.length} remote repository(ies)`);
        for (const repositoryConfig of remoteConfig.sources.repositories) {
          await this.loadRepositoryAgents(repositoryConfig, remoteConfig);
        }
      }

      core.info(`🌐 Finished loading remote agents`);
    } catch (error) {
      core.warning(`Error loading remote agents: ${error.message}`);
    }
  }

  // Load a single agent from remote URI
  async loadIndividualAgent(agentConfig, remoteConfig) {
    try {
      const { uri, alias } = agentConfig;
      core.info(`📥 Loading individual agent from: ${uri}`);
      
      // Security: Validate URI format
      if (!uri || typeof uri !== 'string') {
        throw new Error('Invalid URI format');
      }
      
      // Security: Validate allowed URI schemes
      const allowedSchemes = ['https:', 'http:', 'file:', 'a5c:'];
      const hasValidScheme = allowedSchemes.some(scheme => uri.startsWith(scheme));
      if (!hasValidScheme) {
        throw new Error('Invalid URI scheme');
      }
      
      let content;
      
      // Handle a5c URIs with semantic versioning
      if (uri.startsWith('a5c://')) {
        const { loadA5CAgent } = require('./agent-loader');
        content = await loadA5CAgent(uri);
      } else {
        // Load agent content using resource handler
        content = await loadResource(uri, {
          cache_timeout: remoteConfig.cache_timeout || 60,
          retry_attempts: remoteConfig.retry_attempts || 3,
          retry_delay: remoteConfig.retry_delay || 1000
        });
      }

      // Validate content size
      if (content.length > 1024 * 1024) { // 1MB limit
        throw new Error('Agent content too large');
      }

      const agent = this.parseRemoteAgent(content, uri, alias);
      
      if (agent) {
        // Handle prompt content loading (similar to loadAgentConfigFromFile)
        if (agent.prompt_uri) {
          // Load prompt from URI using resource handler
          core.info(`📝 Loading prompt from URI: ${agent.prompt_uri}`);
          const { loadPromptFromUri } = require('./prompt');
          agent.prompt_content = await loadPromptFromUri(agent.prompt_uri, agent);
        } else {
          // Use the body content as prompt
          agent.prompt_content = agent.content ? agent.content.trim() : '';
        }
        
        this.agents.set(agent.id, agent);
        core.info(`✅ Loaded remote agent: ${agent.name} (${agent.id})`);
      }
    } catch (error) {
      core.warning(`Failed to load individual agent from ${agentConfig.uri}: ${error.message}`);
    }
  }

  // Load agents from a repository
  async loadRepositoryAgents(repositoryConfig, remoteConfig) {
    try {
      const { uri, pattern } = repositoryConfig;
      core.info(`📥 Loading agents from repository: ${uri}`);
      
      // Discover agent files in the repository
      const agentFiles = await this.discoverAgentsInRepository(uri, pattern, remoteConfig);
      
      if (agentFiles.length === 0) {
        core.warning(`No agent files found in repository: ${uri}`);
        return;
      }

      core.info(`📂 Found ${agentFiles.length} agent file(s) in repository`);

      // Load each discovered agent
      for (const agentFile of agentFiles) {
        await this.loadRepositoryAgent(agentFile, remoteConfig);
      }
    } catch (error) {
      core.warning(`Failed to load repository agents from ${repositoryConfig.uri}: ${error.message}`);
    }
  }

  // Load a single agent from repository
  async loadRepositoryAgent(agentFile, remoteConfig) {
    try {
      core.info(`📥 Loading repository agent: ${agentFile.path}`);
      
      // Load agent content using resource handler
      const content = await loadResource(agentFile.download_url, {
        cache_timeout: remoteConfig.cache_timeout || 60,
        retry_attempts: remoteConfig.retry_attempts || 3,
        retry_delay: remoteConfig.retry_delay || 1000
      });

      const agent = this.parseRemoteAgent(content, agentFile.download_url, agentFile.name);
      
      if (agent) {
        // Handle prompt content loading (similar to loadAgentConfigFromFile)
        if (agent.prompt_uri) {
          // Load prompt from URI using resource handler
          core.info(`📝 Loading prompt from URI: ${agent.prompt_uri}`);
          const { loadPromptFromUri } = require('./prompt');
          agent.prompt_content = await loadPromptFromUri(agent.prompt_uri, agent);
        } else {
          // Use the body content as prompt
          agent.prompt_content = agent.content ? agent.content.trim() : '';
        }
        
        this.agents.set(agent.id, agent);
        core.info(`✅ Loaded repository agent: ${agent.name} (${agent.id})`);
      }
    } catch (error) {
      core.warning(`Failed to load repository agent ${agentFile.path}: ${error.message}`);
    }
  }

  // Discover agent files in a repository
  async discoverAgentsInRepository(repoUri, pattern, remoteConfig) {
    try {
      // Parse repository URI to extract owner and repo
      const repoInfo = this.parseRepositoryUri(repoUri);
      
      if (!repoInfo) {
        throw new Error(`Invalid repository URI: ${repoUri}`);
      }

      // Use GitHub API to discover files
      if (repoInfo.platform === 'github') {
        return await this.discoverGitHubAgents(repoInfo, pattern, remoteConfig);
      } else {
        throw new Error(`Unsupported repository platform: ${repoInfo.platform}`);
      }
    } catch (error) {
      core.warning(`Error discovering agents in repository ${repoUri}: ${error.message}`);
      return [];
    }
  }

  // Discover agents in GitHub repository
  async discoverGitHubAgents(repoInfo, pattern, remoteConfig) {
    try {
      const { owner, repo, branch = 'main' } = repoInfo;
      
      // Rate limiting check
      const rateLimitKey = `github-api:${owner}/${repo}`;
      if (!this.rateLimiter.isAllowed(rateLimitKey)) {
        throw new Error('Rate limit exceeded for GitHub API calls');
      }
      
      // Check cache first
      const cacheKey = `repo-agents:${owner}/${repo}/${branch}`;
      const cachedResult = this.getFromCache(cacheKey);
      if (cachedResult) {
        core.debug(`Using cached repository agents for ${owner}/${repo}`);
        return cachedResult;
      }
      
      // Get GitHub token with scope validation
      const token = process.env.GITHUB_TOKEN || process.env.INPUT_GITHUB_TOKEN;
      if (!token) {
        throw new Error('GitHub token not available for repository access');
      }
      
      // Validate token format (basic validation)
      if (!token.startsWith('ghp_') && !token.startsWith('gho_') && !token.startsWith('ghu_') && !token.startsWith('ghs_')) {
        throw new Error('Invalid GitHub token format');
      }

      // Create GitHub API client
      const octokit = github.getOctokit(token);
      
      core.debug(`Getting reference for branch '${branch}' from ${owner}/${repo}`);
      
      // Get the SHA of the branch
      const { data: ref } = await octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${branch}`
      });
      
      const branchSha = ref.object.sha;
      core.debug(`Branch SHA: ${branchSha}`);
      
      // Get repository tree using the branch SHA
      const { data: tree } = await octokit.rest.git.getTree({
        owner,
        repo,
        tree_sha: branchSha,
        recursive: true
      });
      
      core.debug(`Retrieved ${tree.tree.length} total files from repository tree`);

      // Filter files based on pattern
      const agentFiles = tree.tree.filter(file => {
        const isBlob = file.type === 'blob';
        const isAgentFile = file.path.endsWith('.agent.md');
        const matchesPattern = this.matchesPattern(file.path, pattern);
        
        core.debug(`File: ${file.path}, isBlob: ${isBlob}, isAgentFile: ${isAgentFile}, matchesPattern: ${matchesPattern}`);
        
        return isBlob && isAgentFile && matchesPattern;
      });
      
      core.debug(`Found ${agentFiles.length} agent files after filtering`);

      // Convert to our format
      const result = agentFiles.map(file => ({
        path: file.path,
        name: path.basename(file.path, '.agent.md'),
        download_url: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${file.path}`,
        sha: file.sha
      }));
      
      // Cache the result
      this.setCache(cacheKey, result);
      
      return result;
    } catch (error) {
      if (error.status === 404) {
        if (error.message && error.message.includes('ref')) {
          throw new Error(`Branch '${branch}' not found in repository: ${repoInfo.owner}/${repoInfo.repo}`);
        } else {
          throw new Error(`Repository not found or not accessible: ${repoInfo.owner}/${repoInfo.repo}`);
        }
      } else if (error.status === 403) {
        throw new Error(`Access denied to repository: ${repoInfo.owner}/${repoInfo.repo}. Check token permissions.`);
      }
      throw error;
    }
  }

  // Parse repository URI to extract components
  parseRepositoryUri(uri) {
    try {
      // GitHub repository patterns
      const githubPatterns = [
        /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)(?:\/tree\/([^\/]+))?/,
        /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)\.git/,
        /^git@github\.com:([^\/]+)\/([^\/]+)\.git/
      ];

      for (const pattern of githubPatterns) {
        const match = uri.match(pattern);
        if (match) {
          return {
            platform: 'github',
            owner: match[1],
            repo: match[2].replace(/\.git$/, ''),
            branch: match[3] || 'main'
          };
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  // Check if file path matches glob pattern
  matchesPattern(filePath, pattern) {
    if (!pattern) return true;
    
    // Convert glob pattern to regex
    // First replace ** with a placeholder to avoid conflicts
    const regexPattern = pattern
      .replace(/\*\*/g, '__DOUBLE_STAR__')
      .replace(/\*/g, '[^/]*')
      .replace(/__DOUBLE_STAR__/g, '.*')
      .replace(/\?/g, '.');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  }

  // Parse remote agent configuration
  parseRemoteAgent(content, uri, alias) {
    try {
      const parsed = parseFrontmatter(content);
      
      // Use alias if provided, otherwise extract from URI
      const agentId = alias || this.extractAgentIdFromUri(uri);
      
      const agent = {
        id: agentId,
        path: uri,
        name: parsed.attributes.name || alias || agentId,
        category: parsed.attributes.category || 'general',
        description: parsed.attributes.description || null,
        usage_context: parsed.attributes.usage_context || null,
        invocation_context: parsed.attributes.invocation_context || null,
        events: this.parseListField(parsed.attributes.events),
        mentions: this.parseListField(parsed.attributes.mentions),
        labels: this.parseListField(parsed.attributes.labels),
        branches: this.parseListField(parsed.attributes.branches),
        paths: this.parseListField(parsed.attributes.paths),
        schedule: parsed.attributes.activation_cron || null,
        priority: parseInt(parsed.attributes.priority) || 0,
        mcp_servers: this.parseListField(parsed.attributes.mcp_servers),
        cli_command: parsed.attributes.cli_command || null,
        cli_agent: parsed.attributes.cli_agent || null,
        agent_discovery: parsed.attributes.agent_discovery || null,
        prompt_uri: parsed.attributes.prompt_uri || parsed.attributes['prompt-uri'] || null,
        user_whitelist: this.parseListField(parsed.attributes.user_whitelist),
        // Add missing execution configuration fields
        model: parsed.attributes.model || null,
        max_turns: parsed.attributes.max_turns || null,
        timeout: parsed.attributes.timeout || null,
        verbose: parsed.attributes.verbose || null,
        envs: parsed.attributes.envs || null,
        inject_prompt_to_stdin: parsed.attributes.inject_prompt_to_stdin || null,
        inject_envs_to_prompt: parsed.attributes.inject_envs_to_prompt || null,
        source: 'remote',
        remote_uri: uri,
        content: parsed.body
      };

      // Validate schedule if provided
      if (agent.schedule && !validateCronExpression(agent.schedule)) {
        core.warning(`Invalid cron expression for remote agent ${agent.id}: ${agent.schedule}`);
        agent.schedule = null;
      }

      return agent;
    } catch (error) {
      core.warning(`Error parsing remote agent from ${uri}: ${error.message}`);
      return null;
    }
  }

  // Extract agent ID from URI
  extractAgentIdFromUri(uri) {
    try {
      const url = new URL(uri);
      const filename = path.basename(url.pathname);
      return filename.replace(/\.agent\.md$/, '');
    } catch (error) {
      // Fallback to simple path extraction
      const filename = path.basename(uri);
      return filename.replace(/\.agent\.md$/, '');
    }
  }

  // Get all available agents for discovery (both local and remote)
  getAllAgents() {
    return Array.from(this.agents.values());
  }

  // Get agent discovery context for a specific agent
  generateAgentDiscoveryContext(currentAgent) {
    const agentConfig = currentAgent.agent_discovery || {};
    
    if (!agentConfig.enabled) {
      core.debug(`Agent discovery disabled for agent: ${currentAgent.id}`);
      return [];
    }

    core.info(`🔍 Generating agent discovery context for: ${currentAgent.name}`);
    
    const agentContext = [];
    const maxAgents = agentConfig.max_agents_in_context || 10;
    const allAgents = this.getAllAgents();
    
    try {
      // Get agents from same directory/category
      if (agentConfig.include_same_directory) {
        const sameDirectoryAgents = allAgents.filter(agent => {
          // Skip self
          if (agent.id === currentAgent.id) return false;
          
          // Include agents from same category or source
          return agent.category === currentAgent.category || 
                 agent.source === currentAgent.source;
        });
        
        core.info(`   Found ${sameDirectoryAgents.length} agents from same directory/category`);
        
        for (const agent of sameDirectoryAgents.slice(0, maxAgents)) {
          agentContext.push(this.createAgentDiscoveryInfo(agent));
        }
      }
      
      // Get explicitly included external agents
      if (agentConfig.include_external_agents && Array.isArray(agentConfig.include_external_agents)) {
        core.info(`   Looking for ${agentConfig.include_external_agents.length} explicitly included agents`);
        
        for (const agentId of agentConfig.include_external_agents) {
          const agent = this.agents.get(agentId);
          if (agent && agent.id !== currentAgent.id) {
            agentContext.push(this.createAgentDiscoveryInfo(agent));
            core.info(`   Added external agent: ${agent.name}`);
          } else {
            core.warning(`   External agent not found: ${agentId}`);
          }
        }
      }
      
      // Remove duplicates based on agent ID
      const uniqueAgents = agentContext.filter((agent, index, self) => 
        index === self.findIndex(a => a.id === agent.id)
      );
      
      core.info(`   Final agent discovery context: ${uniqueAgents.length} agents`);
      
      return uniqueAgents.slice(0, maxAgents);
    } catch (error) {
      core.warning(`Error generating agent discovery context: ${error.message}`);
      return [];
    }
  }

  // Create agent discovery info object
  createAgentDiscoveryInfo(agent) {
    return {
      id: agent.id,
      name: agent.name,
      category: agent.category,
      source: agent.source,
      mentions: agent.mentions,
      description: agent.description || `${agent.name} - ${agent.category} agent`,
      usage_context: agent.usage_context || `Use ${agent.name} for ${agent.category} tasks`,
      invocation_context: agent.invocation_context || `Invoke with ${agent.mentions.join(', ')}`,
      events: agent.events,
      labels: agent.labels,
      paths: agent.paths
    };
  }

  // Recursively find all .agent.md files
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
      core.warning(`Error reading directory ${dir}: ${error.message}`);
    }
    
    return agentFiles;
  }

  // Load a single agent
  async loadAgent(agentPath) {
    try {
      const content = await loadResource(agentPath);
      const agent = this.parseAgent(content, agentPath);
      
      if (agent) {
        // Handle prompt content loading (similar to remote agents)
        if (agent.prompt_uri) {
          // Load prompt from URI using resource handler
          core.info(`📝 Loading prompt from URI: ${agent.prompt_uri}`);
          const { loadPromptFromUri } = require('./prompt');
          agent.prompt_content = await loadPromptFromUri(agent.prompt_uri, agent);
        } else {
          // Use the body content as prompt
          agent.prompt_content = agent.content ? agent.content.trim() : '';
        }
        
        this.agents.set(agent.id, agent);
        const relativePath = path.relative(path.join(process.cwd(), '.a5c', 'agents'), agentPath);
        core.info(`✅ Loaded agent: ${agent.name} (${relativePath})`);
      }
    } catch (error) {
      core.warning(`Failed to load agent ${agentPath}: ${error.message}`);
    }
  }

  // Parse agent configuration
  parseAgent(content, filePath) {
    try {
      const parsed = parseFrontmatter(content);
      const agentId = path.basename(filePath, '.agent.md');
      const agent = {
        id: agentId,
        path: filePath,
        name: parsed.attributes.name || agentId,
        category: parsed.attributes.category || 'general',
        description: parsed.attributes.description || null,
        usage_context: parsed.attributes.usage_context || null,
        invocation_context: parsed.attributes.invocation_context || null,
        events: this.parseListField(parsed.attributes.events),
        mentions: this.parseListField(parsed.attributes.mentions),
        labels: this.parseListField(parsed.attributes.labels),
        branches: this.parseListField(parsed.attributes.branches),
        paths: this.parseListField(parsed.attributes.paths),
        schedule: parsed.attributes.activation_cron || null,
        priority: parseInt(parsed.attributes.priority) || 0,
        mcp_servers: this.parseListField(parsed.attributes.mcp_servers),
        cli_command: parsed.attributes.cli_command || null,
        agent_discovery: parsed.attributes.agent_discovery || null,
        prompt_uri: parsed.attributes.prompt_uri || parsed.attributes['prompt-uri'] || null,
        user_whitelist: this.parseListField(parsed.attributes.user_whitelist),
        source: 'local',
        content: parsed.body
      };

      // Validate schedule if provided
      if (agent.schedule && !validateCronExpression(agent.schedule)) {
        core.warning(`Invalid cron expression for agent ${agent.id}: ${agent.schedule}`);
        agent.schedule = null;
      }

      return agent;
    } catch (error) {
      core.warning(`Error parsing agent ${filePath}: ${error.message}`);
      return null;
    }
  }

  // Parse comma-separated list field
  parseListField(field) {
    if (!field) return [];
    if (Array.isArray(field)) return field;
    // might be "["", "", ""]"
    if (field.startsWith('[') && field.endsWith(']')) {
      return field.slice(1, -1).split(',').map(item => item.trim().replace(/^['"]|['"]$/g, ''));
    }
    return field.split(',').map(item => item.trim().replace(/^['"]|['"]$/g, ''));
  }

  // Get agents triggered by current event
  async getTriggeredAgents() {
    const triggeredAgents = [];
    const eventName = github.context.eventName;
    const context = github.context;
    
    core.info(`🔍 Checking triggers for event: ${eventName}`);
    
    // Check all trigger types for each agent
    for (const [agentId, agent] of this.agents) {
      const triggers = await this.checkAllTriggers(agent, context);
      
      if (triggers.length > 0) {
        // Combine all trigger reasons into a single description
        const triggerReasons = triggers.map(t => t.reason).join(', ');
        const triggerTypes = triggers.map(t => t.type);
        const triggerData = triggers.reduce((acc, t) => ({ ...acc, ...t.data }), {});
        
        // Add agent only once, even if it matches multiple triggers
        triggeredAgents.push({
          ...agent,
          triggeredBy: triggerReasons,
          triggerType: triggerTypes, // Array of trigger types
          triggerData: triggerData,
          mentionOrder: null
        });
        
        // Log the individual agent found
        core.info(`   📋 Agent found: ${agent.name} (${agent.id}) - Triggered by: ${triggerReasons}`);
      }
    }
    
    // Sort by priority (higher priority first)
    triggeredAgents.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    core.info(`🎯 Found ${triggeredAgents.length} triggered agent(s)`);
    
    return triggeredAgents;
  }

  // Check all trigger types for an agent
  async checkAllTriggers(agent, context) {
    const triggers = [];
    
    // Event-based triggers
    if (agent.events.length > 0 && !agent.events.includes(context.eventName)) {
      core.debug(`🔍 Skipping agent: ${agent.name} (${agent.id}) because it doesn't support this event: ${context.eventName}. only supports: ${agent.events}`);
      return triggers;
    }

    // Schedule-based triggers
    const scheduleTriggers = this.checkScheduleTriggers(agent, context);
    triggers.push(...scheduleTriggers);
    
    // if this is a mention based agent, we need to check skip this entire check
    if (agent.mentions.length > 0) {
      core.debug(`🔍 Skipping agent: ${agent.name} (${agent.id}) because it's a mention based agent. mentions: ${agent.mentions}`);
      return triggers;
    }
    
    // Label-based triggers
    const labelTriggers = this.checkLabelTriggers(agent, context);
    triggers.push(...labelTriggers);
    
    // Branch-based triggers
    const branchTriggers = this.checkBranchTriggers(agent, context);
    triggers.push(...branchTriggers);
    
    // File path-based triggers
    const pathTriggers = await this.checkPathTriggers(agent, context);
    triggers.push(...pathTriggers);
   
    
    return triggers;
  }

  // Check label-based triggers
  checkLabelTriggers(agent, context) {
    const triggers = [];
    
    if (agent.labels.length === 0) return triggers;
    
    const { payload } = context;
    let eventLabels = [];
    
    // Extract labels based on event type
    if (payload.pull_request?.labels) {
      eventLabels = payload.pull_request.labels.map(label => label.name);
    } else if (payload.issue?.labels) {
      eventLabels = payload.issue.labels.map(label => label.name);
    } else if (payload.label?.name) {
      // Label added/removed events
      eventLabels = [payload.label.name];
    }
    
    // Check if any agent labels match event labels
    for (const agentLabel of agent.labels) {
      if (eventLabels.includes(agentLabel)) {
        triggers.push({
          type: 'label',
          reason: `Label: ${agentLabel}`,
          data: { 
            matchedLabel: agentLabel,
            eventLabels: eventLabels,
            eventType: context.eventName
          }
        });
      }
    }
    
    return triggers;
  }

  // Check branch-based triggers
  checkBranchTriggers(agent, context) {
    const triggers = [];
    
    if (agent.branches.length === 0) return triggers;
    
    const currentBranch = this.extractBranch(context);
    
    if (!currentBranch) return triggers;
    
    // Check if current branch matches any agent branch patterns
    for (const branchPattern of agent.branches) {
      if (this.matchesBranchPattern(currentBranch, branchPattern)) {
        triggers.push({
          type: 'branch',
          reason: `Branch: ${branchPattern}`,
          data: {
            currentBranch: currentBranch,
            matchedPattern: branchPattern,
            eventType: context.eventName
          }
        });
      }
    }
    
    return triggers;
  }

  // Check file path-based triggers
  async checkPathTriggers(agent, context) {
    const triggers = [];
    
    if (agent.paths.length === 0) return triggers;
    
    const changedFiles = await this.getChangedFiles(context);
    
    if (changedFiles.length === 0) return triggers;
    
    // Check if any changed files match agent path patterns
    for (const pathPattern of agent.paths) {
      const matchedFiles = this.getMatchingFiles(changedFiles, pathPattern);
      
      if (matchedFiles.length > 0) {
        triggers.push({
          type: 'path',
          reason: `Path: ${pathPattern}`,
          data: {
            pathPattern: pathPattern,
            matchedFiles: matchedFiles,
            totalChangedFiles: changedFiles.length,
            eventType: context.eventName
          }
        });
      }
    }
    
    return triggers;
  }

  // Check schedule-based triggers
  checkScheduleTriggers(agent, context) {
    const triggers = [];
    
    if (!agent.schedule) return triggers;
    
    // Only check schedule for schedule events
    if (context.eventName !== 'schedule') return triggers;
    
    if (this.isScheduledNow(agent.schedule, context)) {
      triggers.push({
        type: 'schedule',
        reason: `Schedule: ${agent.schedule}`,
        data: {
          cronExpression: agent.schedule,
          currentTime: new Date().toISOString()
        }
      });
    }
    
    return triggers;
  }

  // Get agents triggered by mentions (with event filtering)
  getAgentsByMention(mentionableContent, currentEvent) {
    const mentionedAgents = [];
    
    core.info(`🔍 Checking for agent mentions in content for event: ${currentEvent}`);
    
    for (const [agentId, agent] of this.agents) {

      // For other events, check if agent can respond to this event (events field acts as filter)
      if (agent.events.length > 0 && !agent.events.includes(currentEvent)) {
        core.debug(`🔍 Skipping agent: ${agent.name} (${agent.id}) because it doesn't support this event: ${currentEvent}. only supports: ${agent.events}`);
        continue; // Skip this agent if it doesn't support this event
      }

      // For workflow_run events, bypass the mention checking and include the agents that support workflow_run (first mention tag)
      if (currentEvent === 'workflow_run') {
        core.debug(`🔍 Checking for workflow_run event for agent: ${agent.name} (${agent.id}) with agent events: ${agent.events}`);
        mentionedAgents.push({
          ...agent,
          triggeredBy: 'workflow_run',
          triggerType: 'mention',
          mentionOrder: 0,
          mentions: [ agent.mentions[0] || 'workflow_run' ]
        });
        continue;
      }

      
      const matchedMentions = [];
      let earliestMentionOrder = Number.MAX_SAFE_INTEGER;
      
      // Check all mention patterns for this agent
      for (const mention of agent.mentions) {
        if (mentionableContent.includes(mention)) {
          const mentionOrder = this.getMentionOrder(mentionableContent, mention);
          matchedMentions.push(mention);
          earliestMentionOrder = Math.min(earliestMentionOrder, mentionOrder);
        }
      }
      
      // If any mentions matched, add the agent only once
      if (matchedMentions.length > 0) {
        const triggerReasons = matchedMentions.map(m => `Mention: ${m}`).join(', ');
        
        mentionedAgents.push({
          ...agent,
          triggeredBy: triggerReasons,
          triggerType: 'mention',
          mentionOrder: earliestMentionOrder,
          mentions: matchedMentions
        });
        
        // Log the individual agent found
        core.info(`   📋 Agent found: ${agent.name} (${agent.id}) - Triggered by: ${triggerReasons}`);
      }
    }
    
    // Sort by mention order (earlier mentions first)
    mentionedAgents.sort((a, b) => a.mentionOrder - b.mentionOrder);
    
    core.info(`🎯 Found ${mentionedAgents.length} mentioned agent(s)`);
    
    return mentionedAgents;
  }

  // Get mention order in comment
  getMentionOrder(text, mention) {
    const index = text.indexOf(mention);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  }

  // Extract branch name from context
  extractBranch(context) {
    const { payload, ref } = context;
    
    // Try different sources for branch name
    if (payload.pull_request?.head?.ref) {
      return payload.pull_request.head.ref;
    }
    
    if (payload.pull_request?.base?.ref) {
      return payload.pull_request.base.ref;
    }
    
    if (ref && ref.startsWith('refs/heads/')) {
      return ref.replace('refs/heads/', '');
    }
    
    return null;
  }

  // Check if branch matches pattern (supports prefix matching and wildcards)
  matchesBranchPattern(branch, pattern) {
    // Exact match
    if (branch === pattern) return true;
    
    // Prefix match (pattern ends with *)
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return branch.startsWith(prefix);
    }
    
    // Suffix match (pattern starts with *)
    if (pattern.startsWith('*')) {
      const suffix = pattern.slice(1);
      return branch.endsWith(suffix);
    }
    
    // Contains match (pattern has * in middle)
    if (pattern.includes('*')) {
      const parts = pattern.split('*');
      let currentIndex = 0;
      
      for (const part of parts) {
        if (part === '') continue;
        const foundIndex = branch.indexOf(part, currentIndex);
        if (foundIndex === -1) return false;
        currentIndex = foundIndex + part.length;
      }
      
      return true;
    }
    
    return false;
  }

  // Get changed files from context
  async getChangedFiles(context) {
    const { payload } = context;
    const files = [];
    
    // Pull request files - need to fetch from GitHub API
    if (payload.pull_request && payload.pull_request.changed_files > 0) {
      try {
        const prFiles = await this.getPullRequestFiles(payload.pull_request);
        files.push(...prFiles);
      } catch (error) {
        core.warning(`Failed to get PR files: ${error.message}`);
        // Fallback to commits if available
        if (payload.commits) {
          for (const commit of payload.commits) {
            if (commit.added) files.push(...commit.added);
            if (commit.modified) files.push(...commit.modified);
            if (commit.removed) files.push(...commit.removed);
          }
        }
      }
    }
    
    // Push event files - check if this is a PR merge
    if (payload.commits && context.eventName === 'push') {
      // Check if this is a PR merge by looking at commit messages
      const mergeCommit = payload.commits.find(commit => 
        commit.message && commit.message.includes('Merge pull request #')
      );
      
      if (mergeCommit) {
        // This is a PR merge, try to get files from the merged PR
        try {
          const prNumber = this.extractPRNumberFromMergeCommit(mergeCommit.message);
          if (prNumber) {
            const prFiles = await this.getPullRequestFilesByNumber(prNumber, payload.repository);
            files.push(...prFiles);
          }
        } catch (error) {
          core.warning(`Failed to get merged PR files: ${error.message}`);
        }
      }
      
      // Always include files from commits as fallback
      for (const commit of payload.commits) {
        if (commit.added) files.push(...commit.added);
        if (commit.modified) files.push(...commit.modified);
        if (commit.removed) files.push(...commit.removed);
      }
    }
    
    // Remove duplicates
    const uniqueFiles = [...new Set(files)];
    core.info(`📁 Found ${uniqueFiles.length} changed files`);
    return uniqueFiles;
  }

  // Get files matching a path pattern
  getMatchingFiles(files, pattern) {
    return files.filter(file => this.matchesPathPattern(file, pattern));
  }

  // Get files from a pull request using GitHub API
  async getPullRequestFiles(pullRequest) {
    try {
      // Token priority: GITHUB_TOKEN (GitHub Actions default) takes precedence over INPUT_GITHUB_TOKEN (user-provided)
      // This ensures we use the most appropriate token for the current execution context
      const token = process.env.GITHUB_TOKEN || process.env.INPUT_GITHUB_TOKEN;
      if (!token) {
        throw new Error('GitHub token not available');
      }
      
      // Validate token format (basic validation)
      if (!token.startsWith('ghp_') && !token.startsWith('gho_') && !token.startsWith('ghu_') && !token.startsWith('ghs_')) {
        core.warning('GitHub token format validation failed - proceeding with caution');
      }

      const octokit = github.getOctokit(token);
      
      // Check cache first to avoid repeated API calls
      const cacheKey = `pr-files-${pullRequest.number}`;
      if (this.prFileCache && this.prFileCache[cacheKey]) {
        core.debug(`Using cached PR files for PR #${pullRequest.number}`);
        return this.prFileCache[cacheKey];
      }

      const { data: files } = await octokit.rest.pulls.listFiles({
        owner: pullRequest.base.repo.owner.login,
        repo: pullRequest.base.repo.name,
        pull_number: pullRequest.number
      });

      const fileNames = files.map(file => file.filename);
      
      // Cache the result for 5 minutes to avoid repeated API calls
      this.prFileCache = this.prFileCache || {};
      this.prFileCache[cacheKey] = fileNames;
      setTimeout(() => {
        if (this.prFileCache && this.prFileCache[cacheKey]) {
          delete this.prFileCache[cacheKey];
        }
      }, 5 * 60 * 1000); // 5 minutes

      // Track successful API call
      this.trackAPIUsage('pulls.listFiles', true);

      return fileNames;
    } catch (error) {
      // Track failed API call
      this.trackAPIUsage('pulls.listFiles', false, error);
      
      // Handle rate limiting gracefully
      if (error.status === 403 && error.message.includes('rate limit')) {
        core.warning(`GitHub API rate limit exceeded when fetching PR files: ${error.message}`);
        core.info('Rate limit will reset shortly. Using fallback file detection.');
      } else {
        core.warning(`Error fetching PR files: ${error.message}`);
      }
      return [];
    }
  }

  // Get files from a pull request by PR number
  async getPullRequestFilesByNumber(prNumber, repository) {
    try {
      // Token priority: GITHUB_TOKEN (GitHub Actions default) takes precedence over INPUT_GITHUB_TOKEN (user-provided)
      // This ensures we use the most appropriate token for the current execution context
      const token = process.env.GITHUB_TOKEN || process.env.INPUT_GITHUB_TOKEN;
      if (!token) {
        throw new Error('GitHub token not available');
      }
      
      // Validate token format (basic validation)
      if (!token.startsWith('ghp_') && !token.startsWith('gho_') && !token.startsWith('ghu_') && !token.startsWith('ghs_')) {
        core.warning('GitHub token format validation failed - proceeding with caution');
      }

      const octokit = github.getOctokit(token);
      
      // Check cache first to avoid repeated API calls
      const cacheKey = `pr-files-${repository.owner.login}/${repository.name}/${prNumber}`;
      if (this.prFileCache && this.prFileCache[cacheKey]) {
        core.debug(`Using cached PR files for PR #${prNumber}`);
        return this.prFileCache[cacheKey];
      }

      const { data: files } = await octokit.rest.pulls.listFiles({
        owner: repository.owner.login,
        repo: repository.name,
        pull_number: prNumber
      });

      const fileNames = files.map(file => file.filename);
      
      // Cache the result for 5 minutes to avoid repeated API calls
      this.prFileCache = this.prFileCache || {};
      this.prFileCache[cacheKey] = fileNames;
      setTimeout(() => {
        if (this.prFileCache && this.prFileCache[cacheKey]) {
          delete this.prFileCache[cacheKey];
        }
      }, 5 * 60 * 1000); // 5 minutes

      // Track successful API call
      this.trackAPIUsage('pulls.listFiles', true);

      return fileNames;
    } catch (error) {
      // Track failed API call
      this.trackAPIUsage('pulls.listFiles', false, error);
      
      // Handle rate limiting gracefully
      if (error.status === 403 && error.message.includes('rate limit')) {
        core.warning(`GitHub API rate limit exceeded when fetching PR files for PR #${prNumber}: ${error.message}`);
        core.info('Rate limit will reset shortly. Using fallback file detection.');
      } else {
        core.warning(`Error fetching PR files for PR #${prNumber}: ${error.message}`);
      }
      return [];
    }
  }

  // Extract PR number from merge commit message
  extractPRNumberFromMergeCommit(message) {
    // Support various merge message formats:
    // - "Merge pull request #123"
    // - "Merge pull request #123 from branch"
    // - "Merged pull request #123"
    // - "Merge PR #123"
    // - "Squash and merge pull request #123"
    const patterns = [
      /Merge pull request #(\d+)/i,
      /Merged pull request #(\d+)/i,
      /Merge PR #(\d+)/i,
      /Squash and merge pull request #(\d+)/i,
      /Rebase and merge pull request #(\d+)/i,
      /#(\d+)\s+from\s+/i // "#123 from branch-name" format
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        return parseInt(match[1], 10);
      }
    }
    
    return null;
  }

  // Check if file path matches pattern (supports glob-like patterns)
  matchesPathPattern(filePath, pattern) {
    // Exact match
    if (filePath === pattern) return true;
    
    // Directory prefix match (pattern ends with /**)
    if (pattern.endsWith('/**')) {
      const prefix = pattern.slice(0, -3);
      return filePath.startsWith(prefix + '/');
    }
    
    // File extension match (pattern starts with *.)
    if (pattern.startsWith('*.')) {
      const extension = pattern.slice(1);
      return filePath.endsWith(extension);
    }
    
    // Wildcard matching
    if (pattern.includes('*')) {
      const regexPattern = pattern
        .replace(/\*\*/g, '.*')  // ** matches any path
        .replace(/\*/g, '[^/]*')  // * matches any filename character except /
        .replace(/\?/g, '[^/]');  // ? matches any single character except /
      
      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(filePath);
    }
    
    // Prefix match for directories
    if (pattern.endsWith('/')) {
      return filePath.startsWith(pattern);
    }
    
    return false;
  }

  // Check if agent should be triggered by schedule
  isScheduledNow(cronExpression, context) {
    try {
      if (!validateCronExpression(cronExpression)) {
        return false;
      }
      
      // Compare trigger cron from event with agent cron for intersection
      const triggerExpression = context && context.payload ? context.payload.schedule : null;
      if (!triggerExpression || !validateCronExpression(triggerExpression)) {
        return false;
      }

      // Return true only if the trigger cron matches the agent cron exactly
      return triggerExpression.trim() === cronExpression.trim();
    } catch (error) {
      core.warning(`Error checking schedule for ${cronExpression}: ${error.message}`);
      return false;
    }
  }

  // Check if value matches cron field
  matchesCronField(value, field, min, max) {
    if (field === '*') return true;
    
    // Handle lists (e.g., "1,3,5" or mixed like "1,5-10/2,20")
    if (field.includes(',')) {
      const parts = field.split(',');
      return parts.some(part => this.matchesCronField(value, part, min, max));
    }
    
    // Handle step values (e.g., "*/5", "1-10/2", or "5/10")
    if (field.includes('/')) {
      const [left, stepStr] = field.split('/');
      const step = Number(stepStr);
      if (isNaN(step) || step <= 0) return false;
      
      if (left === '*') {
        // Start from the field's minimum for wildcard steps
        return ((value - min) % step) === 0;
      }
      
      if (left.includes('-')) {
        const [startStr, endStr] = left.split('-');
        const start = Number(startStr);
        const end = Number(endStr);
        if (isNaN(start) || isNaN(end)) return false;
        if (value < start || value > end) return false;
        return ((value - start) % step) === 0;
      }
      
      // Explicit start with implicit end to max
      const start = Number(left);
      if (isNaN(start)) return false;
      if (value < start || value > max) return false;
      return ((value - start) % step) === 0;
    }
    
    // Handle ranges (e.g., "1-5")
    if (field.includes('-')) {
      const [start, end] = field.split('-').map(Number);
      if (isNaN(start) || isNaN(end)) return false;
      return value >= start && value <= end;
    }
    
    // Exact match
    const exact = Number(field);
    if (isNaN(exact)) return false;
    return value === exact;
  }

  // Determine whether two cron fields have any overlapping values
  intersectCronFields(fieldA, fieldB, min, max) {
    const setA = this.expandCronField(fieldA, min, max);
    const setB = this.expandCronField(fieldB, min, max);
    for (const v of setA) {
      if (setB.has(v)) return true;
    }
    return false;
  }

  // Expand a single cron field into its set of allowed numeric values
  expandCronField(field, min, max) {
    const result = new Set();
    if (field === '*') {
      for (let v = min; v <= max; v++) result.add(v);
      return result;
    }
    // Lists
    if (field.includes(',')) {
      for (const part of field.split(',')) {
        for (const v of this.expandCronField(part, min, max)) result.add(v);
      }
      return result;
    }
    // Steps
    if (field.includes('/')) {
      const [left, stepStr] = field.split('/');
      const step = Number(stepStr);
      if (!isNaN(step) && step > 0) {
        if (left === '*') {
          for (let v = min; v <= max; v += step) result.add(v);
          return result;
        }
        if (left.includes('-')) {
          const [startStr, endStr] = left.split('-');
          const start = Number(startStr);
          const end = Number(endStr);
          if (!isNaN(start) && !isNaN(end)) {
            for (let v = start; v <= end; v += step) {
              if (v >= min && v <= max) result.add(v);
            }
          }
          return result;
        }
        const start = Number(left);
        if (!isNaN(start)) {
          for (let v = start; v <= max; v += step) {
            if (v >= min) result.add(v);
          }
        }
      }
      return result;
    }
    // Range
    if (field.includes('-')) {
      const [startStr, endStr] = field.split('-');
      const start = Number(startStr);
      const end = Number(endStr);
      if (!isNaN(start) && !isNaN(end)) {
        for (let v = start; v <= end; v++) {
          if (v >= min && v <= max) result.add(v);
        }
      }
      return result;
    }
    // Exact
    const exact = Number(field);
    if (!isNaN(exact) && exact >= min && exact <= max) result.add(exact);
    return result;
  }

  // Track API usage metrics for monitoring and debugging
  trackAPIUsage(endpoint, success, error = null) {
    this.apiMetrics = this.apiMetrics || {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      rateLimitErrors: 0,
      endpoints: {}
    };

    this.apiMetrics.totalCalls++;
    
    if (success) {
      this.apiMetrics.successfulCalls++;
    } else {
      this.apiMetrics.failedCalls++;
      if (error && error.status === 403 && error.message.includes('rate limit')) {
        this.apiMetrics.rateLimitErrors++;
      }
    }

    // Track per-endpoint metrics
    if (!this.apiMetrics.endpoints[endpoint]) {
      this.apiMetrics.endpoints[endpoint] = { calls: 0, success: 0, failed: 0 };
    }
    
    this.apiMetrics.endpoints[endpoint].calls++;
    if (success) {
      this.apiMetrics.endpoints[endpoint].success++;
    } else {
      this.apiMetrics.endpoints[endpoint].failed++;
    }

    // Log metrics periodically (every 10 API calls)
    if (this.apiMetrics.totalCalls % 10 === 0) {
      core.info(`📊 API Usage: ${this.apiMetrics.successfulCalls}/${this.apiMetrics.totalCalls} successful, ${this.apiMetrics.rateLimitErrors} rate limit errors`);
    }
  }
}

module.exports = AgentRouter; 