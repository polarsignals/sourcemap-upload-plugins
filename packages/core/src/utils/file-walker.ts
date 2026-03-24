import { promises as fs } from 'fs';
import { glob } from 'glob';
import { join, dirname, basename } from 'path';

/**
 * Represents a JavaScript file and its corresponding source map
 */
export interface FileMapping {
  jsFile: string;
  sourceMapFile: string;
  jsContent: string;
  sourceMapContent: string;
}

/**
 * Options for file processing
 */
export interface FileWalkerOptions {
  /** Include patterns for JavaScript files */
  include?: string[];
  /** Exclude patterns for files/directories to ignore */
  exclude?: string[];
  /** Whether to process files recursively in subdirectories */
  recursive?: boolean;
  /** Base directory to resolve relative paths from */
  baseDir?: string;
}

/**
 * Default options for file processing
 */
const DEFAULT_OPTIONS: FileWalkerOptions = {
  include: ['**/*.js'],
  exclude: ['**/node_modules/**', '**/test/**', '**/tests/**', '**/*.test.js', '**/*.spec.js'],
  recursive: true,
  baseDir: process.cwd(),
};

/**
 * Finds all JavaScript files and their corresponding source maps in the given directory
 * @param buildPath - The directory to search for files
 * @param options - Options for file processing
 * @returns Promise resolving to array of file mappings
 */
export async function findJavaScriptFiles(
  buildPath: string,
  options: FileWalkerOptions = {}
): Promise<FileMapping[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const mappings: FileMapping[] = [];

  try {
    // Find all JavaScript files
    const jsFiles = await glob(opts.include?.[0] || '**/*.js', {
      cwd: buildPath,
      ignore: opts.exclude,
      absolute: false,
    });

    // Process each JavaScript file
    for (const jsFile of Array.from(jsFiles)) {
      const fullJsPath = join(buildPath, jsFile);

      try {
        // Read JavaScript file content
        const jsContent = await fs.readFile(fullJsPath, 'utf-8');

        // Look for corresponding source map file
        const sourceMapFile = await findSourceMapFile(fullJsPath, jsContent);

        if (sourceMapFile) {
          const sourceMapContent = await fs.readFile(sourceMapFile, 'utf-8');

          mappings.push({
            jsFile: fullJsPath,
            sourceMapFile,
            jsContent,
            sourceMapContent,
          });
        } else {
          console.warn(`No source map found for ${jsFile}`);
        }
      } catch (error) {
        console.error(`Error processing ${jsFile}:`, error);
      }
    }

    return mappings;
  } catch (error) {
    throw new Error(`Error finding JavaScript files in ${buildPath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Finds the source map file for a given JavaScript file
 * @param jsFilePath - Path to the JavaScript file
 * @param jsContent - Content of the JavaScript file
 * @returns Promise resolving to source map file path or null if not found
 */
async function findSourceMapFile(jsFilePath: string, jsContent: string): Promise<string | null> {
  // First, check for inline source map URL comment
  const sourceMapUrlMatch = jsContent.match(/\/\/# sourceMappingURL=(.+)$/m);

  if (sourceMapUrlMatch) {
    const sourceMapUrl = sourceMapUrlMatch[1].trim();

    // Handle inline source maps (data URLs)
    if (sourceMapUrl.startsWith('data:')) {
      // For inline source maps, we'll need to extract and create a temporary file
      // For now, we'll skip inline source maps as they're less common in production builds
      return null;
    }

    // Handle relative URLs
    const sourceMapPath = join(dirname(jsFilePath), sourceMapUrl);

    try {
      await fs.access(sourceMapPath);
      return sourceMapPath;
    } catch {
      // Fall through to convention-based lookup
    }
  }

  // Convention: look for .js.map file alongside the .js file
  const conventionalPath = `${jsFilePath}.map`;

  try {
    await fs.access(conventionalPath);
    return conventionalPath;
  } catch {
    return null;
  }
}

/**
 * Writes content back to files
 * @param mapping - The file mapping with updated content
 */
export async function writeFileMapping(mapping: FileMapping): Promise<void> {
  try {
    // Write JavaScript file
    await fs.writeFile(mapping.jsFile, mapping.jsContent, 'utf-8');

    // Write source map file
    await fs.writeFile(mapping.sourceMapFile, mapping.sourceMapContent, 'utf-8');

    console.log(`Updated files: ${basename(mapping.jsFile)} and ${basename(mapping.sourceMapFile)}`);
  } catch (error) {
    throw new Error(`Error writing files: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Checks if a directory exists and is accessible
 * @param dirPath - Path to the directory
 * @returns Promise resolving to true if directory exists and is accessible
 */
export async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}
