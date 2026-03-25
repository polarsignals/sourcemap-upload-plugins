/**
 * Injects a debug ID comment into JavaScript file content
 * @param jsContent - The JavaScript file content
 * @param debugId - The debug ID to inject
 * @returns Modified JavaScript content with debug ID comment injected
 */
export function injectDebugIdIntoJs(jsContent: string, debugId: string): string {
  // Remove any existing debug ID comment to avoid duplicates
  const cleanedContent = removeDebugIdFromJs(jsContent);

  // Add the debug ID comment at the end of the file
  const debugIdComment = `//# debugId=${debugId}`;

  // If file already ends with a newline, don't add extra newline
  const separator = cleanedContent.endsWith('\n') ? '' : '\n';

  return cleanedContent + separator + debugIdComment + '\n';
}

/**
 * Removes debug ID comment from JavaScript file content
 * @param jsContent - The JavaScript file content
 * @returns JavaScript content with debug ID comment removed
 */
export function removeDebugIdFromJs(jsContent: string): string {
  // Remove the debug ID comment line
  const debugIdRegex = /\/\/# debugId=[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\s*\n?/gi;
  return jsContent.replace(debugIdRegex, '');
}

/**
 * Checks if JavaScript file already has a debug ID
 * @param jsContent - The JavaScript file content
 * @returns True if debug ID comment is found
 */
export function hasDebugId(jsContent: string): boolean {
  const debugIdRegex = /\/\/# debugId=[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;
  return debugIdRegex.test(jsContent);
}

/**
 * Validates if content looks like JavaScript
 * @param content - The content to validate
 * @returns True if the content appears to be JavaScript
 */
export function isJavaScriptFile(content: string): boolean {
  // Basic heuristics to detect JavaScript content
  const jsPatterns = [
    /\bfunction\b/,
    /\bvar\b|\blet\b|\bconst\b/,
    /\bif\b|\belse\b|\bfor\b|\bwhile\b/,
    /\breturn\b/,
    /\bmodule\.exports\b/,
    /\bexport\b|\bimport\b/,
    /\/\/|\/\*/,  // Comments
    /console\.log/,
  ];

  return jsPatterns.some(pattern => pattern.test(content));
}

/**
 * Finds the source map URL in JavaScript content
 * @param jsContent - The JavaScript file content
 * @returns The source map URL if found, null otherwise
 */
export function extractSourceMapUrl(jsContent: string): string | null {
  const sourceMapMatch = jsContent.match(/\/\/# sourceMappingURL=(.+)$/m);
  return sourceMapMatch ? sourceMapMatch[1].trim() : null;
}
