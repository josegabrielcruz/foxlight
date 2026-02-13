import { describe, it, expect } from "vitest";
import { analyzeSource } from "./ast-scanner.js";

describe("AST Scanner", () => {
  it("should extract named imports", () => {
    const source = `
      import { useState, useEffect } from "react";
      import { Button } from "./Button";
    `;
    const result = analyzeSource(source, "/test/App.tsx");

    expect(result.imports).toHaveLength(2);
    expect(result.imports[0]!.target).toBe("react");
    expect(result.imports[0]!.specifiers).toEqual([
      { imported: "useState", local: "useState" },
      { imported: "useEffect", local: "useEffect" },
    ]);
    expect(result.imports[1]!.target).toBe("./Button");
  });

  it("should extract default imports", () => {
    const source = `import React from "react";`;
    const result = analyzeSource(source, "/test/App.tsx");

    expect(result.imports[0]!.specifiers).toEqual([
      { imported: "default", local: "React" },
    ]);
  });

  it("should extract namespace imports", () => {
    const source = `import * as Icons from "./icons";`;
    const result = analyzeSource(source, "/test/App.tsx");

    expect(result.imports[0]!.specifiers).toEqual([
      { imported: "*", local: "Icons" },
    ]);
  });

  it("should detect type-only imports", () => {
    const source = `import type { ButtonProps } from "./Button";`;
    const result = analyzeSource(source, "/test/App.tsx");

    expect(result.imports[0]!.typeOnly).toBe(true);
  });

  it("should detect JSX elements", () => {
    const source = `
      function App() {
        return (
          <div className="app">
            <Button label="Click" />
            <Card title="Hello">
              <span>Content</span>
            </Card>
          </div>
        );
      }
    `;
    const result = analyzeSource(source, "/test/App.tsx");

    expect(result.hasJsx).toBe(true);

    const componentElements = result.jsxElements.filter((el) => el.isComponent);
    const nativeElements = result.jsxElements.filter((el) => !el.isComponent);

    expect(componentElements.map((e) => e.tagName)).toContain("Button");
    expect(componentElements.map((e) => e.tagName)).toContain("Card");
    expect(nativeElements.map((e) => e.tagName)).toContain("div");
  });

  it("should extract JSX element props", () => {
    const source = `
      function App() {
        return <Button label="Click" variant="primary" disabled />;
      }
    `;
    const result = analyzeSource(source, "/test/App.tsx");

    const button = result.jsxElements.find((e) => e.tagName === "Button");
    expect(button?.props).toEqual(
      expect.arrayContaining(["label", "variant", "disabled"])
    );
  });

  it("should detect function declarations that return JSX", () => {
    const source = `
      export function Button(props: ButtonProps) {
        return <button>{props.label}</button>;
      }

      function helperFn() {
        return 42;
      }
    `;
    const result = analyzeSource(source, "/test/Button.tsx");

    expect(result.functionDeclarations).toHaveLength(2);

    const button = result.functionDeclarations.find((f) => f.name === "Button");
    expect(button?.returnsJsx).toBe(true);
    expect(button?.isExported).toBe(true);

    const helper = result.functionDeclarations.find(
      (f) => f.name === "helperFn"
    );
    expect(helper?.returnsJsx).toBe(false);
    expect(helper?.isExported).toBe(false);
  });

  it("should detect arrow function components", () => {
    const source = `
      export const Card = ({ title }: CardProps) => {
        return <div className="card">{title}</div>;
      };
    `;
    const result = analyzeSource(source, "/test/Card.tsx");

    const card = result.functionDeclarations.find((f) => f.name === "Card");
    expect(card).toBeDefined();
    expect(card?.returnsJsx).toBe(true);
    expect(card?.isArrowFunction).toBe(true);
    expect(card?.isExported).toBe(true);
  });

  it("should extract exports", () => {
    const source = `
      export function Button() { return <button />; }
      export default function App() { return <div />; }
      export const CONSTANT = 42;
    `;
    const result = analyzeSource(source, "/test/App.tsx");

    const buttonExport = result.exports.find((e) => e.name === "Button");
    expect(buttonExport?.isDefault).toBe(false);
    expect(buttonExport?.kind).toBe("function");

    const appExport = result.exports.find((e) => e.name === "App");
    expect(appExport?.isDefault).toBe(true);
  });
});
