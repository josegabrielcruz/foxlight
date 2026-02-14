// @foxlight/bundle — Public API
export {
  computeSize,
  computeComponentBundleInfo,
  formatBytes,
  formatDelta,
} from './size-tracker.js';
export type { ModuleEntry } from './size-tracker.js';

export { foxlightBundle } from './plugins/vite-plugin.js';
export type { FoxlightVitePluginOptions } from './plugins/vite-plugin.js';

export { FoxlightWebpackPlugin } from './plugins/webpack-plugin.js';
export type { FoxlightWebpackPluginOptions } from './plugins/webpack-plugin.js';
