import { processBuiltFiles } from '../post-build';
import { hasDebugId } from '../processors/javascript';
import { isValidUuid } from '../utils/debug-id';
import { promises as fs } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Post-Build Processing', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(join(tmpdir(), 'debug-id-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true });
  });

  test('processes files in build directory', async () => {
    // Create test files
    const jsContent = `
function test() {
  return 'hello';
}
//# sourceMappingURL=test.js.map
`;

    const sourceMapContent = JSON.stringify({
      version: 3,
      sources: ['test.ts'],
      mappings: 'AAAA,SAAS,IAAI',
      names: []
    });

    await fs.writeFile(join(tempDir, 'test.js'), jsContent);
    await fs.writeFile(join(tempDir, 'test.js.map'), sourceMapContent);

    // Process files
    const results = await processBuiltFiles(tempDir, { verbose: false });

    expect(results.processed).toBe(1);
    expect(results.errors).toBe(0);
    expect(Object.keys(results.debugIds)).toHaveLength(1);

    // Verify files were updated
    const updatedJs = await fs.readFile(join(tempDir, 'test.js'), 'utf-8');
    const updatedSourceMap = await fs.readFile(join(tempDir, 'test.js.map'), 'utf-8');

    expect(hasDebugId(updatedJs)).toBe(true);
    const parsedSourceMap = JSON.parse(updatedSourceMap);
    expect(parsedSourceMap.debugId).toBeDefined();
    expect(isValidUuid(parsedSourceMap.debugId)).toBe(true);
  });

  test('skips files without source maps', async () => {
    const jsContent = 'function test() { return "hello"; }';

    await fs.writeFile(join(tempDir, 'test.js'), jsContent);

    const results = await processBuiltFiles(tempDir, { verbose: false });

    expect(results.processed).toBe(0);
    expect(results.skipped).toBe(0);
    expect(results.errors).toBe(0);
  });

  test('handles dry run mode', async () => {
    const jsContent = `function test() { return 'hello'; }
//# sourceMappingURL=test.js.map`;

    const sourceMapContent = JSON.stringify({
      version: 3,
      sources: ['test.ts'],
      mappings: 'AAAA',
      names: []
    });

    await fs.writeFile(join(tempDir, 'test.js'), jsContent);
    await fs.writeFile(join(tempDir, 'test.js.map'), sourceMapContent);

    // Process in dry run mode
    const results = await processBuiltFiles(tempDir, { dryRun: true });

    expect(results.processed).toBe(1);
    expect(Object.keys(results.debugIds)).toHaveLength(1);

    // Verify files were NOT updated
    const js = await fs.readFile(join(tempDir, 'test.js'), 'utf-8');
    const sourceMap = await fs.readFile(join(tempDir, 'test.js.map'), 'utf-8');

    expect(hasDebugId(js)).toBe(false);
    const parsedSourceMap = JSON.parse(sourceMap);
    expect(parsedSourceMap.debugId).toBeUndefined();
  });
});
