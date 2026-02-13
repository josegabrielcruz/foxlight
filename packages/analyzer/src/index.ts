// @pulse/analyzer — Public API
export { analyzeFile, analyzeSource } from "./ast-scanner.js";
export type { FileAnalysis, ExportInfo, JsxElementInfo, FunctionInfo } from "./ast-scanner.js";

export { detectComponents, crossReferenceComponents } from "./component-detector.js";

export { analyzeProject } from "./project-analyzer.js";
export type { ProjectAnalysis, AnalysisStats } from "./project-analyzer.js";
