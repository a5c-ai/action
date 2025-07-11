
# Bugs To fix:

- [x] [developer-agent] - **FIXED** - Agent not triggering on PR merges with path patterns

**Issue**: Agents with path-based triggers weren't being activated when merging pull requests with multiple commits.

**Root Cause**: The `getChangedFiles` method in `agent-trigger-engine.js` didn't properly handle:
1. Pull request events (missing GitHub API calls to get PR files)  
2. PR merge detection in push events
3. File extraction from merged pull requests

**Solution Applied**:
- Enhanced `getChangedFiles` to use GitHub API for pull request file detection
- Added PR merge detection by analyzing commit messages
- Implemented fallback mechanisms for robustness
- Made path trigger checking async to support API calls

The path pattern `docs/news/articles/topics/*/*/*/*/*.md` will now work correctly for PR merges.