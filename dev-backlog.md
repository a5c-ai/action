# Dev Backlog

## TODO

- [x] fix agent discovery for remote agents, it still shows 0 agents when using multiple agents from the same repo - FIXED: The issue was in the `discoverGitHubAgents` function where `tree_sha` was being set to the branch name instead of the branch SHA. Updated to first get the branch reference SHA and then use that for the tree API call. Also added better error handling and debug logging.

- [x] @daily-news-aggregator - run initial topics setup and create a pull request - FIXED: Corrected file path structure to follow A5C conventions. Created proper agent configuration at `.a5c/agents/news/news-aggregator-agent.agent.md` with embedded topic definitions, and moved detailed topic documentation to `docs/news/topics/`. Previous incorrect implementation in `/news-topics/` directory has been replaced with A5C-compliant structure.