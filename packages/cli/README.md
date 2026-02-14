# @foxlight/cli

Command-line interface for [Foxlight](https://github.com/josegabrielcruz/foxlight) — the open-source front-end intelligence platform.

## Installation

```bash
npm install -g @foxlight/cli
```

Or use via npx:

```bash
npx @foxlight/cli <command>
```

## Commands

### `foxlight init`

Initialize Foxlight in your project. Creates a `.foxlight.json` configuration file.

```bash
foxlight init
```

### `foxlight analyze`

Scan your project and discover components, imports, and dependencies.

```bash
foxlight analyze
foxlight analyze --json           # Output as JSON
foxlight analyze --root ./my-app  # Specify project root
```

### `foxlight health`

Show the component health dashboard with scores for bundle size, test coverage, accessibility, freshness, and performance.

```bash
foxlight health
foxlight health --component Button  # Filter to one component
foxlight health --json              # Output as JSON
```

### `foxlight cost`

Estimate hosting costs based on your bundle sizes across different providers.

```bash
foxlight cost
foxlight cost --provider vercel     # Specific provider
foxlight cost --json                # Output as JSON
```

### `foxlight upgrade <package>`

Analyze the impact of upgrading a dependency.

```bash
foxlight upgrade react
foxlight upgrade react --to 19.0.0  # Target specific version
foxlight upgrade --json              # Output as JSON
```

## Global Options

| Option         | Description                           |
| -------------- | ------------------------------------- |
| `--root <dir>` | Project root directory (default: `.`) |
| `--json`       | Output results as JSON                |
| `--help`       | Show help message                     |
| `--version`    | Show version number                   |

## Configuration

Create a `.foxlight.json` in your project root:

```json
{
  "include": ["src/**/*.{ts,tsx,js,jsx,vue,svelte}"],
  "exclude": ["**/*.test.*", "**/*.spec.*"],
  "framework": "react"
}
```

## License

MIT
