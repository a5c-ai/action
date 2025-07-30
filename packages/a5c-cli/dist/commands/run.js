/**
 * Run Command
 * 
 * This command runs an A5C agent locally.
 */

const { loadConfig } = require('@a5c/sdk');

function runCommand(program) {
  program
    .command('run')
    .description('Run an A5C agent locally')
    .option('-a, --agent <path>', 'Path to agent file')
    .option('-c, --config <path>', 'Path to config file')
    .option('-d, --dry-run', 'Run in dry run mode')
    .action(async (options) => {
      console.log('Running agent...');
      // Implementation will go here
    });
}

module.exports = runCommand;