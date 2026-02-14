# @foxlight/ci

CI/CD integration for [Foxlight](https://github.com/josegabrielcruz/foxlight) — the open-source front-end intelligence platform.

## What's Inside

- **GitHub Integration** — PR comments with component/bundle/health diffs, Check Runs API with pass/fail annotations
- **GitLab Integration** — merge request notes with the same diff tables
- **Snapshot Comparator** — captures project state and detects significant changes between snapshots

## Installation

```bash
npm install @foxlight/ci
```

## GitHub Actions

```yaml
# .github/workflows/foxlight.yml
name: Foxlight
on: [pull_request]

jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx foxlight ci
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## GitLab CI

```yaml
# .gitlab-ci.yml
foxlight:
  script:
    - npm ci
    - npx foxlight ci
  rules:
    - if: $CI_MERGE_REQUEST_IID
```

## Programmatic API

```typescript
import {
  postPRComment,
  createCheckRun,
  detectGitHubEnv,
  postMRComment,
  detectGitLabEnv,
} from '@foxlight/ci';

// GitHub — post a PR comment
const env = detectGitHubEnv();
if (env) {
  await postPRComment(env, snapshotDiff);
  await createCheckRun({
    ...env,
    name: 'Foxlight Analysis',
    diff: snapshotDiff,
  });
}

// GitLab — post an MR note
const gitlabEnv = detectGitLabEnv();
if (gitlabEnv) {
  await postMRComment(gitlabEnv, snapshotDiff);
}
```

## License

MIT
