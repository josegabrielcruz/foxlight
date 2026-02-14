import { describe, it, expect } from 'vitest';
import { detectComponents, crossReferenceComponents } from './component-detector.js';
import { analyzeSource, type FileAnalysis } from './ast-scanner.js';
import type { ComponentInfo } from '@foxlight/core';

function analyzeReactSource(source: string, filePath = '/src/Test.tsx'): FileAnalysis {
  return analyzeSource(source, filePath);
}

describe('detectComponents', () => {
  it('should detect a React function component', () => {
    const analysis = analyzeReactSource(`
      export function Button({ label }: { label: string }) {
        return <button>{label}</button>;
      }
    `);

    const components = detectComponents(analysis, 'react');
    expect(components).toHaveLength(1);
    expect(components[0]!.name).toBe('Button');
    expect(components[0]!.framework).toBe('react');
  });

  it('should detect an arrow function component', () => {
    const analysis = analyzeReactSource(`
      export const Card = ({ title }: { title: string }) => {
        return <div>{title}</div>;
      };
    `);

    const components = detectComponents(analysis, 'react');
    expect(components).toHaveLength(1);
    expect(components[0]!.name).toBe('Card');
  });

  it('should not detect lowercase functions as components', () => {
    const analysis = analyzeReactSource(`
      export function helper() {
        return <div>helper</div>;
      }
    `);

    const components = detectComponents(analysis, 'react');
    expect(components).toHaveLength(0);
  });

  it('should not detect functions without JSX as components', () => {
    const analysis = analyzeReactSource(
      `
      export function FormatDate(date: Date) {
        return date.toISOString();
      }
    `,
      '/src/utils.ts',
    );

    const components = detectComponents(analysis, 'react');
    expect(components).toHaveLength(0);
  });

  it('should detect child component references from JSX', () => {
    const analysis = analyzeReactSource(`
      import { Button } from './Button';
      export function Toolbar() {
        return <div><Button label="Save" /><Button label="Cancel" /></div>;
      }
    `);

    const components = detectComponents(analysis, 'react');
    expect(components).toHaveLength(1);
    expect(components[0]!.children).toContain('Button');
  });

  it('should extract npm dependencies from imports', () => {
    const analysis = analyzeReactSource(`
      import React from 'react';
      import { motion } from 'framer-motion';
      import { Button } from './Button';
      export function AnimatedCard() {
        return <motion.div><Button /></motion.div>;
      }
    `);

    const components = detectComponents(analysis, 'react');
    expect(components).toHaveLength(1);
    expect(components[0]!.dependencies).toContain('react');
    expect(components[0]!.dependencies).toContain('framer-motion');
  });

  it('should set export kind correctly for default exports', () => {
    const analysis = analyzeReactSource(`
      export default function App() {
        return <div>Hello</div>;
      }
    `);

    const components = detectComponents(analysis, 'react');
    expect(components).toHaveLength(1);
    expect(components[0]!.exportKind).toBe('default');
  });

  it('should generate correct component IDs', () => {
    const analysis = analyzeReactSource(`
      export function MyComponent() {
        return <div>Hello</div>;
      }
    `);

    const components = detectComponents(analysis, 'react');
    expect(components[0]!.id).toBe('/src/Test.tsx#MyComponent');
  });

  it('should detect components for unknown frameworks when exported', () => {
    const analysis = analyzeReactSource(`
      export function Widget() {
        return <div>Widget</div>;
      }
      function Internal() {
        return <span>Internal</span>;
      }
    `);

    const components = detectComponents(analysis, 'unknown');
    expect(components).toHaveLength(1);
    expect(components[0]!.name).toBe('Widget');
  });
});

describe('crossReferenceComponents', () => {
  it('should populate usedBy fields', () => {
    const components: ComponentInfo[] = [
      {
        id: '/src/App.tsx#App',
        name: 'App',
        filePath: '/src/App.tsx',
        line: 1,
        framework: 'react',
        exportKind: 'default',
        props: [],
        children: ['Button', 'Card'],
        usedBy: [],
        dependencies: [],
        metadata: {},
      },
      {
        id: '/src/Button.tsx#Button',
        name: 'Button',
        filePath: '/src/Button.tsx',
        line: 1,
        framework: 'react',
        exportKind: 'named',
        props: [],
        children: [],
        usedBy: [],
        dependencies: [],
        metadata: {},
      },
      {
        id: '/src/Card.tsx#Card',
        name: 'Card',
        filePath: '/src/Card.tsx',
        line: 1,
        framework: 'react',
        exportKind: 'named',
        props: [],
        children: ['Button'],
        usedBy: [],
        dependencies: [],
        metadata: {},
      },
    ];

    const result = crossReferenceComponents(components);
    const button = result.find((c) => c.name === 'Button')!;
    const card = result.find((c) => c.name === 'Card')!;

    // Button is used by both App and Card
    expect(button.usedBy).toContain('/src/App.tsx#App');
    expect(button.usedBy).toContain('/src/Card.tsx#Card');

    // Card is used by App
    expect(card.usedBy).toContain('/src/App.tsx#App');
  });

  it('should resolve children names to IDs', () => {
    const components: ComponentInfo[] = [
      {
        id: '/src/App.tsx#App',
        name: 'App',
        filePath: '/src/App.tsx',
        line: 1,
        framework: 'react',
        exportKind: 'default',
        props: [],
        children: ['Button'],
        usedBy: [],
        dependencies: [],
        metadata: {},
      },
      {
        id: '/src/Button.tsx#Button',
        name: 'Button',
        filePath: '/src/Button.tsx',
        line: 1,
        framework: 'react',
        exportKind: 'named',
        props: [],
        children: [],
        usedBy: [],
        dependencies: [],
        metadata: {},
      },
    ];

    const result = crossReferenceComponents(components);
    const app = result.find((c) => c.name === 'App')!;

    // Children should now be component IDs, not just names
    expect(app.children).toContain('/src/Button.tsx#Button');
  });

  it('should handle components with no cross-references', () => {
    const components: ComponentInfo[] = [
      {
        id: '/src/Orphan.tsx#Orphan',
        name: 'Orphan',
        filePath: '/src/Orphan.tsx',
        line: 1,
        framework: 'react',
        exportKind: 'named',
        props: [],
        children: [],
        usedBy: [],
        dependencies: [],
        metadata: {},
      },
    ];

    const result = crossReferenceComponents(components);
    expect(result).toHaveLength(1);
    expect(result[0]!.usedBy).toHaveLength(0);
    expect(result[0]!.children).toHaveLength(0);
  });
});
