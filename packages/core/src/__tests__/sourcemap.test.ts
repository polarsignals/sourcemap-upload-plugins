import { injectDebugIdIntoSourceMap, isValidSourceMap, removeDebugIdFromSourceMap } from '../processors/sourcemap';
import { extractDebugIdFromSourceMap } from '../utils/debug-id';

describe('Source Map Processing', () => {
  const validSourceMap = {
    version: 3,
    sources: ['test.js'],
    mappings: 'AAAA',
    names: []
  };

  test('injects debug ID into source map', () => {
    const content = JSON.stringify(validSourceMap);
    const debugId = '550e8400-e29b-41d4-a716-446655440000';

    const result = injectDebugIdIntoSourceMap(content, debugId);
    const parsed = JSON.parse(result);

    expect(parsed.debugId).toBe(debugId);
    expect(parsed.version).toBe(3);
    expect(parsed.sources).toEqual(['test.js']);
  });

  test('validates source map format', () => {
    const validContent = JSON.stringify(validSourceMap);
    const invalidContent = '{"invalid": true}';

    expect(isValidSourceMap(validContent)).toBe(true);
    expect(isValidSourceMap(invalidContent)).toBe(false);
    expect(isValidSourceMap('not json')).toBe(false);
  });

  test('removes debug ID from source map', () => {
    const contentWithDebugId = JSON.stringify({
      ...validSourceMap,
      debugId: '550e8400-e29b-41d4-a716-446655440000'
    });

    const result = removeDebugIdFromSourceMap(contentWithDebugId);
    const parsed = JSON.parse(result);

    expect(parsed.debugId).toBeUndefined();
    expect(parsed.version).toBe(3);
  });

  test('extracts debug ID from source map', () => {
    const debugId = '550e8400-e29b-41d4-a716-446655440000';
    const content = JSON.stringify({
      ...validSourceMap,
      debugId
    });

    const extracted = extractDebugIdFromSourceMap(content);
    expect(extracted).toBe(debugId);

    const noDebugId = extractDebugIdFromSourceMap(JSON.stringify(validSourceMap));
    expect(noDebugId).toBeNull();
  });
});
