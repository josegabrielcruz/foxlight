import { describe, it, expect } from 'vitest';
import { parseSvelteFile, svelteFileToComponentInfo } from './svelte-parser.js';

describe('parseSvelteFile', () => {
  it('extracts name from filename', () => {
    const result = parseSvelteFile('<div>Hello</div>', '/src/my-button.svelte');
    expect(result.name).toBe('MyButton');
  });

  it('extracts instance script content', () => {
    const source = `
<script>
  let count = 0;
  function increment() { count += 1; }
</script>
<button on:click={increment}>{count}</button>
`;
    const result = parseSvelteFile(source, '/src/Counter.svelte');
    expect(result.scriptContent).toContain('let count = 0');
    expect(result.moduleScriptContent).toBeNull();
  });

  it('extracts module-level script', () => {
    const source = `
<script context="module">
  export const CONSTANT = 42;
</script>
<script>
  let value = CONSTANT;
</script>
<p>{value}</p>
`;
    const result = parseSvelteFile(source, '/src/Mod.svelte');
    expect(result.moduleScriptContent).toContain('CONSTANT = 42');
    expect(result.scriptContent).toContain('let value');
  });

  it('extracts template content (strips script and style)', () => {
    const source = `
<script>let x = 1;</script>
<div class="wrapper"><span>{x}</span></div>
<style>.wrapper { color: red; }</style>
`;
    const result = parseSvelteFile(source, '/src/A.svelte');
    expect(result.templateContent).toContain('<div class="wrapper">');
    expect(result.templateContent).not.toContain('<script');
    expect(result.templateContent).not.toContain('<style');
  });

  it('detects styles', () => {
    const source = `<div /><style>.foo { color: red; }</style>`;
    const result = parseSvelteFile(source, '/src/A.svelte');
    expect(result.hasStyles).toBe(true);
  });

  it('detects no styles', () => {
    const source = `<div />`;
    const result = parseSvelteFile(source, '/src/A.svelte');
    expect(result.hasStyles).toBe(false);
  });

  it('extracts imports from script blocks', () => {
    const source = `
<script>
  import { onMount } from 'svelte';
  import Button from './Button.svelte';
  onMount(() => {});
</script>
<Button />
`;
    const result = parseSvelteFile(source, '/src/App.svelte');
    expect(result.imports).toHaveLength(2);
    expect(result.imports[0]!.target).toBe('svelte');
    expect(result.imports[1]!.target).toBe('./Button.svelte');
  });

  it('extracts export let props', () => {
    const source = `
<script>
  export let name;
  export let count = 0;
  export let active = true;
</script>
<p>{name}: {count}</p>
`;
    const result = parseSvelteFile(source, '/src/Display.svelte');
    expect(result.props).toHaveLength(3);

    expect(result.props[0]!.name).toBe('name');
    expect(result.props[0]!.required).toBe(true);

    expect(result.props[1]!.name).toBe('count');
    expect(result.props[1]!.required).toBe(false);
    expect(result.props[1]!.defaultValue).toBe('0');
    expect(result.props[1]!.type).toBe('number');

    expect(result.props[2]!.name).toBe('active');
    expect(result.props[2]!.type).toBe('boolean');
  });

  it('extracts typed export let props', () => {
    const source = `
<script lang="ts">
  export let title: string;
  export let visible: boolean = false;
</script>
<h1>{title}</h1>
`;
    const result = parseSvelteFile(source, '/src/Header.svelte');
    expect(result.props).toHaveLength(2);
    expect(result.props[0]!.name).toBe('title');
    expect(result.props[0]!.type).toBe('string');
    expect(result.props[0]!.required).toBe(true);
    expect(result.props[1]!.name).toBe('visible');
    expect(result.props[1]!.type).toBe('boolean');
    expect(result.props[1]!.required).toBe(false);
  });

  it('extracts child components from template', () => {
    const source = `
<script>
  import Button from './Button.svelte';
  import Card from './Card.svelte';
</script>
<div>
  <Button label="Click me" />
  <Card title="Hello">
    <p>content</p>
  </Card>
</div>
`;
    const result = parseSvelteFile(source, '/src/Page.svelte');
    expect(result.childComponents).toContain('Button');
    expect(result.childComponents).toContain('Card');
    expect(result.childComponents).not.toContain('div');
    expect(result.childComponents).not.toContain('p');
  });

  it('handles file with no script block', () => {
    const source = '<h1>Static Content</h1>';
    const result = parseSvelteFile(source, '/src/Static.svelte');
    expect(result.scriptContent).toBeNull();
    expect(result.moduleScriptContent).toBeNull();
    expect(result.imports).toHaveLength(0);
    expect(result.props).toHaveLength(0);
  });

  it('infers types from default values', () => {
    const source = `
<script>
  export let text = 'hello';
  export let items = [];
  export let config = {};
  export let nothing = null;
</script>
<p>{text}</p>
`;
    const result = parseSvelteFile(source, '/src/Infer.svelte');
    expect(result.props[0]!.type).toBe('string');
    expect(result.props[1]!.type).toBe('array');
    expect(result.props[2]!.type).toBe('object');
    expect(result.props[3]!.type).toBe('null');
  });
});

describe('svelteFileToComponentInfo', () => {
  it('produces a valid ComponentInfo', () => {
    const source = `
<script>
  import { onMount } from 'svelte';
  import Child from './Child.svelte';
  export let label;
</script>
<Child>{label}</Child>
`;
    const analysis = parseSvelteFile(source, '/src/Parent.svelte');
    const info = svelteFileToComponentInfo(analysis, '/src/Parent.svelte');

    expect(info.id).toBe('/src/Parent.svelte#Parent');
    expect(info.name).toBe('Parent');
    expect(info.framework).toBe('svelte');
    expect(info.exportKind).toBe('default');
    expect(info.children).toContain('Child');
    expect(info.dependencies).toContain('svelte');
    expect(info.props).toHaveLength(1);
    expect(info.props[0]!.name).toBe('label');
    expect(info.metadata).toHaveProperty('hasModuleScript', false);
  });
});
