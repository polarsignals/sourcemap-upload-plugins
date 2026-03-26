import { parseArgs } from 'node:util';
import process from 'node:process';
import { promises as fs } from 'fs';
import { resolve } from 'path';
import {
  processBuiltFiles,
  findJavaScriptFiles,
  extractDebugIdFromJs,
  uploadSourceMaps,
  type SourceMapInfo,
} from '@polarsignals/sourcemap-core';

const USAGE = `
Usage: sourcemap-upload [options] <directory>

Inject debug IDs into built JavaScript files and upload source maps to Polar Signals.

Arguments:
  <directory>                Build output directory containing .js + .js.map files

Required:
  --project-id <id>         Polar Signals project ID
  --token <token>           Authentication token

Optional:
  --server-url <url>        Debuginfo server URL (default: grpc.polarsignals.com:443)
  --verbose                 Enable verbose logging (default: false)
  --dry-run                 Inject debug IDs but skip upload (default: false)
  --insecure                Skip TLS verification (default: false)
  --include <glob>          Glob pattern for JS files (default: **/*.js)
  --exclude <glob>          Glob pattern to exclude (default: **/node_modules/**)

Environment variable overrides:
  POLARSIGNALS_PROJECT_ID   --project-id
  POLARSIGNALS_SERVER_URL   --server-url
  POLARSIGNALS_TOKEN        --token
`.trim();

function die(message: string): never {
  console.error(`Error: ${message}`);
  console.error(`\nRun with --help for usage information.`);
  process.exit(1);
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      'project-id': { type: 'string' },
      'token': { type: 'string' },
      'server-url': { type: 'string' },
      'verbose': { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      'insecure': { type: 'boolean', default: false },
      'include': { type: 'string' },
      'exclude': { type: 'string' },
      'help': { type: 'boolean', default: false },
    },
  });

  if (values.help) {
    console.log(USAGE);
    process.exit(0);
  }

  const directory = positionals[0];
  if (!directory) {
    die('Missing required argument: <directory>');
  }

  const buildPath = resolve(directory);

  try {
    const stat = await fs.stat(buildPath);
    if (!stat.isDirectory()) {
      die(`Not a directory: ${buildPath}`);
    }
  } catch {
    die(`Directory does not exist: ${buildPath}`);
  }

  const projectId = values['project-id'] || process.env.POLARSIGNALS_PROJECT_ID;
  const token = values['token'] || process.env.POLARSIGNALS_TOKEN;
  const serverUrl = values['server-url'] || process.env.POLARSIGNALS_SERVER_URL || 'grpc.polarsignals.com:443';
  const verbose = values['verbose'] ?? false;
  const dryRun = values['dry-run'] ?? false;
  const insecure = values['insecure'] ?? false;
  const include = values['include'] ? [values['include']] : undefined;
  const exclude = values['exclude'] ? [values['exclude']] : undefined;

  if (!dryRun) {
    if (!projectId) {
      die('Missing required option: --project-id (or set POLARSIGNALS_PROJECT_ID)');
    }
    if (!token) {
      die('Missing required option: --token (or set POLARSIGNALS_TOKEN)');
    }
  }

  // Step 1: Inject debug IDs into built files
  if (verbose) {
    console.log(`Processing directory: ${buildPath}`);
  }

  const results = await processBuiltFiles(buildPath, {
    verbose,
    overwrite: false,
    include,
    exclude,
  });

  console.log(`Processed ${results.processed} file(s), skipped ${results.skipped}, errors ${results.errors}`);

  if (results.processed === 0) {
    console.log('No files were processed. Nothing to upload.');
    process.exit(0);
  }

  if (dryRun) {
    console.log('Dry run — skipping upload.');
    if (verbose) {
      for (const [file, debugId] of Object.entries(results.debugIds)) {
        console.log(`  ${file} → ${debugId}`);
      }
    }
    process.exit(0);
  }

  // Step 2: Build upload bundles from the updated files
  const fileMappings = await findJavaScriptFiles(buildPath, { include, exclude });
  const bundles: SourceMapInfo[] = [];

  for (const mapping of fileMappings) {
    const debugId = extractDebugIdFromJs(mapping.jsContent);
    if (!debugId) {
      if (verbose) {
        console.log(`Skipping ${mapping.jsFile} — no debug ID found`);
      }
      continue;
    }

    // Create binary bundle: [js_len:u64][sm_len:u64][js_bytes][sm_bytes]
    const jsBytes = Buffer.from(mapping.jsContent, 'utf-8');
    const smBytes = Buffer.from(mapping.sourceMapContent, 'utf-8');
    const header = Buffer.alloc(16);
    header.writeBigUInt64LE(BigInt(jsBytes.length), 0);
    header.writeBigUInt64LE(BigInt(smBytes.length), 8);
    const bundleBuffer = Buffer.concat([header, jsBytes, smBytes]);

    bundles.push({
      debugId,
      content: new Uint8Array(bundleBuffer),
      jsFilePath: mapping.jsFile,
    });
  }

  if (bundles.length === 0) {
    console.log('No bundles to upload.');
    process.exit(0);
  }

  if (verbose) {
    console.log(`Uploading ${bundles.length} source map(s) to ${serverUrl}...`);
  }

  // Step 3: Upload
  const uploadResults = await uploadSourceMaps(bundles, {
    serverUrl,
    token: token!,
    projectID: projectId!,
    verbose,
    insecure,
  });

  // Step 4: Report
  let uploaded = 0;
  let skipped = 0;
  let errors = 0;

  for (const result of uploadResults) {
    if (result.success) {
      if (result.skipped) {
        skipped++;
      } else {
        uploaded++;
      }
    } else {
      errors++;
      if (verbose) {
        console.error(`  Failed: ${result.debugId} — ${result.error}`);
      }
    }
  }

  console.log(`Upload complete: ${uploaded} uploaded, ${skipped} skipped, ${errors} failed`);

  if (errors > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
