const core = require('@actions/core');
const { preparePrompt } = require('./prompt');
const { executeAgent } = require('./agent-execution');
const { processAgentOutput, setOutputs } = require('./output-processor');
const AgentRouter = require('./agent-trigger-engine');

// Main execution logic for a single agent
async function executeMainAgent(agent, config, router = null) {
    try {
        let agentRouter = router;
        
        // If no router provided, create and load one (fallback for backward compatibility)
        if (!agentRouter) {
            core.info('🔄 No router provided, creating new AgentRouter for agent discovery');
            agentRouter = new AgentRouter(config);
            await agentRouter.loadAgents();
        } else {
            core.info('🔄 Using provided AgentRouter for agent discovery');
        }
        
        // Generate agent discovery context for the current agent
        const availableAgents = agentRouter.generateAgentDiscoveryContext(agent);
        
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