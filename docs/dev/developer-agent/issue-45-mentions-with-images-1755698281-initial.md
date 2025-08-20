Started: Include issue body when handling issue_comment for mention detection.
Plan:
- Update src/agent-router.js getMentionableContent to append issue title/body on issue_comment.
- Also include PR title/body on PR review comment events.
Validation:
- Added node snippet to verify content aggregation includes both comment and issue body with images.
