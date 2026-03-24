/**
 * @polarsignals/sourcemap-esbuild-plugin
 *
 * ESBuild plugin for injecting debug IDs into JavaScript files and source maps.
 * Provides both build-time integration and post-build processing capabilities.
 */

// Re-export everything from core for backward compatibility.
// Existing users who import utilities from this package will continue to work.
export * from '@polarsignals/sourcemap-core';

// Export esbuild-specific plugin functionality
export { debugIdPlugin, createDebugIdPlugin } from './plugin';
export type { DebugIdPluginOptions } from './plugin';

// Default export provides the main plugin function
export { debugIdPlugin as default } from './plugin';
