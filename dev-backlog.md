# Dev Backlog

## TODO

- [x] fix agent discovery for remote agents, it still shows 0 agents when using multiple agents from the same repo - FIXED: The issue was in the `discoverGitHubAgents` function where `tree_sha` was being set to the branch name instead of the branch SHA. Updated to first get the branch reference SHA and then use that for the tree API call. Also added better error handling and debug logging.

- [x] daily-news-aggregator - run initial topics setup and create a pull request - COMPLETED: Added news-aggregator-agent to .a5c/config.yml with alias "daily-news-aggregator". The agent is configured to run daily at midnight and will aggregate news content across specified topics.