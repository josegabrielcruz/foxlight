import { describe, it, expect } from "vitest";
import { computeSize, formatBytes, formatDelta } from "./size-tracker.js";

describe("Size Tracker", () => {
  it("should compute raw and gzip size", () => {
    const code = "export const hello = 'world';";
    const size = computeSize(code);

    expect(size.raw).toBe(Buffer.byteLength(code, "utf-8"));
    expect(size.gzip).toBeGreaterThan(0);
    expect(size.gzip).toBeLessThanOrEqual(size.raw + 20); // gzip has overhead for tiny strings
  });

  it("should compute smaller gzip for repetitive content", () => {
    const repetitive = "const a = 1;\n".repeat(1000);
    const size = computeSize(repetitive);

    expect(size.gzip).toBeLessThan(size.raw);
  });

  describe("formatBytes", () => {
    it("should format bytes", () => {
      expect(formatBytes(0)).toBe("0 B");
      expect(formatBytes(500)).toBe("500 B");
      expect(formatBytes(1024)).toBe("1.00 KB");
      expect(formatBytes(1536)).toBe("1.50 KB");
      expect(formatBytes(1048576)).toBe("1.00 MB");
      expect(formatBytes(45000)).toBe("43.9 KB");
    });

    it("should handle negative values", () => {
      expect(formatBytes(-1024)).toBe("-1.00 KB");
    });
  });

  describe("formatDelta", () => {
    it("should format positive delta", () => {
      const before = { raw: 1000, gzip: 500 };
      const after = { raw: 1200, gzip: 600 };
      const result = formatDelta(before, after);

      expect(result).toContain("+");
      expect(result).toContain("20.0%");
    });

    it("should format negative delta", () => {
      const before = { raw: 1200, gzip: 600 };
      const after = { raw: 1000, gzip: 500 };
      const result = formatDelta(before, after);

      expect(result).toContain("-");
    });
  });
});
