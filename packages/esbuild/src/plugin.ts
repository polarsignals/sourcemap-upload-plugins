import type { Plugin, PluginBuild } from 'esbuild';
import { promises as fs } from 'fs';
import { join } from 'path';
import {
  generateDebugId,
  injectDebugIdIntoSourceMap,
  isValidSourceMap,
  injectDebugIdIntoJs,
  uploadSourceMap,
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
  /** Debuginfo server URL for uploading source maps */
  debuginfoServerUrl: string;
  /** Authentication token for debuginfo server */
  token: string;
  /** Allow insecure SSL connections (skip certificate validation) */
  insecure?: boolean;
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

          await injectDebugIdsInOutputDir(outputDir, { verbose, projectID, debuginfoServerUrl: options.debuginfoServerUrl, token: options.token, insecure: options.insecure });

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
 * Injects debug IDs into JavaScript files and source maps in the output directory
 * @param outputDir - The output directory to process
 * @param options - Processing options
 */
async function injectDebugIdsInOutputDir(
  outputDir: string,
  options: { verbose: boolean; projectID: string; debuginfoServerUrl: string; token: string; insecure?: boolean }
): Promise<void> {
  const { verbose, projectID, debuginfoServerUrl, token, insecure = false } = options;

  // Upload is now always configured since all fields are required
  const shouldUpload = true;

  try {
    // Get all files in the output directory
    const files = await fs.readdir(outputDir, { withFileTypes: true });

    // Find JavaScript files with corresponding source maps
    const jsFiles = files
      .filter(file => file.isFile() && file.name.endsWith('.js'))
      .map(file => file.name);

    for (const jsFileName of jsFiles) {
      const jsFilePath = join(outputDir, jsFileName);
      const sourceMapPath = join(outputDir, `${jsFileName}.map`);

      try {
        // Check if source map exists
        await fs.access(sourceMapPath);

        // Read both files
        const [jsContent, sourceMapContent] = await Promise.all([
          fs.readFile(jsFilePath, 'utf-8'),
          fs.readFile(sourceMapPath, 'utf-8'),
        ]);

        // Validate source map
        if (!isValidSourceMap(sourceMapContent)) {
          if (verbose) {
            console.log(`${projectID}: Skipping ${jsFileName} - invalid source map`);
          }
          continue;
        }

        // Generate debug ID
        const debugId = generateDebugId(sourceMapContent);

        if (verbose) {
          console.log(`${projectID}: Generated debug ID ${debugId} for ${jsFileName}`);
        }

        // Inject debug ID into both files
        const updatedSourceMapContent = injectDebugIdIntoSourceMap(sourceMapContent, debugId);
        const updatedJsContent = injectDebugIdIntoJs(jsContent, debugId);

        // Write updated files
        await Promise.all([
          fs.writeFile(jsFilePath, updatedJsContent, 'utf-8'),
          fs.writeFile(sourceMapPath, updatedSourceMapContent, 'utf-8'),
        ]);

        if (verbose) {
          console.log(`${projectID}: Injected debug ID into ${jsFileName} and its source map`);
        }

        // Upload source map bundle if configured
        if (shouldUpload) {
          try {
            // Create binary bundle: [js_len: u64][sm_len: u64][js_bytes][sm_bytes]
            const jsBytes = Buffer.from(updatedJsContent, 'utf-8');
            const smBytes = Buffer.from(updatedSourceMapContent, 'utf-8');
            const header = Buffer.alloc(16);
            header.writeBigUInt64LE(BigInt(jsBytes.length), 0);
            header.writeBigUInt64LE(BigInt(smBytes.length), 8);
            const bundleBuffer = Buffer.concat([header, jsBytes, smBytes]);

            const sourceMapInfo: SourceMapInfo = {
              debugId,
              content: new Uint8Array(bundleBuffer),
              jsFilePath: jsFileName,
            };

            const uploadResult = await uploadSourceMap(sourceMapInfo, {
              serverUrl: debuginfoServerUrl,
              token: token,
              projectID,
              verbose,
              insecure,
            });

            if (!uploadResult.success && !uploadResult.skipped) {
              if (verbose) {
                console.log(`${projectID}: Failed to upload source map: ${uploadResult.error}`);
              }
            }
          } catch (uploadError) {
            if (verbose) {
              console.log(`${projectID}: Upload error: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`);
            }
          }
        }

      } catch (error) {
        if (verbose) {
          console.log(`${projectID}: Skipping ${jsFileName} - no source map or error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        continue;
      }
    }

  } catch (error) {
    throw new Error(`Failed to process output directory ${outputDir}: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
