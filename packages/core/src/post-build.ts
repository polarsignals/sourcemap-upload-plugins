import { findJavaScriptFiles, writeFileMapping, directoryExists, type FileMapping, type FileWalkerOptions } from './utils/file-walker';
import { generateDebugId } from './utils/debug-id';
import { injectDebugIdIntoSourceMap, isValidSourceMap } from './processors/sourcemap';
import { injectDebugIdIntoJs, hasDebugId } from './processors/javascript';

/**
 * Options for post-build processing
 */
export interface PostBuildOptions extends FileWalkerOptions {
  /** Whether to overwrite existing debug IDs */
  overwrite?: boolean;
  /** Whether to log processing information */
  verbose?: boolean;
  /** Dry run mode - don't actually write files */
  dryRun?: boolean;
}

/**
 * Results of post-build processing
 */
export interface ProcessingResults {
  processed: number;
  skipped: number;
  errors: number;
  debugIds: Record<string, string>;
}

/**
 * Processes a build directory to inject debug IDs into JavaScript files and source maps
 * @param buildPath - Path to the build directory
 * @param options - Processing options
 * @returns Promise resolving to processing results
 */
export async function processBuiltFiles(
  buildPath: string,
  options: PostBuildOptions = {}
): Promise<ProcessingResults> {
  const { overwrite = false, verbose = false, dryRun = false } = options;

  // Validate build path
  if (!(await directoryExists(buildPath))) {
    throw new Error(`Build directory does not exist: ${buildPath}`);
  }

  if (verbose) {
    console.log(`Processing built files in: ${buildPath}`);
  }

  // Find all JavaScript files with source maps
  const fileMappings = await findJavaScriptFiles(buildPath, options);

  if (verbose) {
    console.log(`Found ${fileMappings.length} JavaScript files with source maps`);
  }

  const results: ProcessingResults = {
    processed: 0,
    skipped: 0,
    errors: 0,
    debugIds: {},
  };

  // Process each file mapping
  for (const mapping of fileMappings) {
    try {
      await processFileMapping(mapping, { overwrite, verbose, dryRun }, results);
    } catch (error) {
      results.errors++;
      console.error(`Error processing ${mapping.jsFile}:`, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  if (verbose) {
    console.log(`Processing complete:`);
    console.log(`  Processed: ${results.processed}`);
    console.log(`  Skipped: ${results.skipped}`);
    console.log(`  Errors: ${results.errors}`);
  }

  return results;
}

/**
 * Processes a single file mapping to inject debug IDs
 * @param mapping - The file mapping to process
 * @param options - Processing options
 * @param results - Results object to update
 */
async function processFileMapping(
  mapping: FileMapping,
  options: { overwrite: boolean; verbose: boolean; dryRun: boolean },
  results: ProcessingResults
): Promise<void> {
  const { overwrite, verbose, dryRun } = options;

  // Check if JavaScript file already has debug ID
  if (hasDebugId(mapping.jsContent) && !overwrite) {
    if (verbose) {
      console.log(`Skipping ${mapping.jsFile} (already has debug ID)`);
    }
    results.skipped++;
    return;
  }

  // Validate source map
  if (!isValidSourceMap(mapping.sourceMapContent)) {
    throw new Error(`Invalid source map format: ${mapping.sourceMapFile}`);
  }

  // Generate debug ID from source map content
  const debugId = generateDebugId(mapping.sourceMapContent);

  if (verbose) {
    console.log(`Generated debug ID ${debugId} for ${mapping.jsFile}`);
  }

  // Inject debug ID into source map
  const updatedSourceMapContent = injectDebugIdIntoSourceMap(mapping.sourceMapContent, debugId);

  // Inject debug ID into JavaScript file
  const updatedJsContent = injectDebugIdIntoJs(mapping.jsContent, debugId);

  // Write files if not in dry run mode
  if (!dryRun) {
    await writeFileMapping({
      ...mapping,
      jsContent: updatedJsContent,
      sourceMapContent: updatedSourceMapContent,
    });
  }

  // Track results
  results.processed++;
  results.debugIds[mapping.jsFile] = debugId;

  if (verbose && dryRun) {
    console.log(`[DRY RUN] Would inject debug ID ${debugId} into ${mapping.jsFile}`);
  }
}

/**
 * Validates the build path and options
 * @param buildPath - Path to validate
 * @param options - Options to validate
 */
function validatePostBuildOptions(buildPath: string, options: PostBuildOptions): void {
  if (!buildPath || typeof buildPath !== 'string') {
    throw new Error('Build path must be a non-empty string');
  }

  if (options.include && !Array.isArray(options.include)) {
    throw new Error('include option must be an array of strings');
  }

  if (options.exclude && !Array.isArray(options.exclude)) {
    throw new Error('exclude option must be an array of strings');
  }
}

/**
 * Creates a post-build processor function with predefined options
 * @param defaultOptions - Default options to use
 * @returns A function that processes build directories
 */
export function createPostBuildProcessor(defaultOptions: PostBuildOptions = {}) {
  return (buildPath: string, options: PostBuildOptions = {}) => {
    const mergedOptions = { ...defaultOptions, ...options };
    return processBuiltFiles(buildPath, mergedOptions);
  };
}
