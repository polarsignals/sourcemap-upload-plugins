/**
 * @polarsignals/sourcemap-core
 *
 * Shared core for Polar Signals sourcemap upload plugins.
 * Provides debug ID generation, injection, upload, and post-build processing.
 */

// Post-build processing
export { processBuiltFiles, createPostBuildProcessor } from './post-build';
export type { PostBuildOptions, ProcessingResults } from './post-build';

// Utilities
export {
  generateDebugId,
  isValidUuid,
  extractDebugIdFromJs,
  extractDebugIdFromSourceMap,
} from './utils/debug-id';

export {
  findJavaScriptFiles,
  writeFileMapping,
  directoryExists,
} from './utils/file-walker';
export type { FileMapping, FileWalkerOptions } from './utils/file-walker';

// Processors
export {
  injectDebugIdIntoSourceMap,
  isValidSourceMap,
  removeDebugIdFromSourceMap,
} from './processors/sourcemap';
export type { SourceMap } from './processors/sourcemap';

export {
  injectDebugIdIntoJs,
  removeDebugIdFromJs,
  hasDebugId,
  isJavaScriptFile,
  extractSourceMapUrl,
} from './processors/javascript';

// Upload functionality
export {
  uploadSourceMap,
  uploadSourceMaps,
} from './upload/debuginfo-uploader';
export type {
  UploadOptions,
  SourceMapInfo,
  UploadResult,
} from './upload/debuginfo-uploader';
