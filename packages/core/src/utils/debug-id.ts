import { createHash } from 'crypto';
import { v5 as uuidv5 } from 'uuid';

/**
 * Namespace UUID for debug IDs (randomly generated for this project)
 * This ensures our debug IDs are unique to our system
 */
const DEBUG_ID_NAMESPACE = '550e8400-e29b-41d4-a716-446655440000';

/**
 * Generates a deterministic debug ID from source map content.
 * The same source map content will always generate the same debug ID.
 *
 * @param sourcemapContent - The source map JSON content as a string
 * @returns A UUID v5 based on the hash of the source map content
 */
export function generateDebugId(sourcemapContent: string): string {
  // Create SHA-256 hash of the source map content
  const hash = createHash('sha256')
    .update(sourcemapContent)
    .digest('hex');

  // Generate deterministic UUID v5 from the hash
  const debugId = uuidv5(hash, DEBUG_ID_NAMESPACE);

  return debugId;
}

/**
 * Validates if a string is a valid UUID format
 * @param uuid - The string to validate
 * @returns True if the string is a valid UUID format
 */
export function isValidUuid(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Extracts debug ID from JavaScript file content
 * @param jsContent - The JavaScript file content
 * @returns The debug ID if found, null otherwise
 */
export function extractDebugIdFromJs(jsContent: string): string | null {
  const debugIdMatch = jsContent.match(/\/\/# debugId=([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i);
  return debugIdMatch ? debugIdMatch[1] : null;
}

/**
 * Extracts debug ID from source map content
 * @param sourcemapContent - The source map JSON content as a string
 * @returns The debug ID if found, null otherwise
 */
export function extractDebugIdFromSourceMap(sourcemapContent: string): string | null {
  try {
    const sourcemap = JSON.parse(sourcemapContent);
    return sourcemap.debugId || null;
  } catch (error) {
    return null;
  }
}
