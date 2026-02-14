// ============================================================
// @foxlight/cli — Cost command
//
// Estimates hosting costs based on component bundle sizes
// across different cloud providers (Vercel, Netlify, AWS,
// Cloudflare).
// ============================================================

import { analyzeProject } from '@foxlight/analyzer';
import {
  estimateMonthlyCost,
  COST_MODELS,
  DEFAULT_TRAFFIC,
  type TrafficProfile,
} from '@foxlight/core';
import { formatBytes } from '@foxlight/bundle';
import { ui } from '../utils/output.js';

export interface CostOptions {
  rootDir: string;
  json?: boolean;
  provider?: string;
  pageViews?: number;
}

export async function runCost(options: CostOptions): Promise<void> {
  const { rootDir, json, provider, pageViews } = options;

  ui.progress('Analyzing project for cost estimation');
  const result = await analyzeProject(rootDir);
  ui.progressDone('Analysis complete');

  const components = result.registry.getAllComponents();

  if (components.length === 0) {
    ui.warn('No components found. Run `foxlight analyze` to check your config.');
    return;
  }

  // Gather bundle info for all components
  const bundleInfos = components
    .map((comp) => result.registry.getBundleInfo(comp.id))
    .filter((info) => info !== undefined);

  // Use synthetic bundle info if no real data exists (from size tracker)
  const hasBundleData = bundleInfos.length > 0;

  const traffic: TrafficProfile = {
    ...DEFAULT_TRAFFIC,
    ...(pageViews ? { monthlyPageViews: pageViews } : {}),
  };

  // Select which providers to show
  const providers = provider
    ? { [provider]: COST_MODELS[provider] }
    : COST_MODELS;

  if (provider && !COST_MODELS[provider]) {
    ui.error(`Unknown provider: ${provider}`);
    ui.info('Available providers:', Object.keys(COST_MODELS).join(', '));
    return;
  }

  const estimates: Record<string, number> = {};
  for (const [name, model] of Object.entries(providers)) {
    if (!model) continue;
    estimates[name] = estimateMonthlyCost(bundleInfos, model, traffic);
  }

  if (json) {
    console.log(
      JSON.stringify(
        {
          components: components.length,
          hasBundleData,
          traffic,
          estimates,
        },
        null,
        2,
      ),
    );
    return;
  }

  ui.heading('Cost Estimation');

  ui.info('Components:', String(components.length));
  ui.info('Bundle data:', hasBundleData ? 'available' : 'not yet available — run a build with the Foxlight plugin first');
  ui.info(
    'Traffic assumption:',
    `${formatNumber(traffic.monthlyPageViews)} page views/month`,
  );

  if (bundleInfos.length > 0) {
    const totalRaw = bundleInfos.reduce((sum, b) => sum + b.selfSize.raw, 0);
    const totalGzip = bundleInfos.reduce((sum, b) => sum + b.selfSize.gzip, 0);
    ui.info('Total bundle size:', `${formatBytes(totalRaw)} (${formatBytes(totalGzip)} gzip)`);
  }

  ui.heading('Estimated Monthly Cost by Provider');

  const widths = [16, 14];
  ui.tableHeader(['Provider', 'Monthly Cost'], widths);

  for (const [name, cost] of Object.entries(estimates)) {
    ui.row([capitalize(name), formatCurrency(cost)], widths);
  }

  ui.gap();
  ui.info(
    'Note:',
    'Estimates are based on bundle size and traffic assumptions. Actual costs vary.',
  );
  ui.gap();
}

function formatCurrency(amount: number): string {
  if (amount < 0.01) return '< $0.01';
  return `$${amount.toFixed(2)}`;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(Math.round(n));
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
