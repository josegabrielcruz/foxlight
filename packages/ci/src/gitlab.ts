// ============================================================
// @foxlight/ci — GitLab Integration
//
// Posts analysis results as merge request comments
// via the GitLab API.
// ============================================================

import type { SnapshotDiff } from '@foxlight/core';
import { generateCommentBody } from './github.js';

/** GitLab API configuration. */
export interface GitLabConfig {
  /** GitLab private token or CI job token */
  token: string;
  /** Project ID (numeric) or URL-encoded path (e.g. "group%2Fproject") */
  projectId: string;
  /** Merge request IID */
  mergeRequestIid: number;
  /** Optional: GitLab API base URL (for self-hosted instances) */
  apiUrl?: string;
}

/**
 * Detect GitLab environment from CI environment variables.
 * Works in GitLab CI/CD pipelines automatically.
 */
export function detectGitLabEnv(): Partial<GitLabConfig> {
  const token = process.env['GITLAB_TOKEN'] ?? process.env['CI_JOB_TOKEN'];
  const projectId = process.env['CI_PROJECT_ID'];
  const apiUrl = process.env['CI_API_V4_URL'] ?? 'https://gitlab.com/api/v4';

  let mergeRequestIid: number | undefined;
  const mrIid = process.env['CI_MERGE_REQUEST_IID'];
  if (mrIid) {
    mergeRequestIid = parseInt(mrIid, 10);
  }

  return {
    token,
    projectId,
    mergeRequestIid,
    apiUrl,
  };
}

/**
 * Post a Foxlight analysis comment on a GitLab merge request.
 */
export async function postMRComment(config: GitLabConfig, diff: SnapshotDiff): Promise<void> {
  const body = generateCommentBody(diff);
  const { apiUrl = 'https://gitlab.com/api/v4' } = config;

  // Check if we already have a Foxlight comment to update
  const existingNoteId = await findExistingNote(config);

  if (existingNoteId) {
    // Update existing note
    const updateUrl = `${apiUrl}/projects/${encodeURIComponent(config.projectId)}/merge_requests/${config.mergeRequestIid}/notes/${existingNoteId}`;
    await fetch(updateUrl, {
      method: 'PUT',
      headers: {
        'PRIVATE-TOKEN': config.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body }),
    });
  } else {
    // Create new note
    const url = `${apiUrl}/projects/${encodeURIComponent(config.projectId)}/merge_requests/${config.mergeRequestIid}/notes`;
    await fetch(url, {
      method: 'POST',
      headers: {
        'PRIVATE-TOKEN': config.token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ body }),
    });
  }
}

/**
 * Find an existing Foxlight note on the MR (to update instead of creating a new one).
 */
async function findExistingNote(config: GitLabConfig): Promise<number | null> {
  const { apiUrl = 'https://gitlab.com/api/v4' } = config;
  const url = `${apiUrl}/projects/${encodeURIComponent(config.projectId)}/merge_requests/${config.mergeRequestIid}/notes?sort=desc&order_by=created_at`;

  const response = await fetch(url, {
    headers: {
      'PRIVATE-TOKEN': config.token,
    },
  });

  if (!response.ok) return null;

  const notes = (await response.json()) as Array<{
    id: number;
    body: string;
  }>;

  const foxlightNote = notes.find((n) => n.body.includes('<!-- foxlight-report -->'));

  return foxlightNote?.id ?? null;
}
