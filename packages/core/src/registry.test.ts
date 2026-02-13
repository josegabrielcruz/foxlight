import { describe, it, expect, beforeEach } from "vitest";
import { ComponentRegistry } from "./registry.js";
import type { ComponentInfo } from "./types.js";

function makeComponent(overrides: Partial<ComponentInfo> = {}): ComponentInfo {
  return {
    id: "test/Button",
    name: "Button",
    filePath: "/src/components/Button.tsx",
    line: 1,
    framework: "react",
    exportKind: "named",
    props: [],
    children: [],
    usedBy: [],
    dependencies: [],
    metadata: {},
    ...overrides,
  };
}

describe("ComponentRegistry", () => {
  let registry: ComponentRegistry;

  beforeEach(() => {
    registry = new ComponentRegistry();
  });

  it("should add and retrieve a component", () => {
    const button = makeComponent();
    registry.addComponent(button);

    expect(registry.getComponent("test/Button")).toEqual(button);
    expect(registry.size).toBe(1);
  });

  it("should add multiple components", () => {
    const button = makeComponent({ id: "Button", name: "Button" });
    const card = makeComponent({ id: "Card", name: "Card" });
    registry.addComponents([button, card]);

    expect(registry.size).toBe(2);
    expect(registry.hasComponent("Button")).toBe(true);
    expect(registry.hasComponent("Card")).toBe(true);
  });

  it("should remove a component", () => {
    registry.addComponent(makeComponent());
    expect(registry.removeComponent("test/Button")).toBe(true);
    expect(registry.size).toBe(0);
    expect(registry.hasComponent("test/Button")).toBe(false);
  });

  it("should find root components (no parents)", () => {
    const page = makeComponent({
      id: "Page",
      name: "Page",
      usedBy: [],
      children: ["Button"],
    });
    const button = makeComponent({
      id: "Button",
      name: "Button",
      usedBy: ["Page"],
      children: [],
    });
    registry.addComponents([page, button]);

    const roots = registry.getRootComponents();
    expect(roots).toHaveLength(1);
    expect(roots[0]!.id).toBe("Page");
  });

  it("should find leaf components (no children)", () => {
    const page = makeComponent({
      id: "Page",
      name: "Page",
      children: ["Button"],
    });
    const button = makeComponent({
      id: "Button",
      name: "Button",
      children: [],
    });
    registry.addComponents([page, button]);

    const leaves = registry.getLeafComponents();
    expect(leaves).toHaveLength(1);
    expect(leaves[0]!.id).toBe("Button");
  });

  it("should traverse subtree via BFS", () => {
    const app = makeComponent({
      id: "App",
      name: "App",
      children: ["Layout"],
    });
    const layout = makeComponent({
      id: "Layout",
      name: "Layout",
      children: ["Header", "Footer"],
    });
    const header = makeComponent({
      id: "Header",
      name: "Header",
      children: [],
    });
    const footer = makeComponent({
      id: "Footer",
      name: "Footer",
      children: [],
    });

    registry.addComponents([app, layout, header, footer]);

    const subtree = registry.getSubtree("App");
    const ids = subtree.map((c) => c.id);
    expect(ids).toContain("App");
    expect(ids).toContain("Layout");
    expect(ids).toContain("Header");
    expect(ids).toContain("Footer");
    expect(subtree).toHaveLength(4);
  });

  it("should create and load snapshots", () => {
    const button = makeComponent();
    registry.addComponent(button);

    const snapshot = registry.createSnapshot("abc123", "main");
    expect(snapshot.commitSha).toBe("abc123");
    expect(snapshot.branch).toBe("main");
    expect(snapshot.components).toHaveLength(1);

    // Load into a new registry
    const newRegistry = new ComponentRegistry();
    newRegistry.loadSnapshot(snapshot);
    expect(newRegistry.size).toBe(1);
    expect(newRegistry.getComponent("test/Button")).toEqual(button);
  });

  it("should diff two snapshots", () => {
    const button = makeComponent({
      id: "Button",
      name: "Button",
      props: [{ name: "label", type: "string", required: true }],
    });

    registry.addComponent(button);
    const base = registry.createSnapshot("aaa", "main");

    const modifiedButton = makeComponent({
      id: "Button",
      name: "Button",
      props: [
        { name: "label", type: "string", required: true },
        { name: "variant", type: "string", required: false },
      ],
    });
    const newCard = makeComponent({ id: "Card", name: "Card" });

    registry.clear();
    registry.addComponents([modifiedButton, newCard]);
    const head = registry.createSnapshot("bbb", "feature");

    const diff = ComponentRegistry.diff(base, head);
    expect(diff.components.added).toHaveLength(1);
    expect(diff.components.added[0]!.id).toBe("Card");
    expect(diff.components.removed).toHaveLength(0);
    expect(diff.components.modified).toHaveLength(1);
    expect(diff.components.modified[0]!.propsAdded).toContain("variant");
  });
});
