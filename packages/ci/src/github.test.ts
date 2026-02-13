import { describe, it, expect } from "vitest";
import { generateCommentBody } from "./github.js";
import type { SnapshotDiff } from "@pulse/core";

describe("GitHub PR Comment", () => {
  it("should generate comment for empty diff", () => {
    const diff: SnapshotDiff = {
      base: { id: "base", commitSha: "aaa" },
      head: { id: "head", commitSha: "bbb" },
      components: { added: [], removed: [], modified: [] },
      bundleDiff: [],
      healthDiff: [],
    };

    const body = generateCommentBody(diff);
    expect(body).toContain("<!-- pulse-report -->");
    expect(body).toContain("Pulse Report");
    expect(body).toContain("No component changes");
  });

  it("should list added components", () => {
    const diff: SnapshotDiff = {
      base: { id: "base", commitSha: "aaa" },
      head: { id: "head", commitSha: "bbb" },
      components: {
        added: [
          {
            id: "Button",
            name: "Button",
            filePath: "/src/Button.tsx",
            line: 1,
            framework: "react",
            exportKind: "named",
            props: [],
            children: [],
            usedBy: [],
            dependencies: [],
            metadata: {},
          },
        ],
        removed: [],
        modified: [],
      },
      bundleDiff: [],
      healthDiff: [],
    };

    const body = generateCommentBody(diff);
    expect(body).toContain("1 added");
    expect(body).toContain("`Button`");
  });

  it("should list modified components with prop changes", () => {
    const diff: SnapshotDiff = {
      base: { id: "base", commitSha: "aaa" },
      head: { id: "head", commitSha: "bbb" },
      components: {
        added: [],
        removed: [],
        modified: [
          {
            componentId: "Card",
            changes: [],
            propsAdded: ["variant"],
            propsRemoved: [],
            propsModified: ["title"],
          },
        ],
      },
      bundleDiff: [],
      healthDiff: [],
    };

    const body = generateCommentBody(diff);
    expect(body).toContain("1 modified");
    expect(body).toContain("+1 props");
    expect(body).toContain("~1 props changed");
  });

  it("should show bundle size changes", () => {
    const diff: SnapshotDiff = {
      base: { id: "base", commitSha: "aaa" },
      head: { id: "head", commitSha: "bbb" },
      components: { added: [], removed: [], modified: [] },
      bundleDiff: [
        {
          componentId: "DataTable",
          before: { raw: 10000, gzip: 3000 },
          after: { raw: 12000, gzip: 3500 },
          delta: { raw: 2000, gzip: 500 },
        },
      ],
      healthDiff: [],
    };

    const body = generateCommentBody(diff);
    expect(body).toContain("Bundle Size");
    expect(body).toContain("DataTable");
  });
});
