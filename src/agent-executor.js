const core = require('@actions/core');
const { preparePrompt } = require('./prompt');
const { executeAgent } = require('./agent-execution');
const { processAgentOutput, setOutputs } = require('./output-processor');

// Main execution logic for a single agent
async function executeMainAgent(agent, config) {
    // Prepare prompt with proper context
    const promptData = await preparePrompt(agent, [], [], config);
    
    // Execute the agent
    const response = await executeAgent(agent, promptData, config);
    
    // Process output and create structured report
    const processedOutput = await processAgentOutput(response, agent);

    // Set outputs for subsequent workflow steps
    setOutputs({
      ...processedOutput.outputs,
    });
    

}

module.exports = {
  executeMainAgent
}; 