import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SnapshotDiff } from '@foxlight/core';

// -----------------------------------------------------------
// Mock global fetch for API calls
// -----------------------------------------------------------

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

import { detectGitLabEnv, postMRComment } from './gitlab.js';
import type { GitLabConfig } from './gitlab.js';

// -----------------------------------------------------------
// detectGitLabEnv
// -----------------------------------------------------------

describe('detectGitLabEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns empty config when no env vars are set', () => {
    delete process.env['GITLAB_TOKEN'];
    delete process.env['CI_JOB_TOKEN'];
    delete process.env['CI_PROJECT_ID'];
    delete process.env['CI_MERGE_REQUEST_IID'];
    delete process.env['CI_API_V4_URL'];

    const config = detectGitLabEnv();
    expect(config.token).toBeUndefined();
    expect(config.projectId).toBeUndefined();
    expect(config.mergeRequestIid).toBeUndefined();
    expect(config.apiUrl).toBe('https://gitlab.com/api/v4');
  });

  it('reads GITLAB_TOKEN', () => {
    process.env['GITLAB_TOKEN'] = 'glpat-abc123';
    const config = detectGitLabEnv();
    expect(config.token).toBe('glpat-abc123');
  });

  it('falls back to CI_JOB_TOKEN', () => {
    delete process.env['GITLAB_TOKEN'];
    process.env['CI_JOB_TOKEN'] = 'job-token-xyz';
    const config = detectGitLabEnv();
    expect(config.token).toBe('job-token-xyz');
  });

  it('prefers GITLAB_TOKEN over CI_JOB_TOKEN', () => {
    process.env['GITLAB_TOKEN'] = 'glpat-preferred';
    process.env['CI_JOB_TOKEN'] = 'job-token-fallback';
    const config = detectGitLabEnv();
    expect(config.token).toBe('glpat-preferred');
  });

  it('reads project ID and merge request IID', () => {
    process.env['CI_PROJECT_ID'] = '12345';
    process.env['CI_MERGE_REQUEST_IID'] = '42';
    const config = detectGitLabEnv();
    expect(config.projectId).toBe('12345');
    expect(config.mergeRequestIid).toBe(42);
  });

  it('reads custom API URL', () => {
    process.env['CI_API_V4_URL'] = 'https://gitlab.mycompany.com/api/v4';
    const config = detectGitLabEnv();
    expect(config.apiUrl).toBe('https://gitlab.mycompany.com/api/v4');
  });
});

// -----------------------------------------------------------
// postMRComment
// -----------------------------------------------------------

describe('postMRComment', () => {
  const config: GitLabConfig = {
    token: 'glpat-test-token',
    projectId: '99',
    mergeRequestIid: 7,
    apiUrl: 'https://gitlab.example.com/api/v4',
  };

  const diff: SnapshotDiff = {
    base: { id: 'base', commitSha: 'aaa' },
    head: { id: 'head', commitSha: 'bbb' },
    components: { added: [], removed: [], modified: [] },
    bundleDiff: [],
    healthDiff: [],
  };

  beforeEach(() => {
    fetchMock.mockReset();
  });

  it('creates a new note when no existing note is found', async () => {
    // First call: list notes → no foxlight note
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: 1, body: 'unrelated comment' }],
    });
    // Second call: POST new note
    fetchMock.mockResolvedValueOnce({ ok: true });

    await postMRComment(config, diff);

    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Check the POST call
    const postCall = fetchMock.mock.calls[1]!;
    expect(postCall[0]).toContain('/notes');
    expect(postCall[1]!.method).toBe('POST');
    expect(postCall[1]!.headers['PRIVATE-TOKEN']).toBe('glpat-test-token');

    const body = JSON.parse(postCall[1]!.body as string);
    expect(body.body).toContain('<!-- foxlight-report -->');
  });

  it('updates existing note when foxlight comment exists', async () => {
    // First call: list notes → found foxlight note
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { id: 42, body: '<!-- foxlight-report -->\nOld report' },
        { id: 1, body: 'unrelated' },
      ],
    });
    // Second call: PUT to update
    fetchMock.mockResolvedValueOnce({ ok: true });

    await postMRComment(config, diff);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const putCall = fetchMock.mock.calls[1]!;
    expect(putCall[0]).toContain('/notes/42');
    expect(putCall[1]!.method).toBe('PUT');
  });

  it('creates new note when listing notes fails', async () => {
    // First call: list notes → API failure
    fetchMock.mockResolvedValueOnce({ ok: false });
    // Second call: POST new note
    fetchMock.mockResolvedValueOnce({ ok: true });

    await postMRComment(config, diff);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const postCall = fetchMock.mock.calls[1]!;
    expect(postCall[1]!.method).toBe('POST');
  });

  it('uses default API URL when not specified', async () => {
    const configNoUrl: GitLabConfig = {
      token: 'test',
      projectId: '1',
      mergeRequestIid: 1,
    };

    fetchMock.mockResolvedValueOnce({ ok: false });
    fetchMock.mockResolvedValueOnce({ ok: true });

    await postMRComment(configNoUrl, diff);

    const listCall = fetchMock.mock.calls[0]!;
    expect(listCall[0]).toContain('https://gitlab.com/api/v4');
  });
});
