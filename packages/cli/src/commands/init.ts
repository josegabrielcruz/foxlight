// ============================================================
// @pulse/cli — Init command
//
// Initializes Pulse in a project by creating a pulse.config.ts
// file with auto-detected settings.
// ============================================================

import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { detectFramework } from "@pulse/core";
import { ui } from "../utils/output.js";

export interface InitOptions {
  rootDir: string;
}

export async function runInit(options: InitOptions): Promise<void> {
  const { rootDir } = options;
  const configPath = join(rootDir, "pulse.config.ts");

  if (existsSync(configPath)) {
    ui.warn("pulse.config.ts already exists. Skipping initialization.");
    return;
  }

  ui.progress("Detecting project settings");
  const framework = await detectFramework(rootDir);
  ui.progressDone(`Detected framework: ${framework}`);

  const configContent = generateConfig(framework);

  await writeFile(configPath, configContent, "utf-8");

  ui.success(`Created ${configPath}`);
  ui.gap();
  ui.info("Next steps:", "");
  ui.info("  1.", "Review pulse.config.ts and adjust settings");
  ui.info("  2.", "Run `pulse analyze` to scan your project");
  ui.info("  3.", "Run `pulse health` to see component health scores");
  ui.gap();
}

function generateConfig(framework: string): string {
  return `import type { PulseConfig } from "@pulse/core";

const config: PulseConfig = {
  rootDir: ".",

  // Source files to analyze
  include: [
    "src/**/*.{tsx,jsx,vue,svelte}",
    "components/**/*.{tsx,jsx,vue,svelte}",
    "app/**/*.{tsx,jsx,vue,svelte}",
  ],

  // Files to exclude
  exclude: [
    "**/node_modules/**",
    "**/dist/**",
    "**/*.test.*",
    "**/*.spec.*",
    "**/*.stories.*",
  ],

  // Auto-detected framework: "${framework}"
  // Uncomment to override:
  // framework: "${framework}",

  // Cost model (uncomment and configure for cost analysis)
  // costModel: {
  //   provider: "vercel",
  //   invocationCostPer1M: 0.60,
  //   bandwidthCostPerGB: 0.15,
  //   storageCostPerGB: 0.023,
  //   baseCost: 0,
  // },

  // Baseline storage for visual regression (uncomment to configure)
  // baselines: {
  //   provider: "s3",
  //   bucket: "my-pulse-baselines",
  //   prefix: "visual",
  // },
};

export default config;
`;
}
