# Dev Backlog

## TODO

- [x] fix agent discovery for remote agents, it still shows 0 agents when using multiple agents from the same repo - FIXED: The issue was in the `discoverGitHubAgents` function where `tree_sha` was being set to the branch name instead of the branch SHA. Updated to first get the branch reference SHA and then use that for the tree API call. Also added better error handling and debug logging.

- [x] @daily-news-aggregator - run initial topics setup and create a pull request - COMPLETED: Created comprehensive topic structure with 6 main categories (AI, Software Development, Open Source, Cloud Computing, Cybersecurity, Startup/Tech Industry). Each topic includes trending 2025 focus areas, subtopics, news sources, and keywords for aggregation. Topics are organized in `/news-topics/` directory with detailed markdown files.