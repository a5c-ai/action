# Daily News Aggregator Topics

This directory contains the detailed topic definitions for the daily news aggregator. Each topic file defines the focus areas, keywords, and sources for news aggregation.

## Directory Structure

This documentation supports the **Daily News Aggregator Agent** located at:
- **Agent File**: `.a5c/agents/news/news-aggregator-agent.agent.md`
- **Topic Documentation**: `docs/news/topics/` (this directory)

## Available Topics

1. **[Artificial Intelligence](./artificial-intelligence.md)** - AI developments, machine learning, and AI applications
2. **[Software Development](./software-development.md)** - Programming languages, frameworks, and development practices
3. **[Open Source](./open-source.md)** - Open source projects, community initiatives, and ecosystem trends
4. **[Cloud Computing](./cloud-computing.md)** - Cloud platforms, services, and infrastructure developments
5. **[Cybersecurity](./cybersecurity.md)** - Security threats, vulnerabilities, and defense strategies
6. **[Startup & Tech Industry](./startup-tech.md)** - Startup funding, tech industry trends, and acquisitions

## Topic Structure

Each topic file includes:
- **Overview**: General description of the topic
- **Key Focus Areas**: Current trending subtopics for 2025
- **Subtopics to Track**: Specific areas to monitor
- **News Sources**: Types of sources to aggregate from
- **Keywords for Aggregation**: Search terms and phrases

## Usage

These topic files serve as detailed documentation for:
- **Agent Configuration**: The main agent file contains embedded topic configurations
- **Manual Reference**: Detailed breakdown of each topic for human reference
- **Keyword Research**: Comprehensive keyword lists for search optimization
- **Content Guidelines**: Focus areas and priorities for content curation

## Correct File Paths

Following A5C agent system conventions:

### ✅ Correct Structure
```
.a5c/agents/news/
└── news-aggregator-agent.agent.md  # Main agent configuration

docs/news/topics/
├── README.md                        # This file
├── artificial-intelligence.md       # Topic details
├── software-development.md          # Topic details
├── open-source.md                   # Topic details
├── cloud-computing.md               # Topic details
├── cybersecurity.md                 # Topic details
└── startup-tech.md                  # Topic details
```

### ❌ Incorrect Structure (Fixed)
```
news-topics/  # This was incorrect - not A5C compliant
```

## Agent Activation

The Daily News Aggregator Agent can be triggered via:
- **Daily Schedule**: Automatic execution at midnight UTC
- **Manual Trigger**: Use `@daily-news-aggregator` mention in issues or PRs
- **GitHub Events**: Responds to schedule, issues, and pull_request events

## Updating Topics

Topics should be regularly reviewed and updated to:
- Add new emerging trends
- Remove outdated focus areas
- Refine keywords based on performance
- Adjust to community interests and feedback

For updates, modify both:
1. **Agent configuration**: `.a5c/agents/news/news-aggregator-agent.agent.md`
2. **Documentation files**: Individual topic files in this directory