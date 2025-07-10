const core = require('@actions/core');
const github = require('@actions/github');
const AgentRouter = require('./agent-trigger-engine');
const { executeMainAgent } = require('./agent-executor');
const { loadAgentConfigFromFile } = require('./agent-loader');
const { mergeConfigurations } = require('./config');

// Handle mention-based activation from any event
async function handleMentionBasedActivation(config) {
  try {
    const { context } = github;
    const mentionableContent = await getMentionableContent(context);
    
    if (!mentionableContent) {
      core.info('⏭️ No mentionable content found for mention-based activation');
      return;
    }
    
    core.info(`🔍 Checking for agent mentions in content: "${mentionableContent.substring(0, 100)}..."`);
    
    // Initialize router and load agents
    const router = new AgentRouter(config);
    await router.loadAgents();
    
    // Get agents mentioned in the content (filtered by event)
    const mentionedAgents = router.getAgentsByMention(mentionableContent, context.eventName);
    
    if (mentionedAgents.length === 0) {
      core.info('⏭️ No agents mentioned in content');
      return;
    }
    
    // Execute agents in mention order
    await executeAgentSequence(mentionedAgents, config);
    
  } catch (error) {
    core.setFailed(`Mention-based activation failed: ${error.message}`);
  }
}

// Handle event-based activation
async function handleEventBasedActivation(config) {
  try {
    const { context } = github;
    
    core.info(`🎯 Handling event-based activation for: ${context.eventName}`);
    
    // Initialize router and load agents
    const router = new AgentRouter(config);
    await router.loadAgents();
    
    // Get agents triggered by current event
    const triggeredAgents = router.getTriggeredAgents();
    
    if (triggeredAgents.length === 0) {
      core.info('⏭️ No agents triggered by current event');
      return;
    }
    
    // Execute agents in priority order
    await executeAgentSequence(triggeredAgents, config);
    
  } catch (error) {
    core.setFailed(`Event-based activation failed: ${error.message}`);
  }
}

// Execute a sequence of agents
async function executeAgentSequence(agents, globalConfig) {
  const results = [];
  let allSuccessful = true;
  
  core.info(`📋 Executing ${agents.length} agent(s) in sequence`);
  
  for (const [index, agentInfo] of agents.entries()) {
    try {
      core.info(`\n🤖 [${index + 1}/${agents.length}] Running agent: ${agentInfo.name}`);
      core.info(`   Category: ${agentInfo.category}`);
      core.info(`   CLI Command: ${agentInfo.cli_command || globalConfig.defaults?.cli_command}`);
      core.info(`   Triggered by: ${agentInfo.triggeredBy}`);
      core.info(`   Priority: ${agentInfo.priority || 'default'}`);
      core.info(`   Source: ${agentInfo.source || 'local'}`);
      
      if (agentInfo.mentionOrder !== null && agentInfo.mentionOrder !== undefined) {
        core.info(`   Mention order: ${agentInfo.mentionOrder}`);
      }
      
      // Load full agent configuration if needed
      let agentConfig = agentInfo;
      if (agentInfo.source === 'local' && agentInfo.path) {
        agentConfig = await loadAgentConfigFromFile(agentInfo.path);
      }
      
      // Merge with global configuration
      const mergedConfig = mergeConfigurations(globalConfig, agentConfig);
      
      // Execute the agent
      await executeMainAgent(mergedConfig, globalConfig);
      
      results.push({
        agent_id: agentInfo.id,
        agent_name: agentInfo.name,
        agent_category: agentInfo.category,
        success: true,
        triggered_by: agentInfo.triggeredBy,
        priority: agentInfo.priority || 0,
        source: agentInfo.source || 'local'
      });
      
      core.info(`   ✅ Agent ${agentInfo.name} completed successfully`);      
    } catch (error) {
      core.error(`   ❌ Agent ${agentInfo.name} failed: ${error.message}`);
      allSuccessful = false;
      core.setFailed(`❌ Agent ${agentInfo.name} failed: ${error.message}`);
      throw error;
      results.push({
        agent_id: agentInfo.id,
        agent_name: agentInfo.name,
        agent_category: agentInfo.category,
        success: false,
        error: error.message,
        triggered_by: agentInfo.triggeredBy,
        priority: agentInfo.priority || 0,
        source: agentInfo.source || 'local'
      });
    }
  }
  
  // Generate summary
  const successfulAgents = results.filter(r => r.success);
  const failedAgents = results.filter(r => !r.success);
  
  core.info(`\n📊 Execution Summary:`);
  core.info(`   Total agents: ${results.length}`);
  core.info(`   Successful: ${successfulAgents.length}`);
  core.info(`   Failed: ${failedAgents.length}`);
  
  // Set final outputs
  core.setOutput('success', allSuccessful);
  core.setOutput('agents_run', results.length);
  core.setOutput('agents_successful', successfulAgents.length);
  core.setOutput('agents_failed', failedAgents.length);
  core.setOutput('agent_results', JSON.stringify(results, null, 2));
  core.setOutput('summary', `Ran ${results.length} agents: ${successfulAgents.length} successful, ${failedAgents.length} failed`);
  
  if (allSuccessful) {
    core.info('✅ All agents completed successfully');
  } else {
    core.setFailed(`${failedAgents.length} agent(s) failed`);
  }
}

