const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');

// Import modules
const { loadConfig } = require('./src/config');
const { executeMainAgent } = require('./src/agent-executor');
const { handleMentionBasedActivation, handleEventBasedActivation, getMentionableContent } = require('./src/agent-router');
const { initializeTemplateHelpers } = require('./src/template-handler');

const logoAscii = fs.readFileSync(path.join(__dirname, 'logo-ascii.txt'), 'utf8');
// Initialize Handlebars helpers
Handlebars.registerHelper('json', function(context) {
  return JSON.stringify(context);
});

Handlebars.registerHelper('equals', function(arg1, arg2, options) {
  return (arg1 == arg2) ? options.fn(this) : options.inverse(this);
});

Handlebars.registerHelper('notEquals', function(arg1, arg2, options) {
  return (arg1 != arg2) ? options.fn(this) : options.inverse(this);
});

Handlebars.registerHelper('contains', function(haystack, needle, options) {
  return haystack.includes(needle) ? options.fn(this) : options.inverse(this);
});

Handlebars.registerHelper('formatDate', function(date) {
  return new Date(date).toISOString();
});

// Initialize template inclusion helpers
initializeTemplateHelpers(Handlebars);

async function main() {
  try {
    // Get the clone directory from the command line arguments
    if(!process.argv[2]) {
      core.setFailed('Clone directory is required');
      return;
    }
    const cloneDir = process.argv[2];
    core.info(logoAscii);
    core.info(`🔍 Clone directory: ${cloneDir}`);
    // set the clone directory as the current working directory
    process.chdir(cloneDir);

    // Load configuration
    const config = await loadConfig();
    
    // Check if dry run mode is enabled
    const dryRun = core.getInput('dry_run').toLowerCase() === 'true';
    if (dryRun) {
      core.info('🏃 Running in DRY RUN mode - no CLI commands will be executed');
    }
    
    // New unified approach: always check mentions first, then fall back to event-based
    const eventName = github.context.eventName;
    
    // First, try mention-based activation (works for all events now)
    await handleMentionBasedActivation(config, dryRun);
    
    await handleEventBasedActivation(config, dryRun);
    
  } catch (error) {
    core.setFailed(error.message);
  }
}

// Export functions for module usage
module.exports = {
  executeMainAgent
};

// Run main if called directly
if (require.main === module) {
  main();
}