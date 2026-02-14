// ============================================================
// @foxlight/analyzer — Framework Parsers barrel export
// ============================================================

export { parseVueSFC, vueSFCToComponentInfo, type VueSFCAnalysis } from './vue-parser.js';

export {
  parseSvelteFile,
  svelteFileToComponentInfo,
  type SvelteFileAnalysis,
} from './svelte-parser.js';
