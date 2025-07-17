const core = require('@actions/core');

// Process agent output and extract structured data
async function processAgentOutput(response, config) {
  // The response is the direct output from the agent through MCP
  const reportContent = response;
  core.info(`🔍 Report content: ${reportContent}`);
  // Return the processed output
  return {
    reportContent,
    outputs: {}
  };
}


// Set action outputs
function setOutputs(outputs) {
  Object.entries(outputs).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      core.setOutput(key, value);
    }
  });
}

module.exports = {
  processAgentOutput,
  setOutputs,
}; 