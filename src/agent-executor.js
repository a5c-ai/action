const core = require('@actions/core');
const { preparePrompt } = require('./prompt');
const { executeAgent } = require('./agent-execution');
const { processAgentOutput, setOutputs } = require('./output-processor');
const AgentRouter = require('./agent-trigger-engine');

// Main execution logic for a single agent
async function executeMainAgent(agent, config) {
    try {
        // Initialize agent router to get available agents for discovery
        const router = new AgentRouter(config);
        await router.loadAgents();
        
        // Generate agent discovery context for the current agent
        const availableAgents = router.generateAgentDiscoveryContext(agent);
        
        // Get mentions from the agent (for context in prompts)
        const mentions = agent.mentions || [];
        
        core.info(`🔍 Agent discovery: Found ${availableAgents.length} available agents for context`);
        if (availableAgents.length > 0) {
            core.info(`   Available agents: ${availableAgents.map(a => a.name).join(', ')}`);
        }
        
        // Prepare prompt with proper context (note: parameter order is config, availableAgents, mentions, globalConfig)
        const promptData = await preparePrompt(agent, availableAgents, mentions, config);
        
        // Execute the agent
        const response = await executeAgent(agent, promptData, config);
        
        // Process output and create structured report
        const processedOutput = await processAgentOutput(response, agent);

        // Set outputs for subsequent workflow steps
        // setOutputs({
        //   ...processedOutput.outputs,
        // });
        
    } catch (error) {
        core.error(`Error in executeMainAgent: ${error.message}`);
        throw error;
    }
}

module.exports = {
  executeMainAgent
}; 