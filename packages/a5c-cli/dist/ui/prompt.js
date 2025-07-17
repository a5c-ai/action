/**
 * Prompt Utility
 * 
 * This module provides interactive prompts for CLI operations.
 */

const inquirer = require('inquirer');

/**
 * Prompt the user for input
 * @param {Array} questions - Array of inquirer question objects
 * @returns {Promise<Object>} - Answers object
 */
async function prompt(questions) {
  return inquirer.prompt(questions);
}

/**
 * Ask a simple confirmation question
 * @param {string} message - Confirmation message
 * @param {boolean} defaultValue - Default value
 * @returns {Promise<boolean>} - True if confirmed
 */
async function confirm(message, defaultValue = false) {
  const { confirmed } = await prompt([
    {
      type: 'confirm',
      name: 'confirmed',
      message,
      default: defaultValue
    }
  ]);
  return confirmed;
}

/**
 * Ask for input
 * @param {string} message - Input message
 * @param {string} defaultValue - Default value
 * @returns {Promise<string>} - Input value
 */
async function input(message, defaultValue = '') {
  const { value } = await prompt([
    {
      type: 'input',
      name: 'value',
      message,
      default: defaultValue
    }
  ]);
  return value;
}

module.exports = {
  prompt,
  confirm,
  input
};