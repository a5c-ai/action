const fs = require('fs');
const path = require('path');
const core = require('@actions/core');
const github = require('@actions/github');
const Handlebars = require('handlebars');
const { processFiles } = require('./file-processor');
const { loadResource } = require('./resource-handler');
const { initializeTemplateHelpers } = require('./template-handler');

// Prepare prompt and context
async function preparePrompt(config, availableAgents = [], mentions = [], globalConfig = {}) {
  // Build context for template rendering
  const templateContext = {
    repository: {
      fullName: github.context.repo.owner + '/' + github.context.repo.repo,
      owner: github.context.repo.owner,
      name: github.context.repo.repo,
      branch: github.context.ref.replace('refs/heads/', ''),
      sha: github.context.sha
    },
    event: {
      eventName: github.context.eventName,
      context_json: JSON.stringify(github.context, null, 2),
      ...github.context.payload,      
    },
    
    agent: {
      name: config.name,
      category: config.category,
      triggeredBy: config.triggeredBy || 'Event trigger'
    },
    timestamp: new Date().toISOString(),
    mentions: mentions,
    availableAgents: availableAgents,
    changedFiles: getProcessedChangedFiles(globalConfig),
    // Expose configuration variables
    config: config,           // Current agent configuration
    globalConfig: globalConfig, // Global configuration
    defaults: globalConfig.defaults || {} // Default values
  };
  
  // Load prompt template with proper priority
  let mainTemplate = '';
  
  // Check if a custom prompt template is explicitly configured
  if (config.templates?.main_prompt) {
    const customPromptPath = config.templates.main_prompt;
    try {
      if (fs.existsSync(customPromptPath)) {
        mainTemplate = fs.readFileSync(customPromptPath, 'utf8');
        core.info(`📝 Using custom prompt template: ${customPromptPath}`);
      } else {
        core.warning(`Custom prompt template not found: ${customPromptPath}`);
        throw new Error(`Custom prompt template not found: ${customPromptPath}`);
      }
    } catch (error) {
      core.warning(`Could not load custom prompt template: ${error.message}`);
      // Fall back to built-in default
      mainTemplate = loadBuiltInDefaultPrompt();
    }
  } else {
    // No custom prompt specified, use built-in default
    mainTemplate = loadBuiltInDefaultPrompt();
  }
  
  // If we still don't have a template, use agent-specific content only
  if (!mainTemplate) {
    return {
      prompt: config.prompt_content || '',
      context: templateContext,
      config
    };
  }
  
  // Initialize template helpers for inclusion support
  initializeTemplateHelpers(Handlebars);
  
  // Compile and render the main template
  const compiledTemplate = Handlebars.compile(mainTemplate);
  
  // Add base URI to context for resolving relative includes
  if (config.templates?.main_prompt) {
    templateContext._baseUri = config.templates.main_prompt;
  } else {
    templateContext._baseUri = path.join(__dirname, '..', 'default-prompt.md');
  }
  
  const renderedMainPrompt = compiledTemplate(templateContext);
  
  // Add agent-specific content
  const finalPrompt = renderedMainPrompt + '\n\n---\n\n' + (config.prompt_content || '');
  
  return {
    prompt: finalPrompt,
    context: templateContext,
    config
  };
}

// Load built-in default prompt template
function loadBuiltInDefaultPrompt() {
  try {
    const defaultPromptPath = path.join(__dirname, '..', 'default-prompt.md');
    const template = fs.readFileSync(defaultPromptPath, 'utf8');
    core.info('📝 Using built-in default prompt template');
    return template;
  } catch (error) {
    core.warning(`Could not load default prompt template: ${error.message}`);
    return '';
  }
}

// Helper function to get changed files from GitHub context with file processing
function getProcessedChangedFiles(globalConfig) {
  const rawChangedFiles = getChangedFilesFromContext();
  
  // Apply file processing rules
  const processedFiles = processFiles(rawChangedFiles, globalConfig);
  
  core.info(`📂 Changed files: ${rawChangedFiles.length} raw -> ${processedFiles.length} processed`);
  
  return processedFiles;
}

// Helper function to get changed files from GitHub context
function getChangedFilesFromContext() {
  const { payload } = github.context;
  const changedFiles = [];
  
  try {
    // For push events
    if (payload.head_commit) {
      changedFiles.push(...(payload.head_commit.added || []));
      changedFiles.push(...(payload.head_commit.modified || []));
    }
    
    // For push events with multiple commits
    if (payload.commits && Array.isArray(payload.commits)) {
      for (const commit of payload.commits) {
        changedFiles.push(...(commit.added || []));
        changedFiles.push(...(commit.modified || []));
      }
    }
    
    // Remove duplicates
    return [...new Set(changedFiles)];
  } catch (error) {
    core.warning(`Error getting changed files: ${error.message}`);
    return [];
  }
}

// Load prompt from URI using resource handler
async function loadPromptFromUri(promptUri, config = {}) {
  const promptConfig = config.prompt_uri || {};
  
  return await loadResource(promptUri, {
    cache_timeout: promptConfig.cache_timeout || 60,
    retry_attempts: promptConfig.retry_attempts || 3,
    retry_delay: promptConfig.retry_delay || 1000
  });
}

module.exports = {
  preparePrompt,
  loadPromptFromUri
}; 