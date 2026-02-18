## Dashboard Integration Guide

This is a design sketch for integrating the dashboard with the Foxlight CLI.

### Integration Points

#### 1. CLI Command: `npx foxlight dashboard`

The CLI would expose a new command that:

- Starts the DashboardServer on localhost:3000 (or custom port)
- Automatically opens the browser
- Keeps the server running until user stops it (Ctrl+C)

```typescript
// In @foxlight/cli/src/commands/dashboard.ts

import { DashboardServer } from '@foxlight/dashboard/server';
import { getProjectRoot, loadConfig } from './utils.js';

export async function dashboardCommand(options: { port?: number; host?: string }) {
  const projectRoot = getProjectRoot();
  const server = new DashboardServer({ projectRoot, ...options });

  const url = await server.start();

  // Open browser automatically (optional)
  // openBrowser(url);

  // Keep running
  await new Promise(() => {}); // Never resolves
}
```

#### 2. Auto-save snapshots during analysis

When `npx foxlight analyze` runs, it should automatically save the results:

```typescript
// In @foxlight/cli/src/commands/analyze.ts

import { SnapshotStore } from '@foxlight/dashboard';

export async function analyzeCommand(options: { /* ... */ }) {
  const analyzer = new ProjectAnalyzer(config);
  const results = await analyzer.analyze();

  // Save to CLI output (existing)
  printResults(results);

  // Also save snapshot for dashboard (new)
  const snapshotStore = new SnapshotStore(projectRoot);
  await snapshotStore.saveSnapshot(results);

  return results;
}
```

#### 3. Display snapshot info in CLI

After analysis, show where the snapshot was saved:

```
✅ Analysis complete
📊 Results saved to .foxlight/snapshots/2025-02-17T14-30-22.json
🚀 View in dashboard: npx foxlight dashboard
```

### Package Dependencies

```
@foxlight/cli depends on:
  - @foxlight/core (existing)
  - @foxlight/analyzer (existing)
  - @foxlight/dashboard (new)
```

### File Structure Impact

```
packages/
├── cli/
│   └── src/
│       └── commands/
│           ├── analyze.ts (updated: auto-save snapshots)
│           ├── dashboard.ts (new: start server)
│           └── ...
├── dashboard/ (new)
│   ├── src/
│   │   ├── server/
│   │   │   ├── snapshot-store.ts
│   │   │   └── index.ts
│   │   ├── ui/
│   │   │   ├── app.tsx
│   │   │   ├── components/
│   │   │   ├── index.tsx
│   │   │   ├── index.css
│   │   │   └── public/
│   │   └── index.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── README.md
└── ...
```

### README Updates

Update main README to mention dashboard under "CLI Commands":

```markdown
| `foxlight dashboard` | Open local browser dashboard with health trends and bundle explorer |
```

And in a new section after CLI Commands:

```markdown
## Local Dashboard

For visual exploration of your components, use the local dashboard:

\`\`\`bash
npx foxlight dashboard
\`\`\`

This opens http://localhost:3000 with:

- **Health trends** over time
- **Bundle size** by component
- **Component grid** with top performers
- **Historical data** from recent analyses

Dashboard data is stored locally in `.foxlight/snapshots/` — no external services.
```

### Implementation Phases

**Phase 1 (MVP):**

- SnapshotStore working
- DashboardServer serving static assets
- 2-3 basic components (health trends, component grid)
- CLI integration with `npx foxlight dashboard`

**Phase 2:**

- More detailed views (dependency graph, coverage)
- Watch mode for auto-refresh
- Export/report generation

### Testing Strategy

1. **Unit tests** for SnapshotStore (file I/O, cleanup)
2. **Integration tests** for DashboardServer (routes, file serving)
3. **E2E** (optional) for full CLI → dashboard flow
4. **Manual QA** to verify React components render correctly

This keeps the dashboard isolated and optional—teams that don't need it never download the React dependencies.
