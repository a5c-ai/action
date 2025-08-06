const core = require('@actions/core');

// Process agent output and extract structured data
async function processAgentOutput(response, config) {
  // The response is the direct output from the agent through MCP
  const reportContent = response;
  core.info(`🔍 Report content: ${JSON.stringify(reportContent)}`);
  // Extract cost information from status reports and log entries
  let cost = 0;
  if (response.statusReports && Array.isArray(response.statusReports)) {
    for (const rep of response.statusReports) {
      if (rep.data) {
        if (typeof rep.data.cost_usd === 'number') {
          cost += rep.data.cost_usd;
        } else if (typeof rep.data.cost === 'number') {
          cost += rep.data.cost;
        } else if (rep.data.usage) {
          if (typeof rep.data.usage.total_cost === 'number') {
            cost += rep.data.usage.total_cost;
          } else if (typeof rep.data.usage.cost_usd === 'number') {
            cost += rep.data.usage.cost_usd;
          }
        }
      }
    }
  }
  if (response.logEntries && Array.isArray(response.logEntries)) {
    for (const log of response.logEntries) {
      if (log.context) {
        if (typeof log.context.cost_usd === 'number') {
          cost += log.context.cost_usd;
        } else if (typeof log.context.cost === 'number') {
          cost += log.context.cost;
        }
      }
    }
  }
  if (cost > 0) {
    core.info(`💰 Estimated cost: $${cost.toFixed(6)}`);
  }
  // Return the processed output including cost
  return {
    reportContent,
    outputs: { cost }
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
