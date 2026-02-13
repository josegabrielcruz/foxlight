import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/plugins/vite-plugin.ts"],
  format: ["esm"],
  dts: true,
  tsconfig: "tsconfig.build.json",
  clean: true,
});
