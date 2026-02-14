// ============================================================
// @foxlight/cli — CI command
//
// Runs in CI environments (GitHub Actions, GitLab CI).
// Analyzes the project, compares against a saved baseline
// snapshot, and posts results as PR comments or MR notes.
// ============================================================

import { analyzeProject } from '@foxlight/analyzer';
import {
  compareSnapshots,
  hasSignificantChanges,
  postPRComment,
  createCheckRun,
  detectGitHubEnv,
  postMRComment,
  detectGitLabEnv,
} from '@foxlight/ci';
import { ui } from '../utils/output.js';

export interface CIOptions {
  rootDir: string;
  json?: boolean;
  basePath?: string;
  outputPath?: string;
}

export async function runCI(options: CIOptions): Promise<void> {
  const { rootDir, json } = options;
  const basePath = options.basePath ?? '.foxlight/snapshot.json';
  const outputPath = options.outputPath ?? '.foxlight/snapshot.json';

  // Detect CI environment
  const commitSha =
    process.env['GITHUB_SHA'] ?? process.env['CI_COMMIT_SHA'] ?? 'local';
  const branch =
    process.env['GITHUB_HEAD_REF'] ??
    process.env['CI_COMMIT_BRANCH'] ??
    process.env['CI_MERGE_REQUEST_SOURCE_BRANCH_NAME'] ??
    'unknown';

  ui.progress('Analyzing project');
  const comparison = await compareSnapshots({
    rootDir,
    basePath,
    outputPath,
    commitSha,
    branch,
  });
  ui.progressDone('Analysis complete');

  const { diff, head } = comparison;
  const significant = hasSignificantChanges(diff);

  if (json) {
    console.log(JSON.stringify({ diff, significant }, null, 2));
    return;
  }

  // Print summary
  ui.heading('CI Analysis Summary');
  ui.info('Commit:', commitSha.slice(0, 8));
  ui.info('Branch:', branch);
  ui.info('Components:', String(head.components.length));
  ui.info('Significant changes:', significant ? 'yes' : 'no');

  if (diff.components.added.length > 0) {
    ui.success(`${diff.components.added.length} component(s) added`);
  }
  if (diff.components.removed.length > 0) {
    ui.warn(`${diff.components.removed.length} component(s) removed`);
  }
  if (diff.components.modified.length > 0) {
    ui.info('Modified:', `${diff.components.modified.length} component(s)`);
  }

  // Post to GitHub if in GitHub Actions
  const githubEnv = detectGitHubEnv();
  if (githubEnv.token && githubEnv.owner && githubEnv.repo && githubEnv.prNumber) {
    ui.progress('Posting GitHub PR comment');
    try {
      const config = githubEnv as import('@foxlight/ci').GitHubConfig;
      await postPRComment(config, diff);
      ui.progressDone('PR comment posted');

      await createCheckRun({
        ...config,
        name: 'Foxlight Analysis',
        headSha: commitSha,
        diff,
      });
      ui.success('Check run created');
    } catch (err) {
      ui.warn(`GitHub integration failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Post to GitLab if in GitLab CI
  const gitlabEnv = detectGitLabEnv();
  if (gitlabEnv) {
    ui.progress('Posting GitLab MR note');
    try {
      await postMRComment(gitlabEnv, diff);
      ui.progressDone('MR note posted');
    } catch (err) {
      ui.warn(`GitLab integration failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (!githubEnv.token && !gitlabEnv) {
    ui.info('CI platform:', 'not detected (running locally)');
    ui.info('Snapshot saved to:', outputPath);
  }

  ui.gap();
}
