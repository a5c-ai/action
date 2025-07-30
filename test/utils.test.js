const { isUserAllowedToTrigger, getRepositoryTeamMembers, isOrganization } = require('../src/utils');
const github = require('@actions/github');
const core = require('@actions/core');

// Mock dependencies
jest.mock('@actions/github', () => ({
  getOctokit: jest.fn()
}));

jest.mock('@actions/core', () => ({
  warning: jest.fn(),
  info: jest.fn()
}));

describe('User whitelist utils', () => {
  
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Mock environment variables
    process.env.GITHUB_TOKEN = 'mock-token';
  });
  
  describe('isOrganization', () => {
    test('should return true for organization accounts', async () => {
      const mockOctokit = {
        rest: {
          users: {
            getByUsername: jest.fn()
              .mockResolvedValueOnce({ data: { type: 'Organization' } })
              .mockResolvedValueOnce({ data: { type: 'Organization' } })
              .mockResolvedValueOnce({ data: { type: 'Organization' } })
          }
        }
      };
      github.getOctokit.mockReturnValue(mockOctokit);

      expect(await isOrganization('acme')).toBe(true);
      expect(await isOrganization('microsoft')).toBe(true);
      expect(await isOrganization('a5c')).toBe(true);
    });
    
    test('should return false for user accounts', async () => {
      const mockOctokit = {
        rest: {
          users: {
            getByUsername: jest.fn()
              .mockResolvedValueOnce({ data: { type: 'User' } })
              .mockResolvedValueOnce({ data: { type: 'User' } })
          }
        }
      };
      github.getOctokit.mockReturnValue(mockOctokit);

      expect(await isOrganization('john-doe')).toBe(false);
      expect(await isOrganization('user-name')).toBe(false);
    });
    
    test('should fallback to heuristic when no token available', async () => {
      delete process.env.GITHUB_TOKEN;
      delete process.env.INPUT_GITHUB_TOKEN;
      
      expect(await isOrganization('acme')).toBe(true);  // no hyphens, >2 chars
      expect(await isOrganization('john-doe')).toBe(false);  // has hyphens
      expect(await isOrganization('ab')).toBe(false);  // <=2 chars
      
      // Restore token for other tests
      process.env.GITHUB_TOKEN = 'mock-token';
    });
    
    test('should fallback to heuristic on API error', async () => {
      const mockOctokit = {
        rest: {
          users: {
            getByUsername: jest.fn().mockRejectedValue(new Error('API Error'))
          }
        }
      };
      github.getOctokit.mockReturnValue(mockOctokit);

      expect(await isOrganization('acme')).toBe(true);  // fallback heuristic
      expect(await isOrganization('john-doe')).toBe(false);  // fallback heuristic
    });
  });
  
  describe('getRepositoryTeamMembers', () => {
    test('should get members for an organization repository', async () => {
      // Mock organization members response
      const mockOctokit = {
        rest: {
          orgs: {
            listMembers: jest.fn().mockResolvedValue({
              data: [
                { login: 'user1' },
                { login: 'user2' },
                { login: 'user3' }
              ]
            })
          }
        }
      };
      
      github.getOctokit.mockReturnValue(mockOctokit);
      
      const result = await getRepositoryTeamMembers('a5c-ai', 'action');
      
      expect(github.getOctokit).toHaveBeenCalledWith('mock-token');
      expect(mockOctokit.rest.orgs.listMembers).toHaveBeenCalledWith({
        org: 'a5c-ai'
      });
      expect(result).toEqual(['user1', 'user2', 'user3']);
    });
    
    test('should get collaborators for a user repository', async () => {
      // Mock collaborators response
      const mockOctokit = {
        rest: {
          orgs: {
            listMembers: jest.fn().mockRejectedValue({
              status: 404
            })
          },
          repos: {
            listCollaborators: jest.fn().mockResolvedValue({
              data: [
                { login: 'owner' },
                { login: 'collaborator1' },
                { login: 'collaborator2' }
              ]
            })
          }
        }
      };
      
      github.getOctokit.mockReturnValue(mockOctokit);
      
      const result = await getRepositoryTeamMembers('user-name', 'repo');
      
      expect(github.getOctokit).toHaveBeenCalledWith('mock-token');
      expect(mockOctokit.rest.repos.listCollaborators).toHaveBeenCalledWith({
        owner: 'user-name',
        repo: 'repo'
      });
      expect(result).toEqual(['owner', 'collaborator1', 'collaborator2']);
    });
    
    test('should handle errors and return empty array', async () => {
      // Mock API error
      const mockOctokit = {
        rest: {
          orgs: {
            listMembers: jest.fn().mockRejectedValue(new Error('API error'))
          },
          repos: {
            listCollaborators: jest.fn().mockRejectedValue(new Error('API error'))
          }
        }
      };
      
      github.getOctokit.mockReturnValue(mockOctokit);
      
      const result = await getRepositoryTeamMembers('a5c-ai', 'action');
      
      expect(github.getOctokit).toHaveBeenCalledWith('mock-token');
      expect(core.warning).toHaveBeenCalled();
      expect(result).toEqual([]);
    });
    
    test('should handle missing GitHub token', async () => {
      // Remove token
      delete process.env.GITHUB_TOKEN;
      
      const result = await getRepositoryTeamMembers('a5c-ai', 'action');
      
      expect(core.warning).toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });
  
  describe('isUserAllowedToTrigger', () => {
    test('should allow users in whitelist', async () => {
      const whitelist = ['user1', 'user2', 'user3'];
      
      const result = await isUserAllowedToTrigger('user2', whitelist, 'a5c-ai', 'action');
      
      expect(result).toBe(true);
    });
    
    test('should deny users not in whitelist', async () => {
      const whitelist = ['user1', 'user2', 'user3'];
      
      const result = await isUserAllowedToTrigger('user4', whitelist, 'a5c-ai', 'action');
      
      expect(result).toBe(false);
    });
    
    test('should fall back to team members when whitelist is empty', async () => {
      // Mock team members
      const mockOctokit = {
        rest: {
          orgs: {
            listMembers: jest.fn().mockResolvedValue({
              data: [
                { login: 'user1' },
                { login: 'user2' },
                { login: 'user3' }
              ]
            })
          }
        }
      };
      
      github.getOctokit.mockReturnValue(mockOctokit);
      
      // Empty whitelist
      const whitelist = [];
      
      // User is in team members
      const result1 = await isUserAllowedToTrigger('user2', whitelist, 'a5c-ai', 'action');
      expect(result1).toBe(true);
      
      // User is not in team members
      const result2 = await isUserAllowedToTrigger('user4', whitelist, 'a5c-ai', 'action');
      expect(result2).toBe(false);
    });
  });
});