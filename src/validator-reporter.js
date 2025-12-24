const core = require('@actions/core');
const github = require('@actions/github');

function isTruthy(val) {
  if (val === undefined || val === null) return false;
  const s = String(val).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

function detectTokenKind(token) {
  if (!token) return 'none';
  if (token.startsWith('github_pat_') || token.startsWith('ghp_')) return 'pat';
  if (token.startsWith('gho_')) return 'oauth';
  if (token.startsWith('ghs_') || token.startsWith('gha_')) return 'app';
  return 'unknown';
}

function detectMode(env, tokenKind) {
  const enableChecksEnv = env.A5C_VALIDATOR_ENABLE_CHECKS;
  const useStatusesEnv = env.A5C_VALIDATOR_USE_STATUSES;

  const checksEnabled = enableChecksEnv !== undefined
    ? isTruthy(enableChecksEnv)
    : tokenKind === 'app'; // default: true when App token present

  if (checksEnabled) {
    if (tokenKind === 'app') {
      return { mode: 'checks', reason: 'checks enabled with app token' };
    }
    // cannot create checks without App token; fall back
    if (isTruthy(useStatusesEnv)) {
      return { mode: 'statuses', reason: 'checks unsupported; statuses enabled via flag' };
    }
    return { mode: 'comments', reason: 'checks unsupported with non-App token' };
  }

  if (isTruthy(useStatusesEnv)) {
    return { mode: 'statuses', reason: 'checks disabled; statuses enabled via flag' };
  }

  return { mode: 'comments', reason: 'checks disabled and statuses not enabled' };
}

async function resolveRepoAndSha(octokit, context) {
  const { owner, repo } = context.repo;
  // Determine target SHA based on event type
  const evt = context.eventName;
  let sha = context.sha;

  try {
    if (!sha) {
      if (evt === 'pull_request' && context.payload?.pull_request?.head?.sha) {
        sha = context.payload.pull_request.head.sha;
      } else if (evt === 'issue_comment' && context.payload?.issue?.pull_request) {
        // Issue comment on PR: fetch PR to get head sha
        const prNumber = context.payload.issue.number;
        const { data: pr } = await octokit.rest.pulls.get({ owner, repo, pull_number: prNumber });
        sha = pr.head.sha;
      }
    }
  } catch (e) {
    // Ignore lookup failures; will fall back to comments-only
  }

  return { owner, repo, sha };
}

class ValidatorReporter {
  constructor() {
    this.token = process.env.A5C_AGENT_GITHUB_TOKEN || process.env.GITHUB_TOKEN || '';
    this.tokenKind = detectTokenKind(this.token);
    const { mode, reason } = detectMode(process.env, this.tokenKind);
    this.mode = mode; // 'checks' | 'statuses' | 'comments'
    this.reason = reason;
    this.checkRunId = null;
    this.started = false;
  }

  logModeOnce() {
    // Single concise log line as requested
    core.info(`[validator-runner] mode=${this.mode} token=${this.tokenKind} reason=${this.reason}`);
  }

  async start() {
    this.logModeOnce();
    this.started = true;

    if (!this.token) return; // no API calls possible
    const octokit = github.getOctokit(this.token);
    const ctx = await resolveRepoAndSha(octokit, github.context);

    if (!ctx.sha) {
      // No commit to attach to; skip API calls to avoid 403/validation errors
      return;
    }

    if (this.mode === 'checks') {
      try {
        const res = await octokit.rest.checks.create({
          owner: ctx.owner,
          repo: ctx.repo,
          name: 'validator-agent validation',
          head_sha: ctx.sha,
          status: 'in_progress',
          started_at: new Date().toISOString(),
          output: {
            title: 'Validator is running',
            summary: 'Validation checks started.'
          }
        });
        this.checkRunId = res.data.id;
      } catch (e) {
        // Avoid spamming errors; downgrade to comments-only for this run
        core.warning(`Checks API unavailable: ${e.message}`);
        this.mode = 'comments';
      }
    } else if (this.mode === 'statuses') {
      try {
        await octokit.rest.repos.createCommitStatus({
          owner: ctx.owner,
          repo: ctx.repo,
          sha: ctx.sha,
          state: 'pending',
          context: 'validator-agent/validation',
          description: 'Validation pending'
        });
      } catch (e) {
        core.warning(`Statuses API unavailable: ${e.message}`);
        this.mode = 'comments';
      }
    }
  }

  async finish(success, detailsUrl = undefined, summary = undefined) {
    if (!this.started) return;
    if (!this.token) return;

    const octokit = github.getOctokit(this.token);
    const ctx = await resolveRepoAndSha(octokit, github.context);
    if (!ctx.sha) return;

    if (this.mode === 'checks' && this.checkRunId) {
      try {
        await octokit.rest.checks.update({
          owner: ctx.owner,
          repo: ctx.repo,
          check_run_id: this.checkRunId,
          status: 'completed',
          completed_at: new Date().toISOString(),
          conclusion: success ? 'success' : 'failure',
          output: {
            title: success ? 'Validation passed' : 'Validation failed',
            summary: summary || (success ? 'All validator checks passed.' : 'Some validator checks failed.'),
          },
          ...(detailsUrl ? { details_url: detailsUrl } : {})
        });
      } catch (e) {
        core.warning(`Failed to update Check Run: ${e.message}`);
      }
    } else if (this.mode === 'statuses') {
      try {
        await octokit.rest.repos.createCommitStatus({
          owner: ctx.owner,
          repo: ctx.repo,
          sha: ctx.sha,
          state: success ? 'success' : 'failure',
          context: 'validator-agent/validation',
          description: success ? 'Validation passed' : 'Validation failed',
          ...(detailsUrl ? { target_url: detailsUrl } : {})
        });
      } catch (e) {
        core.warning(`Failed to publish commit status: ${e.message}`);
      }
    }
  }
}

module.exports = { ValidatorReporter };

