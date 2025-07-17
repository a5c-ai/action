/**
 * A5C CLI - Main Entry Point
 * 
 * This module exports the main CLI program.
 */

const { Command } = require('commander');
const runCommand = require('./commands/run');
const initCommand = require('./commands/init');
const validateCommand = require('./commands/validate');
const scaffoldCommand = require('./commands/scaffold');

const program = new Command();

// Set up program metadata
program
  .name('a5c')
  .description('A5C - AI Agent System for GitHub Automation')
  .version('1.0.0');

// Register commands
runCommand(program);
initCommand(program);
validateCommand(program);
scaffoldCommand(program);

module.exports = {
  program
};