import { createHash } from 'crypto';
import { GrpcTransport } from '@protobuf-ts/grpc-transport';
import { RpcError } from '@protobuf-ts/runtime-rpc';
import { ChannelCredentials } from '@grpc/grpc-js';
import {
  DebuginfoServiceClient,
  DebuginfoType,
  BuildIDType,
  UploadInstructions_UploadStrategy
} from '@parca/client';
import { StickyProgress } from './sticky-progress';

/**
 * Options for uploading source maps to debuginfo server
 */
export interface UploadOptions {
  /** Server URL for debuginfo API */
  serverUrl: string;
  /** Authentication token */
  token: string;
  /** Project ID for the upload */
  projectID: string;
  /** Whether to enable verbose logging */
  verbose?: boolean;
  /** Force upload even if source map already exists */
  force?: boolean;
  /** Allow insecure SSL connections (skip certificate validation) */
  insecure?: boolean;
  /** Maximum number of concurrent uploads (default: 50, set to 1 for serial) */
  concurrency?: number;
  /** Maximum number of retry passes for failed uploads (default: 3, set to 0 to disable) */
  maxRetries?: number;
}

/**
 * Information about a source map to upload
 */
export interface SourceMapInfo {
  /** Debug ID (UUID) for the source map */
  debugId: string;
  /** Binary bundle content (header + minified JS + source map) */
  content: Uint8Array;
  /** JavaScript file path for context */
  jsFilePath: string;
}

/**
 * Result of source map upload operation
 */
export interface UploadResult {
  /** Whether the upload was successful */
  success: boolean;
  /** Debug ID that was uploaded */
  debugId: string;
  /** Error message if upload failed */
  error?: string;
  /** Whether the file was skipped (already exists) */
  skipped?: boolean;
}

/**
 * Creates a gRPC client for the debuginfo service
 */
function createDebuginfoClient(serverUrl: string, insecure: boolean = false): DebuginfoServiceClient {
  // When insecure is true, use insecure credentials (no TLS)
  // Otherwise use SSL with optional custom options
  const channelCredentials = insecure
    ? ChannelCredentials.createInsecure()
    : ChannelCredentials.createSsl();

  const transport = new GrpcTransport({
    host: serverUrl,
    channelCredentials,
  });

  return new DebuginfoServiceClient(transport);
}

/**
 * Creates RPC metadata with authorization header
 */
function createRpcMetadata(token: string, projectID: string): { [key: string]: string } {
  return {
    'authorization': `Bearer ${token}`,
    'projectID': projectID,
  };
}

/**
 * Calculates SHA-256 hash of bundle content
 */
function calculateSourceMapHash(content: Uint8Array): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Uploads source map to debuginfo server.
 * Creates a one-shot gRPC client for this single upload. For batch uploads,
 * use `uploadSourceMaps` which reuses a single client across all files.
 */
export async function uploadSourceMap(
  sourceMapInfo: SourceMapInfo,
  options: UploadOptions
): Promise<UploadResult> {
  const { serverUrl, insecure = false } = options;
  const client = createDebuginfoClient(serverUrl, insecure);
  return uploadOneSourceMap(client, sourceMapInfo, options);
}

/**
 * Internal: uploads a single source map using the provided gRPC client.
 */
