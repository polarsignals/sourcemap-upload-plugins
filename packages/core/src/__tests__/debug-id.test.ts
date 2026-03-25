import { generateDebugId, isValidUuid } from '../utils/debug-id';

describe('Debug ID Generation', () => {
  test('generates consistent debug IDs for same content', () => {
    const content = '{"version":3,"sources":["test.js"],"mappings":"AAAA"}';

    const id1 = generateDebugId(content);
    const id2 = generateDebugId(content);

    expect(id1).toBe(id2);
    expect(isValidUuid(id1)).toBe(true);
  });

  test('generates different debug IDs for different content', () => {
    const content1 = '{"version":3,"sources":["test1.js"],"mappings":"AAAA"}';
    const content2 = '{"version":3,"sources":["test2.js"],"mappings":"BBBB"}';

    const id1 = generateDebugId(content1);
    const id2 = generateDebugId(content2);

    expect(id1).not.toBe(id2);
    expect(isValidUuid(id1)).toBe(true);
    expect(isValidUuid(id2)).toBe(true);
  });

  test('validates UUID format correctly', () => {
    expect(isValidUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isValidUuid('not-a-uuid')).toBe(false);
    expect(isValidUuid('550e8400-e29b-41d4-a716-44665544000')).toBe(false); // too short
  });
});
