#!/usr/bin/env node

/**
 * A5C CLI - Command Line Interface
 * 
 * This is the entry point for the A5C CLI.
 */

const { program } = require('../dist/index');

// Execute the CLI program
program.parse(process.argv);