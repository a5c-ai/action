# Dev Backlog

## TODO

- [x] fix agent discovery for remote agents, it still shows 0 agents when using multiple agents from the same repo - FIXED: The issue was in the `discoverGitHubAgents` function where `tree_sha` was being set to the branch name instead of the branch SHA. Updated to first get the branch reference SHA and then use that for the tree API call. Also added better error handling and debug logging.

- [x] @daily-news-aggregator - run initial topics setup and create a pull request - COMPLETED: Created proper agent structure with news-aggregator-agent.agent.md following A5C agent configuration standards