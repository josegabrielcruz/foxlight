// ============================================================
// @foxlight/ci — GitHub Integration
//
// Posts analysis results as PR comments and check runs
// via the GitHub API.
// ============================================================

import type {
  SnapshotDiff,
  BundleDiffEntry,
  HealthDiffEntry,
  ComponentModification,
} from '@foxlight/core';

/** Format bytes into a human-readable string. */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  const sign = bytes < 0 ? '-' : '';
  return `${sign}${Math.abs(value).toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[i]}`;
}

/** GitHub API configuration. */
export interface GitHubConfig {
  /** GitHub API token */
  token: string;
  /** Repository owner */
  owner: string;
  /** Repository name */
  repo: string;
  /** PR number */
  prNumber: number;
  /** Optional: GitHub API base URL (for GitHub Enterprise) */
  apiUrl?: string;
}

/**
 * Detect GitHub environment from CI environment variables.
 * Works in GitHub Actions automatically.
 */
export function detectGitHubEnv(): Partial<GitHubConfig> {
  const token = process.env['GITHUB_TOKEN'];
  const repository = process.env['GITHUB_REPOSITORY'] ?? '';
  const [owner, repo] = repository.split('/');
  const eventPath = process.env['GITHUB_EVENT_PATH'];

  let prNumber: number | undefined;
  if (eventPath) {
    try {
      // Dynamic import of the event payload to extract PR number
      // In a real implementation, we'd read the JSON file
      const ref = process.env['GITHUB_REF'] ?? '';
      const match = ref.match(/refs\/pull\/(\d+)/);
      if (match?.[1]) {
        prNumber = parseInt(match[1], 10);
      }
    } catch {
      // Not in a PR context
    }
  }

  return {
    token,
    owner,
    repo,
    prNumber,
    apiUrl: process.env['GITHUB_API_URL'] ?? 'https://api.github.com',
  };
}

/**
 * Post a Foxlight analysis comment on a GitHub PR.
 */
export async function postPRComment(
  config: GitHubConfig,
  diff: SnapshotDiff,
): Promise<void> {
  const body = generateCommentBody(diff);
  const { apiUrl = 'https://api.github.com' } = config;
  const url = `${apiUrl}/repos/${config.owner}/${config.repo}/issues/${config.prNumber}/comments`;

  // Check if we already have a Foxlight comment to update
  const existingCommentId = await findExistingComment(config);

  if (existingCommentId) {
    // Update existing comment
    const updateUrl = `${apiUrl}/repos/${config.owner}/${config.repo}/issues/comments/${existingCommentId}`;
    await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `token ${config.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({ body }),
    });
  } else {
    // Create new comment
    await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `token ${config.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({ body }),
    });
  }
}

/**
 * Find an existing Foxlight comment on the PR (to update instead of creating a new one).
 */
async function findExistingComment(
  config: GitHubConfig,
): Promise<number | null> {
  const { apiUrl = 'https://api.github.com' } = config;
  const url = `${apiUrl}/repos/${config.owner}/${config.repo}/issues/${config.prNumber}/comments`;

  const response = await fetch(url, {
    headers: {
      Authorization: `token ${config.token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) return null;

  const comments = (await response.json()) as Array<{
    id: number;
    body: string;
  }>;
  const foxlightComment = comments.find((c) =>
    c.body.includes('<!-- foxlight-report -->'),
  );

  return foxlightComment?.id ?? null;
}

// -----------------------------------------------------------
// Comment body generation
// -----------------------------------------------------------

const COMMENT_MARKER = '<!-- foxlight-report -->';

/**
 * Generate the Markdown body for a PR comment.
 */
export function generateCommentBody(diff: SnapshotDiff): string {
  const lines: string[] = [COMMENT_MARKER, '## 🦊 Foxlight Report', ''];

  // Component changes summary
  const { added, removed, modified } = diff.components;
  if (added.length > 0 || removed.length > 0 || modified.length > 0) {
    lines.push('### Components', '');

    if (added.length > 0) {
      lines.push(
        `🟢 **${added.length} added:** ${added.map((c) => `\`${c.name}\``).join(', ')}`,
        '',
      );
    }
    if (removed.length > 0) {
      lines.push(
        `🔴 **${removed.length} removed:** ${removed.map((c) => `\`${c.name}\``).join(', ')}`,
        '',
      );
    }
    if (modified.length > 0) {
      lines.push(`🟡 **${modified.length} modified:**`, '');
      lines.push(...formatModifications(modified), '');
    }
  } else {
    lines.push('✅ No component changes detected.', '');
  }

  // Bundle size changes
  if (diff.bundleDiff.length > 0) {
    const significant = diff.bundleDiff.filter(
      (b) => Math.abs(b.delta.gzip) > 100,
    );
    if (significant.length > 0) {
      lines.push('### Bundle Size Changes', '');
      lines.push(
        '| Component | Before | After | Delta |',
        '|-----------|--------|-------|-------|',
      );
      for (const entry of significant) {
        lines.push(formatBundleRow(entry));
      }
      lines.push('');
    }
  }

  // Health score changes
  if (diff.healthDiff.length > 0) {
    const significant = diff.healthDiff.filter((h) => Math.abs(h.delta) >= 5);
    if (significant.length > 0) {
      lines.push('### Health Score Changes', '');
      lines.push(
        '| Component | Before | After | Delta |',
        '|-----------|--------|-------|-------|',
      );
      for (const entry of significant) {
        lines.push(formatHealthRow(entry));
      }
      lines.push('');
    }
  }

  lines.push(
    '---',
    `*Generated by [Foxlight](https://github.com/foxlight) at ${new Date().toISOString()}*`,
  );

  return lines.join('\n');
}

function formatModifications(mods: ComponentModification[]): string[] {
  const lines: string[] = [];
  for (const mod of mods) {
    const changes: string[] = [];
    if (mod.propsAdded.length > 0)
      changes.push(`+${mod.propsAdded.length} props`);
    if (mod.propsRemoved.length > 0)
      changes.push(`-${mod.propsRemoved.length} props`);
    if (mod.propsModified.length > 0)
      changes.push(`~${mod.propsModified.length} props changed`);
    if (mod.changes.length > 0) changes.push(...mod.changes);

    lines.push(`  - \`${mod.componentId}\`: ${changes.join(', ')}`);
  }
  return lines;
}

function formatBundleRow(entry: BundleDiffEntry): string {
  const delta = entry.delta.gzip;
  const emoji = delta > 0 ? '🔺' : '🔽';
  return `| \`${entry.componentId}\` | ${formatBytes(entry.before.gzip)} | ${formatBytes(entry.after.gzip)} | ${emoji} ${formatBytes(delta)} |`;
}

function formatHealthRow(entry: HealthDiffEntry): string {
  const emoji = entry.delta > 0 ? '📈' : '📉';
  return `| \`${entry.componentId}\` | ${entry.beforeScore} | ${entry.afterScore} | ${emoji} ${entry.delta > 0 ? '+' : ''}${entry.delta} |`;
}