// Extract comment body from GitHub context
function getCommentBody(context) {
  const { payload } = context;
  
  // Issue comment
  if (payload.comment?.body) {
    return payload.comment.body;
  }
  
  // Pull request review comment
  if (payload.review?.body) {
    return payload.review.body;
  }
  
  // Pull request review comment (inline)
  if (payload.review_comment?.body) {
    return payload.review_comment.body;
  }
  
  return null;
}

// Extract mentionable content from GitHub context based on event type
async function getMentionableContent(context) {
  const { payload, eventName } = context;
  const content = [];
  
  // Comment events
  const commentBody = getCommentBody(context);
  if (commentBody) {
    content.push(commentBody);
  }
  
  // Push events - check commit messages and diffs
  if (eventName === 'push' && payload.commits) {
    payload.commits.forEach(commit => {
      if (commit.message) {
        content.push(commit.message);
      }
    });
    
    // Get diff content for mentions in code changes
    try {
      core.info('🔍 Fetching commit diff content for mention detection...');
      const diffContent = await getCommitDiffContent(context);
      if (diffContent) {
        core.info(`📝 Found ${diffContent.length} characters of diff content to search for mentions`);
        content.push(diffContent);
      } else {
        core.info('📝 No diff content found or accessible');
      }
    } catch (error) {
      core.warning(`Failed to get diff content for mentions: ${error.message}`);
    }
  }
  
  // Pull request events
  if (eventName === 'pull_request' && payload.pull_request) {
    if (payload.pull_request.title) {
      content.push(payload.pull_request.title);
    }
    if (payload.pull_request.body) {
      content.push(payload.pull_request.body);
    }
  }
  
  // Issue events
  if (eventName === 'issues' && payload.issue) {
    if (payload.issue.title) {
      content.push(payload.issue.title);
    }
    if (payload.issue.body) {
      content.push(payload.issue.body);
    }
  }
  
  return content.join(' ');
}

// Get commit diff content to search for mentions in code changes
// This allows agents to be triggered by mentions in:
async function getCommitDiffContent(context) {
  const { payload } = context;
  
  // For push events, we can get diffs using GitHub API
  if (payload.commits && payload.commits.length > 0) {
    try {
      const token = core.getInput('github_token') || process.env.GITHUB_TOKEN;
      if (!token) {
        core.warning('No GitHub token available for fetching diff content');
        return '';
      }
      
      const octokit = github.getOctokit(token);
      const [owner, repo] = payload.repository.full_name.split('/');
      
      let diffContent = '';
      
      // Get diffs for recent commits (limit to last 3 for performance)
      const commitsToCheck = payload.commits.slice(-3);
      
      for (const commit of commitsToCheck) {
        try {
          const { data: commitData } = await octokit.rest.repos.getCommit({
            owner,
            repo,
            ref: commit.id
          });
          
          // Extract diff content from files
          if (commitData.files) {
            for (const file of commitData.files) {
              if (file.patch) {
                diffContent += `\n--- ${file.filename} ---\n${file.patch}\n`;
              }
            }
          }
        } catch (error) {
          core.warning(`Failed to get diff for commit ${commit.id}: ${error.message}`);
        }
      }
      
      return diffContent;
    } catch (error) {
      core.warning(`Error fetching commit diff content: ${error.message}`);
      return '';
    }
  }
  
  return '';
}

module.exports = {
  handleMentionBasedActivation,
  handleEventBasedActivation,
  getMentionableContent,
  getCommitDiffContent
}; 