async function uploadOneSourceMap(
  client: DebuginfoServiceClient,
  sourceMapInfo: SourceMapInfo,
  options: UploadOptions
): Promise<UploadResult> {
  const { debugId, content, jsFilePath } = sourceMapInfo;
  const { token, projectID, verbose = false, force = false } = options;

  const startTime = Date.now();

  if (verbose) {
    console.log(`[upload] Uploading source map for ${jsFilePath} (debug ID: ${debugId})`);
  }

  try {
    const metadata = createRpcMetadata(token, projectID);
    const hash = calculateSourceMapHash(content);
    const size = content.length;

    // Step 1: Check if we should initiate upload
    if (verbose) {
      console.log(`   Checking if upload should be initiated...`);
    }

    const shouldUploadResponse = await client.shouldInitiateUpload({
      buildId: debugId,
      hash,
      force,
      type: DebuginfoType.SOURCE_MAP,
      buildIdType: BuildIDType.BUILD_ID_TYPE_SOURCE_MAP_DEBUG_ID,
    }, { meta: metadata });

    if (!shouldUploadResponse.response.shouldInitiateUpload) {
      if (verbose) {
        const elapsed = Date.now() - startTime;
        console.log(`   [skip] Skipping upload: ${shouldUploadResponse.response.reason} (${elapsed}ms)`);
      }
      return {
        success: true,
        debugId,
        skipped: true,
      };
    }

    // Step 2: Initiate upload
    if (verbose) {
      console.log(`   Initiating upload (${(size / 1024).toFixed(1)} KB)...`);
    }

    const initiateResponse = await client.initiateUpload({
      buildId: debugId,
      size: BigInt(size),
      hash,
      force,
      type: DebuginfoType.SOURCE_MAP,
      buildIdType: BuildIDType.BUILD_ID_TYPE_SOURCE_MAP_DEBUG_ID,
    }, { meta: metadata });

    const uploadInstructions = initiateResponse.response.uploadInstructions;
    if (!uploadInstructions) {
      throw new Error('No upload instructions received from server');
    }

    // Step 3: Upload content based on strategy
    if (uploadInstructions.uploadStrategy === UploadInstructions_UploadStrategy.GRPC) {
      // Upload via gRPC streaming
      if (verbose) {
        console.log(`   Uploading via gRPC stream...`);
      }

      const uploadCall = client.upload({ meta: metadata });

      // Send upload info
      await uploadCall.requests.send({
        data: {
          oneofKind: 'info',
          info: {
            buildId: debugId,
            uploadId: uploadInstructions.uploadId,
            type: DebuginfoType.SOURCE_MAP,
          }
        }
      });

      // Send bundle content in chunks (split large content)
      const chunkSize = 64 * 1024; // 64KB chunks

      for (let offset = 0; offset < content.length; offset += chunkSize) {
        const chunk = content.subarray(offset, offset + chunkSize);
        await uploadCall.requests.send({
          data: {
            oneofKind: 'chunkData',
            chunkData: new Uint8Array(chunk)
          }
        });
      }

      // Complete the upload
      await uploadCall.requests.complete();
      await uploadCall.response;

      if (verbose) {
        console.log(`   Upload completed via gRPC`);
      }

    } else if (uploadInstructions.uploadStrategy === UploadInstructions_UploadStrategy.SIGNED_URL) {
      // Upload via signed URL
      if (verbose) {
        console.log(`   Uploading via signed URL...`);
      }

      const fetch = (await import('node-fetch')).default;
      const response = await fetch(uploadInstructions.signedUrl, {
        method: 'PUT',
        body: Buffer.from(content),
      });

      if (!response.ok) {
        const responseBody = await response.text();
        if (verbose) {
          console.log(`   Signed URL: ${uploadInstructions.signedUrl.substring(0, 100)}...`);
          console.log(`   Response body: ${responseBody}`);
        }
        throw new Error(`Signed URL upload failed: ${response.status} ${response.statusText}`);
      }

      if (verbose) {
        console.log(`   Upload completed via signed URL`);
      }
    } else {
      throw new Error(`Unsupported upload strategy: ${uploadInstructions.uploadStrategy}`);
    }

    // Step 4: Mark upload as finished
    if (verbose) {
      console.log(`   Marking upload as finished...`);
    }

    await client.markUploadFinished({
      buildId: debugId,
      uploadId: uploadInstructions.uploadId,
      type: DebuginfoType.SOURCE_MAP,
    }, { meta: metadata });

    if (verbose) {
      const elapsed = Date.now() - startTime;
      console.log(`   [ok] Source map uploaded successfully (${elapsed}ms)`);
    }

    return {
      success: true,
      debugId,
    };

  } catch (error) {
    const errorMessage = error instanceof RpcError
      ? `gRPC error (${error.code}): ${error.message}`
      : error instanceof Error
        ? error.message
        : 'Unknown error';

    if (verbose) {
      const elapsed = Date.now() - startTime;
      console.log(`   [error] Upload failed: ${errorMessage} (${elapsed}ms)`);
    }

    return {
      success: false,
      debugId,
      error: errorMessage,
    };
  }
}

/**
 * Uploads multiple source maps to debuginfo server.
 * Creates a single gRPC client and reuses it across all uploads.
 * Runs uploads in parallel up to `options.concurrency` (default 50, set to 1 for serial).
 * Failed uploads are retried up to `options.maxRetries` times (default 3).
 */
export async function uploadSourceMaps(
  sourceMaps: SourceMapInfo[],
  options: UploadOptions
): Promise<UploadResult[]> {
  const { serverUrl, insecure = false, verbose = false, concurrency = 50, maxRetries = 3 } = options;
  const startTime = Date.now();

  const client = createDebuginfoClient(serverUrl, insecure);

  // Results indexed by original position in sourceMaps
  const results: UploadResult[] = new Array(sourceMaps.length);
  // Indices of items still needing an attempt (initially: all of them)
  let pendingIndices: number[] = sourceMaps.map((_, i) => i);

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (pendingIndices.length === 0) break;

    if (attempt > 0 && verbose) {
      console.log(`[upload] Retry ${attempt}/${maxRetries}: ${pendingIndices.length} failed upload(s)`);
    }

    const passLabel = attempt === 0 ? undefined : `retry ${attempt}/${maxRetries}`;
    const progress = new StickyProgress(pendingIndices.length, passLabel);
    progress.start();

    try {
      const passResults = await parallelMap(pendingIndices, concurrency, async (originalIndex) => {
        const result = await uploadOneSourceMap(client, sourceMaps[originalIndex], options);
        progress.recordResult(result);
        return { originalIndex, result };
      });

      const stillFailed: number[] = [];
      for (const { originalIndex, result } of passResults) {
        results[originalIndex] = result;
        if (!result.success) {
          stillFailed.push(originalIndex);
        }
      }
      pendingIndices = stillFailed;
    } finally {
      progress.done();
    }
  }

  if (verbose) {
    const elapsed = Date.now() - startTime;
    const uploaded = results.filter(r => r.success && !r.skipped).length;
    const skipped = results.filter(r => r.skipped).length;
    const failed = results.filter(r => !r.success).length;
    const seconds = (elapsed / 1000).toFixed(2);
    const avgPerFile = sourceMaps.length > 0 ? (elapsed / sourceMaps.length).toFixed(0) : '0';
    console.log(`[upload] Total: ${sourceMaps.length} files in ${seconds}s (avg ${avgPerFile}ms/file, concurrency=${concurrency}) — uploaded: ${uploaded}, skipped: ${skipped}, failed: ${failed}`);
  }

  return results;
}


/**
 * Runs `fn` over `items` with at most `concurrency` in flight at a time.
 * Preserves result order. Errors are returned as values via the result type
 * (the caller's `fn` must not throw).
 */
async function parallelMap<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    while (true) {
      const i = nextIndex++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  };

  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
