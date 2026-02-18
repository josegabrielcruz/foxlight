# @foxlight/dashboard

Optional browser-based dashboard for visualizing Foxlight analysis results locally.

## Overview

The dashboard provides a local web interface for exploring component health, bundle sizes, and trends over time. It's completely optional and only for local development—no data is sent anywhere.

**Key features:**

- 📊 **Health trends** — visualize component health scores over time
- 📦 **Bundle explorer** — see which components consume the most bundle size
- 💾 **Local history** — snapshots stored in `.foxlight/snapshots/`
- 🔄 **No external services** — runs entirely on your machine

## Installation

The dashboard is included with `@foxlight/cli`:

```bash
npm install @foxlight/cli
```

## Usage

### Start the dashboard

```bash
npx foxlight analyze     # First, run an analysis
npx foxlight dashboard   # Then start the dashboard
```

The dashboard opens at `http://localhost:3000` and reads historical snapshots from `.foxlight/snapshots/`.

### Command options

```bash
npx foxlight dashboard --port 3001    # Use custom port
npx foxlight dashboard --host 0.0.0.0 # Bind to all interfaces
```

## How it works

1. When you run `npx foxlight analyze`, results are automatically saved as a snapshot
2. The dashboard reads these snapshots from `.foxlight/snapshots/`
3. Each snapshot is stored as JSON with a timestamp
4. Only the last 30 snapshots are kept (older ones are auto-deleted)

## Architecture

```
server/
  ├── snapshot-store.ts   — Manages reading/writing snapshot JSON
  └── index.ts            — Express app with /api routes

ui/
  ├── app.tsx             — Main React component
  ├── components/
  │   ├── health-trends.tsx   — Line chart of health over time
  │   ├── component-grid.tsx  — Grid of component health cards
  │   └── bundle-explorer.tsx — Bar chart of bundle sizes
  ├── index.tsx           — React entry point
  ├── index.css           — Tailwind styles
  └── public/index.html   — HTML shell
```

## Build

The dashboard is built with:

- **Server**: tsup (TypeScript compiler)
- **Frontend**: Vite + React + Recharts

Build both:

```bash
npm run build
```

This produces:

- `dist/index.js` and `dist/server/index.js` — compiled server code
- `dist/ui/` — compiled React app

## API

The dashboard exposes a simple API that could be consumed by other tools:

- `GET /api/analysis/latest` — Latest snapshot
- `GET /api/analysis/history?limit=30` — Last N snapshots
- `POST /api/analysis/save` — Save a new snapshot

## Limitations

- **Local only** — designed for single developers, not team dashboards
- **Browser-based** — requires a modern browser with JavaScript enabled
- **Limited history** — keeps last 30 snapshots by default (configurable)
- **No authentication** — runs on localhost, not meant for shared networks

## Future enhancements

- [ ] Configurable snapshot retention
- [ ] Export/import snapshots
- [ ] Markdown report generation
- [ ] Dark mode
- [ ] Watch mode for auto-updates during development
