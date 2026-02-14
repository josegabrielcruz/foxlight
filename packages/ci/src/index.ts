// @foxlight/ci — Public API
export { postPRComment, detectGitHubEnv, generateCommentBody, createCheckRun } from './github.js';
export type { GitHubConfig, CheckRunOptions } from './github.js';

export { postMRComment, detectGitLabEnv } from './gitlab.js';
export type { GitLabConfig } from './gitlab.js';

export { compareSnapshots, hasSignificantChanges } from './snapshot-comparator.js';
export type { CompareOptions, CompareResult } from './snapshot-comparator.js';
