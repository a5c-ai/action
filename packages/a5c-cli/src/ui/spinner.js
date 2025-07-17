/**
 * Spinner Utility
 * 
 * This module provides a spinner for CLI operations.
 */

const ora = require('ora');

class Spinner {
  constructor(text) {
    this.spinner = ora(text);
  }

  start(text) {
    if (text) {
      this.spinner.text = text;
    }
    this.spinner.start();
  }

  succeed(text) {
    this.spinner.succeed(text);
  }

  fail(text) {
    this.spinner.fail(text);
  }

  info(text) {
    this.spinner.info(text);
  }

  stop() {
    this.spinner.stop();
  }
}

module.exports = Spinner;