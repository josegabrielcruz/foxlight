import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { loadConfig, createDefaultConfig, detectFramework } from './config.js';

describe('createDefaultConfig', () => {
  it('should return a valid config with defaults', () => {
    const config = createDefaultConfig('/test/project');
    expect(config.rootDir).toContain('test/project');
    expect(config.include.length).toBeGreaterThan(0);
    expect(config.exclude.length).toBeGreaterThan(0);
  });

  it('should include common source directories in patterns', () => {
    const config = createDefaultConfig('/test');
    const includeStr = config.include.join(' ');
    expect(includeStr).toContain('src/');
    expect(includeStr).toContain('components/');
  });

  it('should exclude common non-source directories', () => {
    const config = createDefaultConfig('/test');
    const excludeStr = config.exclude.join(' ');
    expect(excludeStr).toContain('node_modules');
    expect(excludeStr).toContain('dist');
  });
});

describe('detectFramework', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'foxlight-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should detect React', async () => {
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({
        dependencies: { react: '^18.0.0', 'react-dom': '^18.0.0' },
      }),
    );
    const framework = await detectFramework(tempDir);
    expect(framework).toBe('react');
  });

  it('should detect Vue', async () => {
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({
        dependencies: { vue: '^3.0.0' },
      }),
    );
    const framework = await detectFramework(tempDir);
    expect(framework).toBe('vue');
  });

  it('should detect Svelte', async () => {
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({
        devDependencies: { svelte: '^4.0.0' },
      }),
    );
    const framework = await detectFramework(tempDir);
    expect(framework).toBe('svelte');
  });

  it('should detect Angular', async () => {
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({
        dependencies: { '@angular/core': '^17.0.0' },
      }),
    );
    const framework = await detectFramework(tempDir);
    expect(framework).toBe('angular');
  });

  it('should detect web-component via lit', async () => {
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({
        dependencies: { lit: '^3.0.0' },
      }),
    );
    const framework = await detectFramework(tempDir);
    expect(framework).toBe('web-component');
  });

  it('should return unknown when no package.json exists', async () => {
    const framework = await detectFramework(tempDir);
    expect(framework).toBe('unknown');
  });

  it('should return unknown when no framework deps are found', async () => {
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({
        dependencies: { lodash: '^4.0.0' },
      }),
    );
    const framework = await detectFramework(tempDir);
    expect(framework).toBe('unknown');
  });
});

describe('loadConfig', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'foxlight-config-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should return defaults when no config file exists', async () => {
    // Create a package.json with react
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({ dependencies: { react: '^18.0.0' } }),
    );

    const config = await loadConfig(tempDir);
    expect(config.rootDir).toBe(tempDir);
    expect(config.include.length).toBeGreaterThan(0);
    expect(config.framework).toBe('react');
  });

  it('should load a JSON config file', async () => {
    await writeFile(
      join(tempDir, 'foxlight.config.json'),
      JSON.stringify({
        include: ['custom/**/*.tsx'],
        framework: 'vue',
      }),
    );

    const config = await loadConfig(tempDir);
    expect(config.include).toEqual(['custom/**/*.tsx']);
    expect(config.framework).toBe('vue');
  });
});
