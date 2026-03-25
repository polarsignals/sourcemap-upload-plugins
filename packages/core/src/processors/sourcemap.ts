/**
 * Interface representing a source map structure
 */
export interface SourceMap {
  version: number;
  sources: string[];
  mappings: string;
  names?: string[];
  file?: string;
  sourceRoot?: string;
  sourcesContent?: string[];
  debugId?: string;
}

/**
 * Injects a debug ID into source map content
 * @param sourcemapContent - The source map JSON content as a string
 * @param debugId - The debug ID to inject
 * @returns Modified source map content with debug ID injected
 */
export function injectDebugIdIntoSourceMap(sourcemapContent: string, debugId: string): string {
  try {
    const sourcemap: SourceMap = JSON.parse(sourcemapContent);

    // Add the debug ID to the source map
    sourcemap.debugId = debugId;

    // Return formatted JSON with proper indentation for readability
    return JSON.stringify(sourcemap, null, 2);
  } catch (error) {
    throw new Error(`Failed to parse source map: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validates if content is a valid source map
 * @param content - The content to validate
 * @returns True if the content is a valid source map
 */
export function isValidSourceMap(content: string): boolean {
  try {
    const parsed = JSON.parse(content);
    return (
      typeof parsed === 'object' &&
      typeof parsed.version === 'number' &&
      Array.isArray(parsed.sources) &&
      typeof parsed.mappings === 'string'
    );
  } catch {
    return false;
  }
}

/**
 * Removes debug ID from source map content
 * @param sourcemapContent - The source map JSON content as a string
 * @returns Source map content with debug ID removed
 */
export function removeDebugIdFromSourceMap(sourcemapContent: string): string {
  try {
    const sourcemap: SourceMap = JSON.parse(sourcemapContent);

    // Remove the debug ID if it exists
    delete sourcemap.debugId;

    return JSON.stringify(sourcemap, null, 2);
  } catch (error) {
    throw new Error(`Failed to parse source map: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
