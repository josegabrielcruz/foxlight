// @foxlight/analyzer — Public API
export { analyzeFile, analyzeSource } from './ast-scanner.js';
export type { FileAnalysis, ExportInfo, JsxElementInfo, FunctionInfo } from './ast-scanner.js';

export { detectComponents, crossReferenceComponents } from './component-detector.js';

export {
  createTypeChecker,
  extractPropsFromType,
  extractPropsFromTsType,
  extractAllPropsFromFile,
} from './prop-extractor.js';

export { analyzeProject } from './project-analyzer.js';
export type { ProjectAnalysis, AnalysisStats } from './project-analyzer.js';

// Framework-specific parsers
export {
  parseVueSFC,
  vueSFCToComponentInfo,
  type VueSFCAnalysis,
} from './frameworks/vue-parser.js';

export {
  parseSvelteFile,
  svelteFileToComponentInfo,
  type SvelteFileAnalysis,
} from './frameworks/svelte-parser.js';
