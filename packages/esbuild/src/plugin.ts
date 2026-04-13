import type { Plugin, PluginBuild } from 'esbuild';
import { promises as fs } from 'fs';
import { join } from 'path';
import {
  generateDebugId,
  injectDebugIdIntoSourceMap,
  isValidSourceMap,
  injectDebugIdIntoJs,
  uploadSourceMaps,
  type SourceMapInfo,
} from '@polarsignals/sourcemap-core';

/**
 * Options for the esbuild debug ID plugin
 */
export interface DebugIdPluginOptions {
  /** Whether to log debug information */
  verbose?: boolean;
  /** Project ID for identifying uploads */
  projectID: string;
  /** Debuginfo server URL for uploading source maps (default: grpc.polarsignals.com:443) */
  debuginfoServerUrl?: string;
  /** Authentication token for debuginfo server */
  token: string;
  /** Allow insecure SSL connections (skip certificate validation) */
  insecure?: boolean;
  /** Maximum parallel uploads (default: 50, set to 1 for serial) */
  concurrency?: number;
  /** Number of retry passes for failed uploads (default: 3, set to 0 to disable) */
  maxRetries?: number;
}

/**
 * ESBuild plugin that injects debug IDs into JavaScript files and source maps during the build process
 * @param options - Plugin options
 * @returns ESBuild plugin
 */
export function debugIdPlugin(options: DebugIdPluginOptions): Plugin {
  const { verbose = false, projectID } = options;

  return {
    name: 'debug-id-plugin',
    setup(build: PluginBuild) {
      // Hook into the end of the build process
      build.onEnd(async (result) => {
        if (result.errors.length > 0) {
          if (verbose) {
            console.log('Skipping debug ID injection due to build errors');
          }
          return;
        }

        const { outdir, outfile } = build.initialOptions;

        if (!outdir && !outfile) {
          if (verbose) {
            console.log('No output directory or file specified, skipping debug ID injection');
          }
          return;
        }

        try {
          // Determine output directory
          const outputDir = outdir || (outfile ? join(outfile, '..') : process.cwd());

          if (verbose) {
            console.log(`Injecting debug IDs in output directory: ${outputDir}`);
          }

          await injectDebugIdsInOutputDir(outputDir, {
            verbose,
            projectID,
            debuginfoServerUrl: options.debuginfoServerUrl ?? 'grpc.polarsignals.com:443',
            token: options.token,
            insecure: options.insecure,
            concurrency: options.concurrency,
            maxRetries: options.maxRetries,
          });

        } catch (error) {
          // Add error to build results but don't fail the build
          result.errors.push({
            id: 'debug-id-injection-error',
            pluginName: 'debug-id-plugin',
            text: `Debug ID injection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            location: null,
            notes: [],
            detail: error,
          });
        }
      });

      if (verbose) {
        build.onStart(() => {
          console.log(`${projectID}: Starting build with debug ID injection`);
        });
      }
    },
  };
}

/**
 * Injects debug IDs into JavaScript files and source maps in the output directory,
 * then uploads them in parallel via the batch upload API.
 */
async function injectDebugIdsInOutputDir(
  outputDir: string,
  options: {
    verbose: boolean;
    projectID: string;
    debuginfoServerUrl: string;
    token: string;
    insecure?: boolean;
    concurrency?: number;
    maxRetries?: number;
  }
): Promise<void> {
  const { verbose, projectID, debuginfoServerUrl, token, insecure = false, concurrency, maxRetries } = options;

  let files: import('fs').Dirent[];
  try {
    files = await fs.readdir(outputDir, { withFileTypes: true });
  } catch (error) {
    throw new Error(`Failed to process output directory ${outputDir}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  const jsFiles = files
    .filter(file => file.isFile() && file.name.endsWith('.js'))
    .map(file => file.name);

  // Phase 1: inject debug IDs and collect upload bundles
  const bundles: SourceMapInfo[] = [];

  for (const jsFileName of jsFiles) {
    const jsFilePath = join(outputDir, jsFileName);
    const sourceMapPath = join(outputDir, `${jsFileName}.map`);

    try {
      await fs.access(sourceMapPath);

      const [jsContent, sourceMapContent] = await Promise.all([
        fs.readFile(jsFilePath, 'utf-8'),
        fs.readFile(sourceMapPath, 'utf-8'),
      ]);

      if (!isValidSourceMap(sourceMapContent)) {
        if (verbose) {
          console.log(`${projectID}: Skipping ${jsFileName} - invalid source map`);
        }
        continue;
      }

      const debugId = generateDebugId(sourceMapContent);

      if (verbose) {
        console.log(`${projectID}: Generated debug ID ${debugId} for ${jsFileName}`);
      }

      const updatedSourceMapContent = injectDebugIdIntoSourceMap(sourceMapContent, debugId);
      const updatedJsContent = injectDebugIdIntoJs(jsContent, debugId);

      await Promise.all([
        fs.writeFile(jsFilePath, updatedJsContent, 'utf-8'),
        fs.writeFile(sourceMapPath, updatedSourceMapContent, 'utf-8'),
      ]);

      if (verbose) {
        console.log(`${projectID}: Injected debug ID into ${jsFileName} and its source map`);
      }

      // Build the upload bundle: [js_len: u64][sm_len: u64][js_bytes][sm_bytes]
      const jsBytes = Buffer.from(updatedJsContent, 'utf-8');
      const smBytes = Buffer.from(updatedSourceMapContent, 'utf-8');
      const header = Buffer.alloc(16);
      header.writeBigUInt64LE(BigInt(jsBytes.length), 0);
      header.writeBigUInt64LE(BigInt(smBytes.length), 8);
      const bundleBuffer = Buffer.concat([header, jsBytes, smBytes]);

      bundles.push({
        debugId,
        content: new Uint8Array(bundleBuffer),
        jsFilePath: jsFileName,
      });
    } catch (error) {
      if (verbose) {
        console.log(`${projectID}: Skipping ${jsFileName} - no source map or error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      continue;
    }
  }

  if (bundles.length === 0) {
    if (verbose) {
      console.log(`${projectID}: No source maps to upload`);
    }
    return;
  }

  // Phase 2: batch upload (shared client, parallel, with retries + sticky progress)
  if (verbose) {
    console.log(`${projectID}: Uploading ${bundles.length} source map(s)...`);
  }

  try {
    const results = await uploadSourceMaps(bundles, {
      serverUrl: debuginfoServerUrl,
      token,
      projectID,
      verbose,
      insecure,
      concurrency,
      maxRetries,
    });

    if (verbose) {
      const failed = results.filter(r => !r.success);
      for (const f of failed) {
        console.log(`${projectID}: Failed to upload source map ${f.debugId}: ${f.error}`);
      }
    }
  } catch (uploadError) {
    if (verbose) {
      console.log(`${projectID}: Upload error: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`);
    }
  }
}

/**
 * Creates a debug ID plugin with predefined options
 * @param defaultOptions - Default options to merge with runtime options
 * @returns Function that creates the plugin with additional options
 */
export function createDebugIdPlugin(defaultOptions: Partial<DebugIdPluginOptions> = {}) {
  return (runtimeOptions: Partial<DebugIdPluginOptions> = {}) => {
    const mergedOptions = { ...defaultOptions, ...runtimeOptions } as DebugIdPluginOptions;
    return debugIdPlugin(mergedOptions);
  };
}
