import { injectDebugIdIntoJs, removeDebugIdFromJs, hasDebugId, extractSourceMapUrl } from '../processors/javascript';
import { extractDebugIdFromJs } from '../utils/debug-id';

describe('JavaScript Processing', () => {
  const sampleJs = `
function test() {
  console.log('Hello World');
}
//# sourceMappingURL=test.js.map
`;

  test('injects debug ID into JavaScript', () => {
    const debugId = '550e8400-e29b-41d4-a716-446655440000';
    const result = injectDebugIdIntoJs(sampleJs, debugId);

    expect(result).toContain(`//# debugId=${debugId}`);
    expect(hasDebugId(result)).toBe(true);
  });

  test('removes debug ID from JavaScript', () => {
    const debugId = '550e8400-e29b-41d4-a716-446655440000';
    const jsWithDebugId = injectDebugIdIntoJs(sampleJs, debugId);
    const result = removeDebugIdFromJs(jsWithDebugId);

    expect(result).not.toContain(`//# debugId=${debugId}`);
    expect(hasDebugId(result)).toBe(false);
  });

  test('detects existing debug ID', () => {
    const debugId = '550e8400-e29b-41d4-a716-446655440000';
    const jsWithDebugId = injectDebugIdIntoJs(sampleJs, debugId);

    expect(hasDebugId(jsWithDebugId)).toBe(true);
    expect(hasDebugId(sampleJs)).toBe(false);
  });

  test('extracts debug ID from JavaScript', () => {
    const debugId = '550e8400-e29b-41d4-a716-446655440000';
    const jsWithDebugId = injectDebugIdIntoJs(sampleJs, debugId);

    const extracted = extractDebugIdFromJs(jsWithDebugId);
    expect(extracted).toBe(debugId);

    const noDebugId = extractDebugIdFromJs(sampleJs);
    expect(noDebugId).toBeNull();
  });

  test('extracts source map URL', () => {
    const url = extractSourceMapUrl(sampleJs);
    expect(url).toBe('test.js.map');

    const noSourceMapUrl = extractSourceMapUrl('function test() {}');
    expect(noSourceMapUrl).toBeNull();
  });

  test('prevents duplicate debug ID injection', () => {
    const debugId1 = '550e8400-e29b-41d4-a716-446655440000';
    const debugId2 = '450e8400-e29b-41d4-a716-446655440000';

    let result = injectDebugIdIntoJs(sampleJs, debugId1);
    result = injectDebugIdIntoJs(result, debugId2);

    const occurrences = result.match(/\/\/# debugId=/g);
    expect(occurrences).toHaveLength(1);
    expect(result).toContain(debugId2);
    expect(result).not.toContain(debugId1);
  });
});
