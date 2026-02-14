import { describe, it, expect } from 'vitest';
import { parseVueSFC, vueSFCToComponentInfo } from './vue-parser.js';

describe('parseVueSFC', () => {
  it('extracts name from filename', () => {
    const result = parseVueSFC('<template><div /></template>', '/src/my-button.vue');
    expect(result.name).toBe('MyButton');
  });

  it('detects <script setup>', () => {
    const sfc = `
<script setup lang="ts">
import { ref } from 'vue';
const count = ref(0);
</script>
<template><button>{{ count }}</button></template>
`;
    const result = parseVueSFC(sfc, '/src/Counter.vue');
    expect(result.isScriptSetup).toBe(true);
    expect(result.scriptContent).toContain('ref(0)');
  });

  it('extracts non-setup script', () => {
    const sfc = `
<script lang="ts">
export default { name: 'Foo' };
</script>
<template><div /></template>
`;
    const result = parseVueSFC(sfc, '/src/Foo.vue');
    expect(result.isScriptSetup).toBe(false);
    expect(result.scriptContent).toContain('export default');
  });

  it('extracts template content', () => {
    const sfc = `
<template>
  <div class="wrapper"><span>Hello</span></div>
</template>
<script setup></script>
`;
    const result = parseVueSFC(sfc, '/src/Hello.vue');
    expect(result.templateContent).toContain('<div class="wrapper">');
  });

  it('detects scoped styles', () => {
    const sfc = `
<template><div /></template>
<style scoped>.foo { color: red; }</style>
`;
    const result = parseVueSFC(sfc, '/src/A.vue');
    expect(result.hasScopedStyles).toBe(true);
  });

  it('detects non-scoped styles', () => {
    const sfc = `
<template><div /></template>
<style>.foo { color: red; }</style>
`;
    const result = parseVueSFC(sfc, '/src/A.vue');
    expect(result.hasScopedStyles).toBe(false);
  });

  it('extracts imports from script', () => {
    const sfc = `
<script setup lang="ts">
import { ref, computed } from 'vue';
import MyComponent from './MyComponent.vue';
</script>
<template><MyComponent /></template>
`;
    const result = parseVueSFC(sfc, '/src/App.vue');
    expect(result.imports).toHaveLength(2);
    expect(result.imports[0]!.target).toBe('vue');
    expect(result.imports[0]!.specifiers).toHaveLength(2);
    expect(result.imports[1]!.target).toBe('./MyComponent.vue');
  });

  it('extracts defineProps with object syntax', () => {
    const sfc = `
<script setup>
defineProps({ label: String, count: Number })
</script>
<template><span>{{ label }}</span></template>
`;
    const result = parseVueSFC(sfc, '/src/Label.vue');
    expect(result.props).toHaveLength(2);
    expect(result.props[0]!.name).toBe('label');
    expect(result.props[1]!.name).toBe('count');
  });

  it('extracts defineProps with generic type syntax', () => {
    const sfc = `
<script setup lang="ts">
defineProps<{ title: string; visible?: boolean }>()
</script>
<template><h1>{{ title }}</h1></template>
`;
    const result = parseVueSFC(sfc, '/src/Header.vue');
    expect(result.props).toHaveLength(2);
    expect(result.props[0]!.name).toBe('title');
    expect(result.props[0]!.type).toBe('string');
    expect(result.props[0]!.required).toBe(true);
    expect(result.props[1]!.name).toBe('visible');
    expect(result.props[1]!.required).toBe(false);
  });

  it('extracts child components from template (PascalCase)', () => {
    const sfc = `
<template>
  <div>
    <MyButton @click="handleClick" />
    <IconAlert v-if="showAlert" />
    <span>plain text</span>
  </div>
</template>
<script setup></script>
`;
    const result = parseVueSFC(sfc, '/src/Page.vue');
    expect(result.childComponents).toContain('MyButton');
    expect(result.childComponents).toContain('IconAlert');
    expect(result.childComponents).not.toContain('div');
    expect(result.childComponents).not.toContain('span');
  });

  it('extracts child components from template (kebab-case)', () => {
    const sfc = `
<template>
  <div>
    <my-button />
    <icon-alert />
  </div>
</template>
<script setup></script>
`;
    const result = parseVueSFC(sfc, '/src/Page.vue');
    expect(result.childComponents).toContain('MyButton');
    expect(result.childComponents).toContain('IconAlert');
  });

  it('handles file with no script block', () => {
    const sfc = '<template><div>Hello</div></template>';
    const result = parseVueSFC(sfc, '/src/Static.vue');
    expect(result.scriptContent).toBeNull();
    expect(result.imports).toHaveLength(0);
    expect(result.props).toHaveLength(0);
  });
});

describe('vueSFCToComponentInfo', () => {
  it('produces a valid ComponentInfo', () => {
    const sfc = `
<script setup lang="ts">
import { ref } from 'vue';
import ChildComp from './ChildComp.vue';
defineProps<{ label: string }>()
</script>
<template><ChildComp>{{ label }}</ChildComp></template>
`;
    const analysis = parseVueSFC(sfc, '/src/Parent.vue');
    const info = vueSFCToComponentInfo(analysis, '/src/Parent.vue');

    expect(info.id).toBe('/src/Parent.vue#Parent');
    expect(info.name).toBe('Parent');
    expect(info.framework).toBe('vue');
    expect(info.exportKind).toBe('default');
    expect(info.children).toContain('ChildComp');
    expect(info.dependencies).toContain('vue');
    expect(info.props).toHaveLength(1);
    expect(info.metadata).toHaveProperty('isScriptSetup', true);
  });
});
