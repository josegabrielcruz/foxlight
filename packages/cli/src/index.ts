#!/usr/bin/env node
// ============================================================
// @pulse/cli — Entry point
//
// Routes commands to their handlers.
// Usage:
//   pulse init          — Initialize Pulse in a project
//   pulse analyze       — Scan project and discover components
//   pulse health        — Show component health dashboard
//   pulse analyze --json — Output analysis as JSON
// ============================================================

import { resolve } from "node:path";
import { runAnalyze } from "./commands/analyze.js";
import { runHealth } from "./commands/health.js";
import { runInit } from "./commands/init.js";
import { ui } from "./utils/output.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  // Parse flags
  const flags = new Map<string, string>();
  for (let i = 1; i < args.length; i++) {
    const arg = args[i]!;
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];
      const value = nextArg && !nextArg.startsWith("--") ? nextArg : "true";
      flags.set(key, value);
      if (value !== "true") i++;
    }
  }

  const rootDir = resolve(flags.get("root") ?? flags.get("dir") ?? ".");
  const json = flags.has("json");

  ui.banner();

  switch (command) {
    case "init":
      await runInit({ rootDir });
      break;

    case "analyze":
    case "scan":
      await runAnalyze({ rootDir, json });
      break;

    case "health":
    case "dashboard":
      await runHealth({
        rootDir,
        json,
        component: flags.get("component") ?? flags.get("c"),
      });
      break;

    case "help":
    case "--help":
    case "-h":
    case undefined:
      printHelp();
      break;

    case "version":
    case "--version":
    case "-v":
      console.log("  pulse v0.1.0");
      break;

    default:
      ui.error(`Unknown command: ${command}`);
      ui.gap();
      printHelp();
      process.exitCode = 1;
  }
}

function printHelp(): void {
  console.log("  Usage: pulse <command> [options]");
  console.log("");
  console.log("  Commands:");
  console.log("    init              Initialize Pulse in your project");
  console.log("    analyze           Scan project and discover components");
  console.log("    health            Show component health dashboard");
  console.log("");
  console.log("  Options:");
  console.log("    --root <dir>      Project root directory (default: .)");
  console.log("    --json            Output results as JSON");
  console.log("    --component <name> Filter health to a specific component");
  console.log("    --help            Show this help message");
  console.log("    --version         Show version number");
  console.log("");
}

main().catch((error: unknown) => {
  ui.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
