
# Bugs To fix:

- [ ] @developer - i have a bug where the agent isn't triggering when i merge a pull request with multiple commits.
the agent is configured to run without mentions, just with 'paths'

```yaml
events: ["push"]
paths: "docs/news/articles/topics/*/*/*/*/*.md"
```

but it showed 0 agents when i merged the PR.