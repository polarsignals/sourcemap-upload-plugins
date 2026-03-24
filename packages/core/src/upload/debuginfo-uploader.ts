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
 * Uploads source map to debuginfo server
 */
export async function uploadSourceMap(
  sourceMapInfo: SourceMapInfo,
  options: UploadOptions
): Promise<UploadResult> {
  const { debugId, content, jsFilePath } = sourceMapInfo;
  const { serverUrl, token, projectID, verbose = false, force = false, insecure = false } = options;

  if (verbose) {
    console.log(`[upload] Uploading source map for ${jsFilePath} (debug ID: ${debugId})`);
  }

  try {
    const client = createDebuginfoClient(serverUrl, insecure);
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
        console.log(`   [skip] Skipping upload: ${shouldUploadResponse.response.reason}`);
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
      console.log(`   [ok] Source map uploaded successfully`);
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
      console.log(`   [error] Upload failed: ${errorMessage}`);
    }

    return {
      success: false,
      debugId,
      error: errorMessage,
    };
  }
}

/**
 * Uploads multiple source maps to debuginfo server
 */
export async function uploadSourceMaps(
  sourceMaps: SourceMapInfo[],
  options: UploadOptions
): Promise<UploadResult[]> {
  const results: UploadResult[] = [];

  for (const sourceMapInfo of sourceMaps) {
    const result = await uploadSourceMap(sourceMapInfo, options);
    results.push(result);
  }

  return results;
}
