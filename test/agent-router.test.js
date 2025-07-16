const { handleMentionBasedActivation, handleEventBasedActivation } = require('../src/agent-router');
const AgentRouter = require('../src/agent-trigger-engine');
const github = require('@actions/github');
const core = require('@actions/core');
const utils = require('../src/utils');

// Mock dependencies
jest.mock('../src/agent-trigger-engine');
jest.mock('@actions/github', () => ({
  context: {
    eventName: 'issue_comment',
    actor: 'user1',
    repo: {
      owner: 'a5c-ai',
      repo: 'action'
    }
  }
}));
jest.mock('@actions/core');
jest.mock('../src/utils', () => ({
  isUserAllowedToTrigger: jest.fn()
}));

describe('Agent Router with User Whitelist', () => {
  let mockRouter;
  let mockConfig;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup mock router
    mockRouter = {
      loadAgents: jest.fn().mockResolvedValue(),
      getAgentsByMention: jest.fn(),
      getTriggeredAgents: jest.fn()
    };
    
    AgentRouter.mockImplementation(() => mockRouter);
    
    // Setup mock config
    mockConfig = {
      defaults: {
        user_whitelist: ['team_member1', 'team_member2']
      }
    };
  });
  
  describe('handleMentionBasedActivation', () => {
    test('should filter out agents not allowed for the user', async () => {
      // Mock mentionable content
      const getMentionableContent = jest.fn().mockResolvedValue('@agent1 do something');
      jest.mock('../src/agent-router', () => ({
        ...jest.requireActual('../src/agent-router'),
        getMentionableContent
      }));
      
      // Mock agents
      const agents = [
        { 
          name: 'agent1', 
          user_whitelist: ['user1', 'user2'] 
        },
        { 
          name: 'agent2', 
          user_whitelist: ['user3', 'user4'] 
        }
      ];
      
      mockRouter.getAgentsByMention.mockReturnValue(agents);
      
      // Mock whitelist validation
      utils.isUserAllowedToTrigger
        .mockResolvedValueOnce(true)  // agent1 - allowed
        .mockResolvedValueOnce(false); // agent2 - not allowed
      
      await handleMentionBasedActivation(mockConfig, false);
      
      expect(utils.isUserAllowedToTrigger).toHaveBeenCalledTimes(2);
      expect(utils.isUserAllowedToTrigger).toHaveBeenCalledWith('user1', ['user1', 'user2'], 'a5c-ai', 'action');
      expect(utils.isUserAllowedToTrigger).toHaveBeenCalledWith('user1', ['user3', 'user4'], 'a5c-ai', 'action');
    });
  });
  
  describe('handleEventBasedActivation', () => {
    test('should filter out agents not allowed for the user', async () => {
      // Mock triggered agents
      const agents = [
        { 
          name: 'agent1', 
          user_whitelist: ['user1', 'user2'] 
        },
        { 
          name: 'agent2', 
          user_whitelist: ['user3', 'user4'] 
        }
      ];
      
      mockRouter.getTriggeredAgents.mockResolvedValue(agents);
      
      // Mock whitelist validation
      utils.isUserAllowedToTrigger
        .mockResolvedValueOnce(true)  // agent1 - allowed
        .mockResolvedValueOnce(false); // agent2 - not allowed
      
      await handleEventBasedActivation(mockConfig, false);
      
      expect(utils.isUserAllowedToTrigger).toHaveBeenCalledTimes(2);
      expect(utils.isUserAllowedToTrigger).toHaveBeenCalledWith('user1', ['user1', 'user2'], 'a5c-ai', 'action');
      expect(utils.isUserAllowedToTrigger).toHaveBeenCalledWith('user1', ['user3', 'user4'], 'a5c-ai', 'action');
    });
    
    test('should use default whitelist when agent has none', async () => {
      // Mock triggered agents
      const agents = [
        { 
          name: 'agent1', 
          user_whitelist: [] // Empty whitelist
        }
      ];
      
      mockRouter.getTriggeredAgents.mockResolvedValue(agents);
      
      // Mock whitelist validation
      utils.isUserAllowedToTrigger.mockResolvedValueOnce(true);
      
      await handleEventBasedActivation(mockConfig, false);
      
      expect(utils.isUserAllowedToTrigger).toHaveBeenCalledWith(
        'user1', 
        ['team_member1', 'team_member2'], // Default whitelist from config
        'a5c-ai', 
        'action'
      );
    });
  });
});